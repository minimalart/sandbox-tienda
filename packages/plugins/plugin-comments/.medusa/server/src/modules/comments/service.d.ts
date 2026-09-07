export type CommentableType = 'product' | 'blog_post';
export type ReviewMode = 'comment' | 'rating' | 'both';
export type CreateCommentInput = {
    commentable_type: CommentableType;
    commentable_id: string;
    customer_id: string;
    author_name?: string | null;
    rating?: number | null;
    content?: string | null;
    parent_id?: string | null;
    verified_buyer?: boolean;
    /**
     * La tienda desde la que se publicó. Tiene que estar en el tipo Y enumerarse abajo:
     * `createCommentModerated` arma el objeto campo por campo, así que un `site_id` que
     * sólo viaje en el input se descarta EN SILENCIO — el comentario nace global y la
     * cola de moderación filtrada ya no lo encuentra.
     */
    site_id?: string | null;
};
type SettingsLike = {
    review_mode: ReviewMode;
    rating_scale: number;
    moderation: 'auto' | 'manual';
    edit_window_minutes: number;
    min_length: number;
    max_length: number;
    rate_limit_per_minute: number;
};
declare const CommentsModuleService_base: import("@medusajs/framework/utils").MedusaServiceReturnType<import("@medusajs/framework/utils").ModelConfigurationsToConfigTemplate<{
    readonly Comment: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
        id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
        commentable_type: import("@medusajs/framework/utils").EnumProperty<["product", "blog_post"]>;
        commentable_id: import("@medusajs/framework/utils").TextProperty;
        parent_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        customer_id: import("@medusajs/framework/utils").TextProperty;
        author_name: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        rating: import("@medusajs/framework/utils").NullableModifier<number, import("@medusajs/framework/utils").NumberProperty>;
        content: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        status: import("@medusajs/framework/utils").EnumProperty<["pending", "approved", "hidden", "deleted"]>;
        verified_buyer: import("@medusajs/framework/utils").BooleanProperty;
        edited_at: import("@medusajs/framework/utils").NullableModifier<Date, import("@medusajs/framework/utils").DateTimeProperty>;
        published_at: import("@medusajs/framework/utils").NullableModifier<Date, import("@medusajs/framework/utils").DateTimeProperty>;
        site_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    }>, "comment">;
    readonly CommentSettings: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
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
        site_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    }>, "comment_settings">;
}>>;
declare class CommentsModuleService extends CommentsModuleService_base {
    /** Returns the singleton settings row, creating defaults on first access. */
    /**
     * La configuración EFECTIVA de una tienda: la suya si la definió, la global si no.
     *
     * La creación perezosa es SIEMPRE sobre la fila global. Crear una por tienda la
     * primera vez que alguien mira la pantalla congelaría los defaults de ese momento,
     * y a partir de ahí cambiar el global ya no se propagaría a esa tienda.
     */
    getSettings(siteId?: string | null): Promise<{
        id: string;
        enabled: boolean;
        review_mode: "comment" | "rating" | "both";
        rating_scale: number;
        who_can_comment: "verified_buyer" | "registered";
        moderation: "auto" | "manual";
        edit_window_minutes: number;
        min_length: number;
        max_length: number;
        rate_limit_per_minute: number;
        site_id: string | null;
        created_at: Date;
        updated_at: Date;
        deleted_at: Date | null;
    }>;
    /**
     * Guarda la configuración de UNA tienda, creando su fila si no existe.
     *
     * Parte del valor EFECTIVO, no de los defaults: el operador abre la pantalla, ve el
     * heredado, cambia un campo y espera que el resto quede como lo veía.
     */
    upsertSettingsForSite(siteId: string | null, values: Record<string, unknown>): Promise<{
        id: string;
        enabled: boolean;
        review_mode: "comment" | "rating" | "both";
        rating_scale: number;
        who_can_comment: "verified_buyer" | "registered";
        moderation: "auto" | "manual";
        edit_window_minutes: number;
        min_length: number;
        max_length: number;
        rate_limit_per_minute: number;
        site_id: string | null;
        created_at: Date;
        updated_at: Date;
        deleted_at: Date | null;
    }>;
    /** Upserts the singleton settings row. */
    updateSettings(data: Record<string, unknown>): Promise<{
        id: string;
        enabled: boolean;
        review_mode: "comment" | "rating" | "both";
        rating_scale: number;
        who_can_comment: "verified_buyer" | "registered";
        moderation: "auto" | "manual";
        edit_window_minutes: number;
        min_length: number;
        max_length: number;
        rate_limit_per_minute: number;
        site_id: string | null;
        created_at: Date;
        updated_at: Date;
        deleted_at: Date | null;
    }>;
    /**
     * Validates an incoming comment against the global settings: review_mode
     * (rating and/or content required), rating range, content length, rate limit
     * and flood control. Throws a MedusaError on the first violation.
     */
    validateForCreate(input: CreateCommentInput, settings: SettingsLike): Promise<void>;
    /**
     * Creates a comment applying moderation policy: 'auto' publishes immediately
     * (status=approved, published_at=now), 'manual' leaves it pending.
     */
    createCommentModerated(input: CreateCommentInput, settings: SettingsLike): Promise<{
        id: string;
        commentable_type: "product" | "blog_post";
        commentable_id: string;
        parent_id: string | null;
        customer_id: string;
        author_name: string | null;
        rating: number | null;
        content: string | null;
        status: "pending" | "approved" | "hidden" | "deleted";
        verified_buyer: boolean;
        edited_at: Date | null;
        published_at: Date | null;
        site_id: string | null;
        raw_rating: Record<string, unknown> | null;
        created_at: Date;
        updated_at: Date;
        deleted_at: Date | null;
    }>;
    approve(id: string): Promise<{
        id: string;
        commentable_type: "product" | "blog_post";
        commentable_id: string;
        parent_id: string | null;
        customer_id: string;
        author_name: string | null;
        rating: number | null;
        content: string | null;
        status: "pending" | "approved" | "hidden" | "deleted";
        verified_buyer: boolean;
        edited_at: Date | null;
        published_at: Date | null;
        site_id: string | null;
        raw_rating: Record<string, unknown> | null;
        created_at: Date;
        updated_at: Date;
        deleted_at: Date | null;
    }>;
    hide(id: string): Promise<{
        id: string;
        commentable_type: "product" | "blog_post";
        commentable_id: string;
        parent_id: string | null;
        customer_id: string;
        author_name: string | null;
        rating: number | null;
        content: string | null;
        status: "pending" | "approved" | "hidden" | "deleted";
        verified_buyer: boolean;
        edited_at: Date | null;
        published_at: Date | null;
        site_id: string | null;
        raw_rating: Record<string, unknown> | null;
        created_at: Date;
        updated_at: Date;
        deleted_at: Date | null;
    }>;
    /** Soft-delete: keeps the row so replies can still render a tombstone. */
    softDelete(id: string): Promise<{
        id: string;
        commentable_type: "product" | "blog_post";
        commentable_id: string;
        parent_id: string | null;
        customer_id: string;
        author_name: string | null;
        rating: number | null;
        content: string | null;
        status: "pending" | "approved" | "hidden" | "deleted";
        verified_buyer: boolean;
        edited_at: Date | null;
        published_at: Date | null;
        site_id: string | null;
        raw_rating: Record<string, unknown> | null;
        created_at: Date;
        updated_at: Date;
        deleted_at: Date | null;
    }>;
    /**
     * Approved-comment aggregate for an entity: average rating (rounded to 1
     * decimal) and the count of approved top-level comments.
     */
    getAggregate(type: CommentableType, id: string): Promise<{
        total: number;
        rating_count: number;
        average_rating: number | null;
    }>;
}
export default CommentsModuleService;
