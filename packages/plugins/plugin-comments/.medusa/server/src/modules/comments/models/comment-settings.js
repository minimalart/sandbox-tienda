"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommentSettings = void 0;
const utils_1 = require("@medusajs/framework/utils");
/**
 * CommentSettings — single-row global configuration for the comments/reviews
 * system (same single-row pattern as blog-settings.ts). Kept in its own table
 * so the module stays self-contained. The architecture leaves room to move to
 * per-entity overrides later (PRD §13) without a disruptive migration.
 *
 * `review_mode` controls what a comment captures:
 *   - 'comment' → text only (no rating)
 *   - 'rating'  → score only (no text)
 *   - 'both'    → score + text
 */
exports.CommentSettings = utils_1.model.define('comment_settings', {
    id: utils_1.model.id({ prefix: 'cset' }).primaryKey(),
    enabled: utils_1.model.boolean().default(true),
    review_mode: utils_1.model.enum(['comment', 'rating', 'both']).default('both'),
    // Max rating value; ratings are validated against 1..rating_scale.
    rating_scale: utils_1.model.number().default(5),
    who_can_comment: utils_1.model
        .enum(['registered', 'verified_buyer'])
        .default('registered'),
    moderation: utils_1.model.enum(['auto', 'manual']).default('auto'),
    edit_window_minutes: utils_1.model.number().default(15),
    min_length: utils_1.model.number().default(5),
    max_length: utils_1.model.number().default(2000),
    rate_limit_per_minute: utils_1.model.number().default(5),
    /**
     * La tienda dueña de esta configuración. `NULL` = GLOBAL de la instancia, el
     * fallback de toda tienda que no defina la suya.
     *
     * Deja de ser un singleton: la unicidad pasa a ser por tienda y necesita DOS
     * índices parciales, porque en Postgres `NULL != NULL`.
     */
    site_id: utils_1.model.text().nullable(),
});
exports.default = exports.CommentSettings;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbWVudC1zZXR0aW5ncy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL2NvbW1lbnRzL21vZGVscy9jb21tZW50LXNldHRpbmdzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHFEQUFrRDtBQUVsRDs7Ozs7Ozs7OztHQVVHO0FBQ1UsUUFBQSxlQUFlLEdBQUcsYUFBSyxDQUFDLE1BQU0sQ0FBQyxrQkFBa0IsRUFBRTtJQUM5RCxFQUFFLEVBQUUsYUFBSyxDQUFDLEVBQUUsQ0FBQyxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsQ0FBQyxDQUFDLFVBQVUsRUFBRTtJQUM3QyxPQUFPLEVBQUUsYUFBSyxDQUFDLE9BQU8sRUFBRSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUM7SUFDdEMsV0FBVyxFQUFFLGFBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxTQUFTLEVBQUUsUUFBUSxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQztJQUN0RSxtRUFBbUU7SUFDbkUsWUFBWSxFQUFFLGFBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO0lBQ3ZDLGVBQWUsRUFBRSxhQUFLO1NBQ25CLElBQUksQ0FBQyxDQUFDLFlBQVksRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO1NBQ3RDLE9BQU8sQ0FBQyxZQUFZLENBQUM7SUFDeEIsVUFBVSxFQUFFLGFBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLEVBQUUsUUFBUSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDO0lBQzFELG1CQUFtQixFQUFFLGFBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO0lBQy9DLFVBQVUsRUFBRSxhQUFLLENBQUMsTUFBTSxFQUFFLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztJQUNyQyxVQUFVLEVBQUUsYUFBSyxDQUFDLE1BQU0sRUFBRSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUM7SUFDeEMscUJBQXFCLEVBQUUsYUFBSyxDQUFDLE1BQU0sRUFBRSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7SUFDOUM7Ozs7OztPQU1HO0lBQ0gsT0FBTyxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUU7Q0FDbkMsQ0FBQyxDQUFDO0FBRUgsa0JBQWUsdUJBQWUsQ0FBQyJ9