/** Legacy instance defaults from the host settings. Per-store programs retain
 * their own rules and take precedence over this fallback. */
export declare const LOYALTY_SETTINGS_NAMESPACE = "extension:loyalty-engine";
/**
 * Legacy rate used when no program is active: points per currency unit.
 * `1` = one point per peso.
 */
export declare const DEFAULT_POINTS_EARN_RATE = 1;
export type LoyaltySettings = {
    /** Only used while no program is active. See `resolvePointsEarnRate`. */
    pointsEarnRate: number;
};
/**
 * The legacy earn rate, sanitized.
 *
 * `> 0` and not `>= 0`: a rate of zero would mean "do not accumulate", and a
 * blank `0` from a deploy panel is indistinguishable from that intent. Since
 * the value is only used when NO program is configured, the generous default
 * preserves the pre-migration behavior. To disable accumulation, create a
 * program without earn rules — that is explicit and visible in the UI.
 */
export declare function resolvePointsEarnRate(raw?: number): number;
export declare function getLoyaltySettings(): LoyaltySettings;
