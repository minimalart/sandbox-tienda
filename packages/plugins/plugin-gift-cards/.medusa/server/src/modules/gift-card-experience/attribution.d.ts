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
export declare function attributeGiftCardLedger(transactions: StoreCreditLedgerTransaction[], giftCardSourceAccountIds: ReadonlySet<string>): Map<string, GiftCardAttribution>;
