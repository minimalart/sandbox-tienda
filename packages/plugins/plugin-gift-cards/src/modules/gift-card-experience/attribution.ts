export type StoreCreditLedgerTransaction = {
  id: string;
  account_id: string;
  amount: number;
  type: 'credit' | 'debit';
  reference?: string | null;
  reference_id?: string | null;
  created_at: Date | string;
};

export type GiftCardAttribution = {
  source_account_id: string;
  target_account_id: string;
  credited: number;
  remaining: number;
  first_used_at: Date | null;
  exhausted_at: Date | null;
};

/**
 * Replays a store-credit ledger using FIFO lots. Non-gift credits remain in the
 * queue, so a debit is attributed to a gift card only when it actually reaches
 * that lot. Transactions must be ordered by created_at and then id.
 */
export function attributeGiftCardLedger(
  transactions: StoreCreditLedgerTransaction[],
  giftCardSourceAccountIds: ReadonlySet<string>,
): Map<string, GiftCardAttribution> {
  const queues = new Map<string, Array<{ remaining: number; source_account_id?: string }>>();
  const result = new Map<string, GiftCardAttribution>();

  for (const transaction of transactions) {
    const targetAccountId = String(transaction.account_id);
    const queue = queues.get(targetAccountId) ?? [];
    queues.set(targetAccountId, queue);
    const amount = Math.max(0, Number(transaction.amount) || 0);

    if (transaction.type === 'credit') {
      const sourceAccountId = transaction.reference === 'store-credit' && transaction.reference_id && giftCardSourceAccountIds.has(String(transaction.reference_id))
        ? String(transaction.reference_id)
        : undefined;
      queue.push({ remaining: amount, source_account_id: sourceAccountId });
      if (sourceAccountId) result.set(sourceAccountId, {
        source_account_id: sourceAccountId,
        target_account_id: targetAccountId,
        credited: amount,
        remaining: amount,
        first_used_at: null,
        exhausted_at: null,
      });
      continue;
    }
    if (transaction.type !== 'debit') continue;

    let debitRemaining = amount;
    for (const lot of queue) {
      if (debitRemaining <= 0) break;
      if (lot.remaining <= 0) continue;
      const consumed = Math.min(lot.remaining, debitRemaining);
      lot.remaining -= consumed;
      debitRemaining -= consumed;
      if (!lot.source_account_id || consumed <= 0) continue;
      const attribution = result.get(lot.source_account_id);
      if (!attribution) continue;
      attribution.remaining = lot.remaining;
      attribution.first_used_at ??= new Date(transaction.created_at);
      if (lot.remaining <= 0) attribution.exhausted_at ??= new Date(transaction.created_at);
    }
  }
  return result;
}
