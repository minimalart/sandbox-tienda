export type EarnCalc = {
    calc_type: 'fixed' | 'percentage' | 'multiplier';
    calc_value: number;
};
export declare function computeEarnedPoints(rule: EarnCalc, amount: number, multiplier?: number): number;
