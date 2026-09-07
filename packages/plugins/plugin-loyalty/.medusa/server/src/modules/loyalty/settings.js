"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_POINTS_EARN_RATE = exports.LOYALTY_SETTINGS_NAMESPACE = void 0;
exports.resolvePointsEarnRate = resolvePointsEarnRate;
exports.getLoyaltySettings = getLoyaltySettings;
const mercatto_plugin_runtime_1 = require("@minimalart/mercatto-plugin-runtime");
/** Legacy instance defaults from the host settings. Per-store programs retain
 * their own rules and take precedence over this fallback. */
exports.LOYALTY_SETTINGS_NAMESPACE = 'extension:loyalty-engine';
/**
 * Legacy rate used when no program is active: points per currency unit.
 * `1` = one point per peso.
 */
exports.DEFAULT_POINTS_EARN_RATE = 1;
function readEnvNumber(key, fallback) {
    const raw = (0, mercatto_plugin_runtime_1.getAppSettingsSyncReader)()?.(exports.LOYALTY_SETTINGS_NAMESPACE, key) ?? process.env[key];
    if (raw === undefined || raw === null || raw === '')
        return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
}
/**
 * The legacy earn rate, sanitized.
 *
 * `> 0` and not `>= 0`: a rate of zero would mean "do not accumulate", and a
 * blank `0` from a deploy panel is indistinguishable from that intent. Since
 * the value is only used when NO program is configured, the generous default
 * preserves the pre-migration behavior. To disable accumulation, create a
 * program without earn rules — that is explicit and visible in the UI.
 */
function resolvePointsEarnRate(raw = getLoyaltySettings().pointsEarnRate) {
    return Number.isFinite(raw) && raw > 0 ? raw : exports.DEFAULT_POINTS_EARN_RATE;
}
function getLoyaltySettings() {
    return {
        pointsEarnRate: readEnvNumber('POINTS_EARN_RATE', exports.DEFAULT_POINTS_EARN_RATE),
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2V0dGluZ3MuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy9sb3lhbHR5L3NldHRpbmdzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQWlDQSxzREFFQztBQUVELGdEQUlDO0FBekNELGlGQUErRTtBQUMvRTs2REFDNkQ7QUFFaEQsUUFBQSwwQkFBMEIsR0FBRywwQkFBMEIsQ0FBQztBQUVyRTs7O0dBR0c7QUFDVSxRQUFBLHdCQUF3QixHQUFHLENBQUMsQ0FBQztBQU8xQyxTQUFTLGFBQWEsQ0FBQyxHQUFXLEVBQUUsUUFBZ0I7SUFDbEQsTUFBTSxHQUFHLEdBQUcsSUFBQSxrREFBd0IsR0FBRSxFQUFFLENBQUMsa0NBQTBCLEVBQUUsR0FBRyxDQUFDLElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUM5RixJQUFJLEdBQUcsS0FBSyxTQUFTLElBQUksR0FBRyxLQUFLLElBQUksSUFBSSxHQUFHLEtBQUssRUFBRTtRQUFFLE9BQU8sUUFBUSxDQUFDO0lBQ3JFLE1BQU0sQ0FBQyxHQUFHLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUN0QixPQUFPLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDO0FBQzNDLENBQUM7QUFFRDs7Ozs7Ozs7R0FRRztBQUNILFNBQWdCLHFCQUFxQixDQUFDLE1BQWMsa0JBQWtCLEVBQUUsQ0FBQyxjQUFjO0lBQ3JGLE9BQU8sTUFBTSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsSUFBSSxHQUFHLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLGdDQUF3QixDQUFDO0FBQzFFLENBQUM7QUFFRCxTQUFnQixrQkFBa0I7SUFDaEMsT0FBTztRQUNMLGNBQWMsRUFBRSxhQUFhLENBQUMsa0JBQWtCLEVBQUUsZ0NBQXdCLENBQUM7S0FDNUUsQ0FBQztBQUNKLENBQUMifQ==