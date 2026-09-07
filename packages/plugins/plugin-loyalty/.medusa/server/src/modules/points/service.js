"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("@medusajs/framework/utils");
const models_1 = require("./models");
const ledger_1 = require("./lib/ledger");
class PointsModuleService extends (0, utils_1.MedusaService)({
    PointsAccount: models_1.PointsAccount,
    PointsTransaction: models_1.PointsTransaction,
}) {
    async getOrCreateAccount(customerId) {
        const existing = await this.listPointsAccounts({ customer_id: customerId });
        const found = existing[0];
        if (found)
            return found;
        return this.createPointsAccounts({ customer_id: customerId, balance: 0 });
    }
    // Available balance recomputed from the ledger (the source of truth). Returns
    // 0 for customers without an account yet.
    async getAvailableBalance(customerId) {
        const accounts = await this.listPointsAccounts({ customer_id: customerId });
        const account = accounts[0];
        if (!account)
            return 0;
        return this.computeBalanceForAccount(account.id);
    }
    // Sum the ledger for an account. Paged so a long history still totals fully.
    async computeBalanceForAccount(accountId) {
        const PAGE = 1000;
        const entries = [];
        for (let skip = 0;; skip += PAGE) {
            const page = (await this.listPointsTransactions({ account_id: accountId }, { select: ['amount', 'status'], skip, take: PAGE }));
            entries.push(...page);
            if (page.length < PAGE)
                break;
        }
        return (0, ledger_1.computeAvailableBalance)(entries);
    }
    // Recompute + persist the denormalized balance from the ledger. Self-healing:
    // avoids the read-modify-write races the old arithmetic path had.
    async syncBalance(accountId) {
        const balance = await this.computeBalanceForAccount(accountId);
        return this.updatePointsAccounts({ id: accountId, balance });
    }
    // Returns the existing transaction for an idempotency key, if any.
    async findByIdempotencyKey(key) {
        const rows = await this.listPointsTransactions({ idempotency_key: key });
        return rows[0] ?? null;
    }
    async appendEntry(accountId, amount, type, ref) {
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
    async earnPoints(customerId, amount, ref = {}) {
        if (!Number.isFinite(amount) || amount <= 0)
            return null;
        const account = await this.getOrCreateAccount(customerId);
        if (ref.idempotency_key && (await this.findByIdempotencyKey(ref.idempotency_key))) {
            return { id: account.id, balance: account.balance };
        }
        await this.appendEntry(account.id, amount, 'earn', ref);
        return this.syncBalance(account.id);
    }
    // Debit points. Throws on non-positive amount or insufficient balance.
    async redeemPoints(customerId, amount, ref = {}) {
        if (!Number.isFinite(amount) || amount <= 0) {
            throw new Error('Redeem amount must be a positive number');
        }
        const account = await this.getOrCreateAccount(customerId);
        if (ref.idempotency_key) {
            const dup = await this.findByIdempotencyKey(ref.idempotency_key);
            if (dup)
                return { id: account.id, balance: account.balance };
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
    async reversePoints(customerId, amount, ref = {}) {
        if (!Number.isFinite(amount) || amount <= 0)
            return null;
        const account = await this.getOrCreateAccount(customerId);
        if (ref.idempotency_key && (await this.findByIdempotencyKey(ref.idempotency_key))) {
            return { id: account.id, balance: account.balance };
        }
        await this.appendEntry(account.id, -amount, 'reverse', { ...ref, status: 'available' });
        return this.syncBalance(account.id);
    }
    // Expire points (scheduled job). Records a negative `expire` entry.
    async expirePoints(customerId, amount, ref = {}) {
        if (!Number.isFinite(amount) || amount <= 0)
            return null;
        const account = await this.getOrCreateAccount(customerId);
        if (ref.idempotency_key && (await this.findByIdempotencyKey(ref.idempotency_key))) {
            return { id: account.id, balance: account.balance };
        }
        await this.appendEntry(account.id, -amount, 'expire', { ...ref, status: 'available' });
        return this.syncBalance(account.id);
    }
    // Manual admin adjustment. `amount` may be positive or negative.
    async adjustPoints(customerId, amount, ref = {}) {
        if (!Number.isFinite(amount) || amount === 0)
            return null;
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
    async expireDueLots(now = new Date()) {
        const due = (await this.listPointsTransactions({ type: 'earn', status: 'available', expires_at: { $lt: now } }, { select: ['id', 'account_id'], take: 10000 }));
        if (!due.length)
            return { expired: 0 };
        await this.updatePointsTransactions(due.map((t) => ({ id: t.id, status: 'expired' })));
        const accountIds = [...new Set(due.map((t) => t.account_id))];
        for (const accountId of accountIds)
            await this.syncBalance(accountId);
        return { expired: due.length };
    }
}
exports.default = PointsModuleService;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL3BvaW50cy9zZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEscURBQTBEO0FBQzFELHFDQUE0RDtBQUM1RCx5Q0FBdUQ7QUFrQnZELE1BQU0sbUJBQW9CLFNBQVEsSUFBQSxxQkFBYSxFQUFDO0lBQzlDLGFBQWEsRUFBYixzQkFBYTtJQUNiLGlCQUFpQixFQUFqQiwwQkFBaUI7Q0FDbEIsQ0FBQztJQUNBLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxVQUFrQjtRQUN6QyxNQUFNLFFBQVEsR0FBRyxNQUFNLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxFQUFFLFdBQVcsRUFBRSxVQUFVLEVBQUUsQ0FBQyxDQUFDO1FBQzVFLE1BQU0sS0FBSyxHQUFHLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUMxQixJQUFJLEtBQUs7WUFBRSxPQUFPLEtBQUssQ0FBQztRQUN4QixPQUFPLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxFQUFFLFdBQVcsRUFBRSxVQUFVLEVBQUUsT0FBTyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDNUUsQ0FBQztJQUVELDhFQUE4RTtJQUM5RSwwQ0FBMEM7SUFDMUMsS0FBSyxDQUFDLG1CQUFtQixDQUFDLFVBQWtCO1FBQzFDLE1BQU0sUUFBUSxHQUFHLE1BQU0sSUFBSSxDQUFDLGtCQUFrQixDQUFDLEVBQUUsV0FBVyxFQUFFLFVBQVUsRUFBRSxDQUFDLENBQUM7UUFDNUUsTUFBTSxPQUFPLEdBQUcsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzVCLElBQUksQ0FBQyxPQUFPO1lBQUUsT0FBTyxDQUFDLENBQUM7UUFDdkIsT0FBTyxJQUFJLENBQUMsd0JBQXdCLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBQ25ELENBQUM7SUFFRCw2RUFBNkU7SUFDckUsS0FBSyxDQUFDLHdCQUF3QixD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