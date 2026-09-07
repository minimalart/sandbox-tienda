import { renderBlogContentHtml } from '../../../modules/blog/render';

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
export function isPostInSalesChannel(
  post: Record<string, any>,
  salesChannelId: string | undefined,
  strict = false,
): boolean {
  if (!salesChannelId) return true;
  const ids = post.sales_channel_ids;
  const scoped = Array.isArray(ids) && ids.length > 0;
  if (scoped) return (ids as string[]).includes(salesChannelId);
  return !strict;
}

/** Reads the `strict` query flag shared by the store blog routes. */
export function readStrictFlag(query: Record<string, unknown>): boolean {
  return query.strict === '1' || query.strict === 'true';
}

/** Public list-card projection of a post (no internal/audit fields, no body). */
export function toPublicBlogCard(post: Record<string, any>) {
  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt ?? null,
    cover_image: post.cover_image ?? null,
    category_id: post.category_id ?? null,
    published_at: post.published_at ?? null,
    updated_at: post.updated_at ?? null,
  };
}

/** Public detail projection — includes rendered, sanitized content HTML. */
export function toPublicBlogPost(post: Record<string, any>) {
  return {
    ...toPublicBlogCard(post),
    seo_title: post.seo_title ?? null,
    seo_description: post.seo_description ?? null,
    content: post.content ?? null,
    content_html: renderBlogContentHtml(post.content),
    metadata: post.metadata ?? null,
  };
}

/** Public projection of a category. */
export function toPublicBlogCategory(category: Record<string, any>) {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description ?? null,
    image: category.image ?? null,
    sort_order: category.sort_order ?? 0,
  };
}
