type SearchPostsOptions = {
    status?: string;
    category_id?: string;
    limit?: number;
    offset?: number;
    /**
     * Filtro extra ya resuelto por el llamador — hoy sólo el de tienda activa
     * (`siteFilter` de `lib/multistore`). Se mergea DENTRO de listAndCount para que
     * `count` siga coincidiendo con lo paginado.
     */
    extraFilters?: Record<string, unknown>;
};
declare const BlogModuleService_base: import("@medusajs/framework/utils").MedusaServiceReturnType<import("@medusajs/framework/utils").ModelConfigurationsToConfigTemplate<{
    readonly BlogPost: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
        id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
        title: import("@medusajs/framework/utils").TextProperty;
        slug: import("@medusajs/framework/utils").TextProperty;
        excerpt: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        cover_image: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
        content: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
        status: import("@medusajs/framework/utils").TextProperty;
        category_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        seo_title: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        seo_description: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        published_at: import("@medusajs/framework/utils").NullableModifier<Date, import("@medusajs/framework/utils").DateTimeProperty>;
        sales_channel_ids: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
        metadata: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
    }>, "blog_post">;
    readonly BlogCategory: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
        id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
        name: import("@medusajs/framework/utils").TextProperty;
        slug: import("@medusajs/framework/utils").TextProperty;
        description: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        image: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
        sort_order: import("@medusajs/framework/utils").NumberProperty;
        site_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    }>, "blog_category">;
    readonly BlogPostProduct: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
        id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
        blog_post_id: import("@medusajs/framework/utils").TextProperty;
        product_id: import("@medusajs/framework/utils").TextProperty;
        sort_order: import("@medusajs/framework/utils").NumberProperty;
    }>, "blog_post_product">;
    readonly BlogSettings: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
        id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
        section_name: import("@medusajs/framework/utils").TextProperty;
        show_search: import("@medusajs/framework/utils").BooleanProperty;
        show_categories: import("@medusajs/framework/utils").BooleanProperty;
        posts_per_page: import("@medusajs/framework/utils").NumberProperty;
        default_seo_title: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        default_seo_description: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        metadata: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
        site_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    }>, "blog_settings">;
}>>;
declare class BlogModuleService extends BlogModuleService_base {
    /** URL-safe slug from a title (accent-folded, lowercased, hyphenated). */
    generateSlug(title: string): string;
    /** Returns a slug not used by another (non-deleted) post. */
    ensureUniquePostSlug(slug: string, excludeId?: string): Promise<string>;
    /** Returns a slug not used by another (non-deleted) category. */
    ensureUniqueCategorySlug(slug: string, excludeId?: string): Promise<string>;
    /** List + count posts with optional text search, status and category filters. */
    searchPosts(q: string | undefined, opts?: SearchPostsOptions): Promise<[{
        id: string;
        title: string;
        slug: string;
        excerpt: string | null;
        cover_image: Record<string, unknown> | null;
        content: Record<string, unknown> | null;
        status: string;
        category_id: string | null;
        seo_title: string | null;
        seo_description: string | null;
        published_at: Date | null;
        sales_channel_ids: Record<string, unknown> | null;
        metadata: Record<string, unknown> | null;
        created_at: Date;
        updated_at: Date;
        deleted_at: Date | null;
    }[], number]>;
    /** Returns the published post for a slug, or undefined. */
    getPublishedBySlug(slug: string): Promise<{
        id: string;
        title: string;
        slug: string;
        excerpt: string | null;
        cover_image: Record<string, unknown> | null;
        content: Record<string, unknown> | null;
        status: string;
        category_id: string | null;
        seo_title: string | null;
        seo_description: string | null;
        published_at: Date | null;
        sales_channel_ids: Record<string, unknown> | null;
        metadata: Record<string, unknown> | null;
        created_at: Date;
        updated_at: Date;
        deleted_at: Date | null;
    }>;
    /** Returns the linked product ids for a post, ordered by sort_order. */
    getPostProductIds(blogPostId: string): Promise<string[]>;
    /** Replaces a post's product associations with the given ordered ids. */
    setPostProducts(blogPostId: string, productIds: string[]): Promise<{
        id: string;
        blog_post_id: string;
        product_id: string;
        sort_order: number;
        created_at: Date;
        updated_at: Date;
        deleted_at: Date | null;
    }[]>;
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
        section_name: string;
        show_search: boolean;
        show_categories: boolean;
        posts_per_page: number;
        default_seo_title: string | null;
        default_seo_description: string | null;
        metadata: Record<string, unknown> | null;
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
        section_name: string;
        show_search: boolean;
        show_categories: boolean;
        posts_per_page: number;
        default_seo_title: string | null;
        default_seo_description: string | null;
        metadata: Record<string, unknown> | null;
        site_id: string | null;
        created_at: Date;
        updated_at: Date;
        deleted_at: Date | null;
    }>;
    /** Upserts the singleton settings row. */
    updateSettings(data: Record<string, unknown>): Promise<{
        id: string;
        section_name: string;
        show_search: boolean;
        show_categories: boolean;
        posts_per_page: number;
        default_seo_title: string | null;
        default_seo_description: string | null;
        metadata: Record<string, unknown> | null;
        site_id: string | null;
        created_at: Date;
        updated_at: Date;
        deleted_at: Date | null;
    }>;
}
export default BlogModuleService;
