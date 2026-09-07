import { MedusaService } from '@medusajs/framework/utils';
import { PointsAccount, PointsTransaction } from './models';
import { computeAvailableBalance } from './lib/ledger';

type LedgerRef = {
  reference?: string | null;
  reference_id?: string | null;
  // Supplying a key makes the movement idempotent: repeating the same source
  // event (e.g. an `order.placed` re-delivery) never credits/debits twice.
  idempotency_key?: string | null;
  program_id?: string | null;
  earn_rule_id?: string | null;
  campaign_id?: string | null;
  expires_at?: Date | null;
  // Earn maturity. Defaults to 'available' (posted immediately).
  status?: 'pending' | 'available';
};

type LedgerType = 'earn' | 'redeem' | 'adjust' | 'reverse' | 'expire';

class PointsModuleService extends MedusaService({
  PointsAccount,
  PointsTransaction,
}) {
  async getOrCreateAccount(customerId: string): Promise<{ id: string; balance: number }> {
    const existing = await this.listPointsAccounts({ customer_id: customerId });
    const found = existing[0];
    if (found) return found;
    return this.createPointsAccounts({ customer_id: customerId, balance: 0 });
  }

  // Available balance recomputed from the ledger (the source of truth). Returns
  // 0 for customers without an account yet.
  async getAvailableBalance(customerId: string): Promise<number> {
    const accounts = await this.listPointsAccounts({ customer_id: customerId });
    const account = accounts[0];
    if (!account) return 0;
    return this.computeBalanceForAccount(account.id);
  }

  // Sum the ledger for an account. Paged so a long history still totals fully.
  private async computeBalanceForAccount(accountId: string): Promise<number> {
    const PAGE = 1000;
    const entries: Array<{ amount: number; status: string }> = [];
    for (let skip = 0; ; skip += PAGE) {
      const page = (await this.listPointsTransactions(
        { account_id: accountId },
        { select: ['amount', 'status'], skip, take: PAGE },
      )) as Array<{ amount: number; status: string }>;
      entries.push(...page);
      if (page.length < PAGE) break;
    }
    return computeAvailableBalance(entries);
  }

  // Recompute + persist the denormalized balance from the ledger. Self-healing:
  // avoids the read-modify-write races the old arithmetic path had.
  private async syncBalance(accountId: string): Promise<{ id: string; balance: number }> {
    const balance = await this.computeBalanceForAccount(accountId);
    return this.updatePointsAccounts({ id: accountId, balance });
  }

  // Returns the existing transaction for an idempotency key, if any.
  private async findByIdempotencyKey(key: string) {
    const rows = await this.listPointsTransactions({ idempotency_key: key });
    return rows[0] ?? null;
  }

  private async appendEntry(
    accountId: string,
    amount: number,
    type: LedgerType,
    ref: LedgerRef,
  ): Promise<void> {
    await this.createPointsTransactions({
      account_id: accountId,
      amount,
      type,
      status: ref.status ?? 'available',
      reference: ref.reference ?? null,
      reference_id: ref.reference_id ?? null,
      idempotency_key: ref.idempotency_key ?? null,
      expires_at: ref.expires_at ?? null,
      program_id: ref.program_id ?? null,
      earn_rule_id: ref.earn_rule_id ?? null,
      campaign_id: ref.campaign_id ?? null,
    });
  }

  // Credit points. No-op for non-positive amounts. Idempotent when a key is
  // supplied. Writes a signed `earn` entry and refreshes the cached balance.
  async earnPoints(
    customerId: string,
    amount: number,
    ref: LedgerRef = {},
  ): Promise<{ id: string; balance: number } | null> {
    if (!Number.isFinite(amount) || amount <= 0) return null;

    const account = await this.getOrCreateAccount(customerId);
    if (ref.idempotency_key && (await this.findByIdempotencyKey(ref.idempotency_key))) {
      return { id: account.id, balance: account.balance };
    }

    await this.appendEntry(account.id, amount, 'earn', ref);
    return this.syncBalance(account.id);
  }

  // Debit points. Throws on non-positive amount or insufficient balance.
  async redeemPoints(
    customerId: string,
    amount: number,
    ref: LedgerRef = {},
  ): Promise<{ id: string; balance: number }> {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Redeem amount must be a positive number');
    }

    const account = await this.getOrCreateAccount(customerId);
    if (ref.idempotency_key) {
      const dup = await this.findByIdempotencyKey(ref.idempotency_key);
      if (dup) return { id: account.id, balance: account.balance };
    }

    const balance = await this.computeBalanceForAccount(account.id);
    if (balance < amount) {
      throw new Error('Insufficient points balance');
    }

    await this.appendEntry(account.id, -amount, 'redeem', { ...ref, status: 'available' });
    return this.syncBalance(account.id);
  }

  // Claw back points (order canceled / returned). Idempotent by key. Records a
  // negative `reverse` entry; never mutates the original earn (append-only).
  async reversePoints(
    customerId: string,
    amount: number,
    ref: LedgerRef = {},
  ): Promise<{ id: string; balance: number } | null> {
    if (!Number.isFinite(amount) || amount <= 0) return null;

    const account = await this.getOrCreateAccount(customerId);
    if (ref.idempotency_key && (await this.findByIdempotencyKey(ref.idempotency_key))) {
      return { id: account.id, balance: account.balance };
    }

    await this.appendEntry(account.id, -amount, 'reverse', { ...ref, status: 'available' });
    return this.syncBalance(account.id);
  }

  // Expire points (scheduled job). Records a negative `expire` entry.
  async expirePoints(
    customerId: string,
    amount: number,
    ref: LedgerRef = {},
  ): Promise<{ id: string; balance: number } | null> {
    if (!Number.isFinite(amount) || amount <= 0) return null;

    const account = await this.getOrCreateAccount(customerId);
    if (ref.idempotency_key && (await this.findByIdempotencyKey(ref.idempotency_key))) {
      return { id: account.id, balance: account.balance };
    }

    await this.appendEntry(account.id, -amount, 'expire', { ...ref, status: 'available' });
    return this.syncBalance(account.id);
  }

  // Manual admin adjustment. `amount` may be positive or negative.
  async adjustPoints(
    customerId: string,
    amount: number,
    ref: LedgerRef = {},
  ): Promise<{ id: string; balance: number } | null> {
    if (!Number.isFinite(amount) || amount === 0) return null;

    const account = await this.getOrCreateAccount(customerId);
    if (ref.idempotency_key && (await this.findByIdempotencyKey(ref.idempotency_key))) {
      return { id: account.id, balance: account.balance };
    }

    await this.appendEntry(account.id, amount, 'adjust', { ...ref, status: 'available' });
    return this.syncBalance(account.id);
  }

  // Expire earn lots past their `expires_at`. Flips them 'available' → 'expired'
  // (removing them from the balance) and resyncs affected accounts. Idempotent:
  // already-expired lots are not matched again. Called by the scheduled job.
  async expireDueLots(now: Date = new Date()): Promise<{ expired: number }> {
    const due = (await this.listPointsTransactions(
      { type: 'earn', status: 'available', expires_at: { $lt: now } },
      { select: ['id', 'account_id'], take: 10000 },
    )) as Array<{ id: string; account_id: string }>;
    if (!due.length) return { expired: 0 };

    await this.updatePointsTransactions(
      due.map((t) => ({ id: t.id, status: 'expired' as const })),
    );

    const accountIds = [...new Set(due.map((t) => t.account_id))];
    for (const accountId of accountIds) await this.syncBalance(accountId);

    return { expired: due.length };
  }
}

export default PointsModuleService;
