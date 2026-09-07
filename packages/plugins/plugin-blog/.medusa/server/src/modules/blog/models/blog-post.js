"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlogPost = void 0;
const utils_1 = require("@medusajs/framework/utils");
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
exports.BlogPost = utils_1.model
    .define('blog_post', {
    id: utils_1.model.id({ prefix: 'bpost' }).primaryKey(),
    title: utils_1.model.text(),
    slug: utils_1.model.text(),
    excerpt: utils_1.model.text().nullable(),
    cover_image: utils_1.model.json().nullable(),
    content: utils_1.model.json().nullable(),
    status: utils_1.model.text().default('draft'),
    category_id: utils_1.model.text().nullable(),
    seo_title: utils_1.model.text().nullable(),
    seo_description: utils_1.model.text().nullable(),
    published_at: utils_1.model.dateTime().nullable(),
    // Segmentación por sales channel: array de ids. null/[] = visible en todos
    // los canales (global). En contexto demo el storefront pide solo los posts
    // cuyo array incluye el canal de la demo.
    sales_channel_ids: utils_1.model.json().nullable(),
    metadata: utils_1.model.json().nullable(),
})
    .indexes([
    { on: ['slug'], unique: true, where: 'deleted_at IS NULL' },
    { on: ['status'] },
    { on: ['category_id'] },
    { on: ['published_at'] },
    { on: ['status', 'slug'] },
]);
exports.default = exports.BlogPost;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmxvZy1wb3N0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL21vZHVsZXMvYmxvZy9tb2RlbHMvYmxvZy1wb3N0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHFEQUFrRDtBQUVsRDs7Ozs7Ozs7Ozs7R0FXRztBQUNVLFFBQUEsUUFBUSxHQUFHLGFBQUs7S0FDMUIsTUFBTSxDQUFDLFdBQVcsRUFBRTtJQUNuQixFQUFFLEVBQUUsYUFBSyxDQUFDLEVBQUUsQ0FBQyxFQUFFLE1BQU0sRUFBRSxPQUFPLEVBQUUsQ0FBQyxDQUFDLFVBQVUsRUFBRTtJQUM5QyxLQUFLLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRTtJQUNuQixJQUFJLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRTtJQUNsQixPQUFPLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUNoQyxXQUFXLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUNwQyxPQUFPLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUNoQyxNQUFNLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUM7SUFDckMsV0FBVyxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDcEMsU0FBUyxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDbEMsZUFBZSxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDeEMsWUFBWSxFQUFFLGFBQUssQ0FBQyxRQUFRLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDekMsMkVBQTJFO0lBQzNFLDJFQUEyRTtJQUMzRSwwQ0FBMEM7SUFDMUMsaUJBQWlCLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUMxQyxRQUFRLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtDQUNsQyxDQUFDO0tBQ0QsT0FBTyxDQUFDO0lBQ1AsRUFBRSxFQUFFLEVBQUUsQ0FBQyxNQUFNLENBQUMsRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxvQkFBb0IsRUFBRTtJQUMzRCxFQUFFLEVBQUUsRUFBRSxDQUFDLFFBQVEsQ0FBQyxFQUFFO0lBQ2xCLEVBQUUsRUFBRSxFQUFFLENBQUMsYUFBYSxDQUFDLEVBQUU7SUFDdkIsRUFBRSxFQUFFLEVBQUUsQ0FBQyxjQUFjLENBQUMsRUFBRTtJQUN4QixFQUFFLEVBQUUsRUFBRSxDQUFDLFFBQVEsRUFBRSxNQUFNLENBQUMsRUFBRTtDQUMzQixDQUFDLENBQUM7QUFFTCxrQkFBZSxnQkFBUSxDQUFDIn0=