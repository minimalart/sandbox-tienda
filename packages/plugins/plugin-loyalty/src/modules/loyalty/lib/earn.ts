// Pure earn-points math, isolated from the DB for unit testing (node --test).

export type EarnCalc = {
  calc_type: 'fixed' | 'percentage' | 'multiplier';
  calc_value: number;
};

// Points earned for a rule given the eligible `amount` (same unit the ledger
// measures against). `multiplier` stacks a tier/campaign boost on top. Result is
// floored to whole points and never negative.
//
// Note (MVP): points are integers and multipliers are applied as integers
// (double/triple points). Fractional earn *rates* are expressed as a percentage
// rule (e.g. rate 0.1 = "1 point per $10" = calc_type 'percentage', calc_value 10).
export function computeEarnedPoints(
  rule: EarnCalc,
  amount: number,
  multiplier = 1,
): number {
  const amt = Number(amount) || 0;
  const value = Number(rule.calc_value) || 0;
  const mult = Number(multiplier) || 1;

  let raw = 0;
  switch (rule.calc_type) {
    case 'fixed':
      raw = value;
      break;
    case 'percentage':
      raw = (amt * value) / 100;
      break;
    case 'multiplier':
      raw = amt * value;
      break;
    default:
      raw = 0;
  }

  return Math.max(0, Math.floor(raw * mult));
}
