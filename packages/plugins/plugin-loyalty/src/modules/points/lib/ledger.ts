// Pure ledger math, isolated from the DB so it can be unit-tested (node --test).
//
// The points ledger is append-only. Every movement is a signed `amount`
// (positive for earns / positive adjustments, negative for redeems, reversals
// and expirations) carrying a `status`:
//   - available: posted; counts toward the balance (the default).
//   - pending:   earned but not yet usable (matures later); excluded.
//   - expired:   an earn lot that expired before it was posted; excluded.
//   - reversed:  an earn lot clawed back before it was posted; excluded.
// Reversals/expirations of already-posted points are recorded as their own
// negative `reverse`/`expire` entries (status 'available') so the history is
// never mutated — the balance still nets out correctly.

export type LedgerEntry = { amount: number; status?: string | null };

// Raw signed sum of the entries that currently count toward the balance.
export function sumAvailable(entries: LedgerEntry[]): number {
  return entries
    .filter((e) => (e.status ?? 'available') === 'available')
    .reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
}

// Balance shown to the customer: the posted sum, floored at 0. Flooring guards
// the edge case where a reversal (e.g. a returned order whose points were
// already spent) would otherwise drive the cached balance negative; the ledger
// remains the source of truth and future writes re-sum from it.
export function computeAvailableBalance(entries: LedgerEntry[]): number {
  return Math.max(0, sumAvailable(entries));
}
