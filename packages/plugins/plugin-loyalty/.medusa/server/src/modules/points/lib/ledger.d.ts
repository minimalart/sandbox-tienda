export type LedgerEntry = {
    amount: number;
    status?: string | null;
};
export declare function sumAvailable(entries: LedgerEntry[]): number;
export declare function computeAvailableBalance(entries: LedgerEntry[]): number;
