"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.sumAvailable = sumAvailable;
exports.computeAvailableBalance = computeAvailableBalance;
// Raw signed sum of the entries that currently count toward the balance.
function sumAvailable(entries) {
    return entries
        .filter((e) => (e.status ?? 'available') === 'available')
        .reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
}
// Balance shown to the customer: the posted sum, floored at 0. Flooring guards
// the edge case where a reversal (e.g. a returned order whose points were
// already spent) would otherwise drive the cached balance negative; the ledger
// remains the source of truth and future writes re-sum from it.
function computeAvailableBalance(entries) {
    return Math.max(0, sumAvailable(entries));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGVkZ2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL21vZHVsZXMvcG9pbnRzL2xpYi9sZWRnZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBLGlGQUFpRjtBQUNqRixFQUFFO0FBQ0Ysd0VBQXdFO0FBQ3hFLDhFQUE4RTtBQUM5RSx3Q0FBd0M7QUFDeEMsa0VBQWtFO0FBQ2xFLHNFQUFzRTtBQUN0RSwwRUFBMEU7QUFDMUUseUVBQXlFO0FBQ3pFLDJFQUEyRTtBQUMzRSw2RUFBNkU7QUFDN0Usd0RBQXdEOztBQUt4RCxvQ0FJQztBQU1ELDBEQUVDO0FBYkQseUVBQXlFO0FBQ3pFLFNBQWdCLFlBQVksQ0FBQyxPQUFzQjtJQUNqRCxPQUFPLE9BQU87U0FDWCxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sSUFBSSxXQUFXLENBQUMsS0FBSyxXQUFXLENBQUM7U0FDeEQsTUFBTSxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztBQUMxRCxDQUFDO0FBRUQsK0VBQStFO0FBQy9FLDBFQUEwRTtBQUMxRSwrRUFBK0U7QUFDL0UsZ0VBQWdFO0FBQ2hFLFNBQWdCLHVCQUF1QixDQUFDLE9BQXNCO0lBQzVELE9BQU8sSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsWUFBWSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7QUFDNUMsQ0FBQyJ9