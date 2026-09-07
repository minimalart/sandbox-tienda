/**
 * Channel visibility for the public blog endpoints. `sales_channel_ids` on a
 * post is opt-in scoping:
 *   - empty/absent → global: visible in every channel (incl. the main store).
 *   - non-empty    → visible ONLY in the listed channels.
 *
 * `strict` (demo pages) drops the "global = visible" rule so a demo shows ONLY
 * the posts explicitly assigned to its channel, never the main store's globals
 * (see memory demo-content-config-and-channel: "estricto en demo"). Without a
 * channel (legacy callers) everything passes.
 */
export declare function isPostInSalesChannel(post: Record<string, any>, salesChannelId: string | undefined, strict?: boolean): boolean;
/** Reads the `strict` query flag shared by the store blog routes. */
export declare function readStrictFlag(query: Record<string, unknown>): boolean;
/** Public list-card projection of a post (no internal/audit fields, no body). */
export declare function toPublicBlogCard(post: Record<string, any>): {
    id: any;
    title: any;
    slug: any;
    excerpt: any;
    cover_image: any;
    category_id: any;
    published_at: any;
    updated_at: any;
};
/** Public detail projection — includes rendered, sanitized content HTML. */
export declare function toPublicBlogPost(post: Record<string, any>): {
    seo_title: any;
    seo_description: any;
    content: any;
    content_html: string;
    metadata: any;
    id: any;
    title: any;
    slug: any;
    excerpt: any;
    cover_image: any;
    category_id: any;
    published_at: any;
    updated_at: any;
};
/** Public projection of a category. */
export declare function toPublicBlogCategory(category: Record<string, any>): {
    id: any;
    name: any;
    slug: any;
    description: any;
    image: any;
    sort_order: any;
};
