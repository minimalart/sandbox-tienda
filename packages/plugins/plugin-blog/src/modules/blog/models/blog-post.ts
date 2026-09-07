import { model } from '@medusajs/framework/utils';

/**
 * BlogPost — an editorial article authored with the Tiptap editor.
 *
 * - `content`: Tiptap's native JSON document. Source of truth for rendering;
 *   the storefront converts it to sanitized HTML server-side (SEO-friendly SSR).
 * - `cover_image`: { url, file_id, alt } JSON (mirrors the brand-image shape).
 * - `seo_title` / `seo_description`: per-article SEO overrides.
 * - `status`: 'draft' | 'published'. Drafts are never exposed publicly.
 *
 * Related products are stored out-of-band in `blog_post_product` (a separate
 * link table) so the catalog is referenced by id, never embedded in content.
 */
export const BlogPost = model
  .define('blog_post', {
    id: model.id({ prefix: 'bpost' }).primaryKey(),
    title: model.text(),
    slug: model.text(),
    excerpt: model.text().nullable(),
    cover_image: model.json().nullable(),
    content: model.json().nullable(),
    status: model.text().default('draft'),
    category_id: model.text().nullable(),
    seo_title: model.text().nullable(),
    seo_description: model.text().nullable(),
    published_at: model.dateTime().nullable(),
    // Segmentación por sales channel: array de ids. null/[] = visible en todos
    // los canales (global). En contexto demo el storefront pide solo los posts
    // cuyo array incluye el canal de la demo.
    sales_channel_ids: model.json().nullable(),
    metadata: model.json().nullable(),
  })
  .indexes([
    { on: ['slug'], unique: true, where: 'deleted_at IS NULL' },
    { on: ['status'] },
    { on: ['category_id'] },
    { on: ['published_at'] },
    { on: ['status', 'slug'] },
  ]);

export default BlogPost;
