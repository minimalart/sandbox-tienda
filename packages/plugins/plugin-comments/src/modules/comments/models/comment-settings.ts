import { model } from '@medusajs/framework/utils';

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
export const CommentSettings = model.define('comment_settings', {
  id: model.id({ prefix: 'cset' }).primaryKey(),
  enabled: model.boolean().default(true),
  review_mode: model.enum(['comment', 'rating', 'both']).default('both'),
  // Max rating value; ratings are validated against 1..rating_scale.
  rating_scale: model.number().default(5),
  who_can_comment: model
    .enum(['registered', 'verified_buyer'])
    .default('registered'),
  moderation: model.enum(['auto', 'manual']).default('auto'),
  edit_window_minutes: model.number().default(15),
  min_length: model.number().default(5),
  max_length: model.number().default(2000),
  rate_limit_per_minute: model.number().default(5),
    /**
     * La tienda dueña de esta configuración. `NULL` = GLOBAL de la instancia, el
     * fallback de toda tienda que no defina la suya.
     *
     * Deja de ser un singleton: la unicidad pasa a ser por tienda y necesita DOS
     * índices parciales, porque en Postgres `NULL != NULL`.
     */
    site_id: model.text().nullable(),
});

export default CommentSettings;
