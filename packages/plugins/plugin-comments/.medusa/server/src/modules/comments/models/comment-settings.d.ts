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
export declare const CommentSettings: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
    id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
    enabled: import("@medusajs/framework/utils").BooleanProperty;
    review_mode: import("@medusajs/framework/utils").EnumProperty<["comment", "rating", "both"]>;
    rating_scale: import("@medusajs/framework/utils").NumberProperty;
    who_can_comment: import("@medusajs/framework/utils").EnumProperty<["registered", "verified_buyer"]>;
    moderation: import("@medusajs/framework/utils").EnumProperty<["auto", "manual"]>;
    edit_window_minutes: import("@medusajs/framework/utils").NumberProperty;
    min_length: import("@medusajs/framework/utils").NumberProperty;
    max_length: import("@medusajs/framework/utils").NumberProperty;
    rate_limit_per_minute: import("@medusajs/framework/utils").NumberProperty;
    /**
     * La tienda dueña de esta configuración. `NULL` = GLOBAL de la instancia, el
     * fallback de toda tienda que no defina la suya.
     *
     * Deja de ser un singleton: la unicidad pasa a ser por tienda y necesita DOS
     * índices parciales, porque en Postgres `NULL != NULL`.
     */
    site_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
}>, "comment_settings">;
export default CommentSettings;
