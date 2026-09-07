"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPostInSalesChannel = isPostInSalesChannel;
exports.readStrictFlag = readStrictFlag;
exports.toPublicBlogCard = toPublicBlogCard;
exports.toPublicBlogPost = toPublicBlogPost;
exports.toPublicBlogCategory = toPublicBlogCategory;
const render_1 = require("../../../modules/blog/render");
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
function isPostInSalesChannel(post, salesChannelId, strict = false) {
    if (!salesChannelId)
        return true;
    const ids = post.sales_channel_ids;
    const scoped = Array.isArray(ids) && ids.length > 0;
    if (scoped)
        return ids.includes(salesChannelId);
    return !strict;
}
/** Reads the `strict` query flag shared by the store blog routes. */
function readStrictFlag(query) {
    return query.strict === '1' || query.strict === 'true';
}
/** Public list-card projection of a post (no internal/audit fields, no body). */
function toPublicBlogCard(post) {
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
function toPublicBlogPost(post) {
    return {
        ...toPublicBlogCard(post),
        seo_title: post.seo_title ?? null,
        seo_description: post.seo_description ?? null,
        content: post.content ?? null,
        content_html: (0, render_1.renderBlogContentHtml)(post.content),
        metadata: post.metadata ?? null,
    };
}
/** Public projection of a category. */
function toPublicBlogCategory(category) {
    return {
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description ?? null,
        image: category.image ?? null,
        sort_order: category.sort_order ?? 0,
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaGVscGVycy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9hcGkvc3RvcmUvYmxvZy1wb3N0cy9oZWxwZXJzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBYUEsb0RBVUM7QUFHRCx3Q0FFQztBQUdELDRDQVdDO0FBR0QsNENBU0M7QUFHRCxvREFTQztBQWxFRCx5REFBcUU7QUFFckU7Ozs7Ozs7Ozs7R0FVRztBQUNILFNBQWdCLG9CQUFvQixDQUNsQyxJQUF5QixFQUN6QixjQUFrQyxFQUNsQyxNQUFNLEdBQUcsS0FBSztJQUVkLElBQUksQ0FBQyxjQUFjO1FBQUUsT0FBTyxJQUFJLENBQUM7SUFDakMsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDO0lBQ25DLE1BQU0sTUFBTSxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksR0FBRyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUM7SUFDcEQsSUFBSSxNQUFNO1FBQUUsT0FBUSxHQUFnQixDQUFDLFFBQVEsQ0FBQyxjQUFjLENBQUMsQ0FBQztJQUM5RCxPQUFPLENBQUMsTUFBTSxDQUFDO0FBQ2pCLENBQUM7QUFFRCxxRUFBcUU7QUFDckUsU0FBZ0IsY0FBYyxDQUFDLEtBQThCO0lBQzNELE9BQU8sS0FBSyxDQUFDLE1BQU0sS0FBSyxHQUFHLElBQUksS0FBSyxDQUFDLE1BQU0sS0FBSyxNQUFNLENBQUM7QUFDekQsQ0FBQztBQUVELGlGQUFpRjtBQUNqRixTQUFnQixnQkFBZ0IsQ0FBQyxJQUF5QjtJQUN4RCxPQUFPO1FBQ0wsRUFBRSxFQUFFLElBQUksQ0FBQyxFQUFFO1FBQ1gsS0FBSyxFQUFFLElBQUksQ0FBQyxLQUFLO1FBQ2pCLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSTtRQUNmLE9BQU8sRUFBRSxJQUFJLENBQUMsT0FBTyxJQUFJLElBQUk7UUFDN0IsV0FBVyxFQUFFLElBQUksQ0FBQyxXQUFXLElBQUksSUFBSTtRQUNyQyxXQUFXLEVBQUUsSUFBSSxDQUFDLFdBQVcsSUFBSSxJQUFJO1FBQ3JDLFlBQVksRUFBRSxJQUFJLENBQUMsWUFBWSxJQUFJLElBQUk7UUFDdkMsVUFBVSxFQUFFLElBQUksQ0FBQyxVQUFVLElBQUksSUFBSTtLQUNwQyxDQUFDO0FBQ0osQ0FBQztBQUVELDRFQUE0RTtBQUM1RSxTQUFnQixnQkFBZ0IsQ0FBQyxJQUF5QjtJQUN4RCxPQUFPO1FBQ0wsR0FBRyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUM7UUFDekIsU0FBUyxFQUFFLElBQUksQ0FBQyxTQUFTLElBQUksSUFBSTtRQUNqQyxlQUFlLEVBQUUsSUFBSSxDQUFDLGVBQWUsSUFBSSxJQUFJO1FBQzdDLE9BQU8sRUFBRSxJQUFJLENBQUMsT0FBTyxJQUFJLElBQUk7UUFDN0IsWUFBWSxFQUFFLElBQUEsOEJBQXFCLEVBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQztRQUNqRCxRQUFRLEVBQUUsSUFBSSxDQUFDLFFBQVEsSUFBSSxJQUFJO0tBQ2hDLENBQUM7QUFDSixDQUFDO0FBRUQsdUNBQXVDO0FBQ3ZDLFNBQWdCLG9CQUFvQixDQUFDLFFBQTZCO0lBQ2hFLE9BQU87UUFDTCxFQUFFLEVBQUUsUUFBUSxDQUFDLEVBQUU7UUFDZixJQUFJLEVBQUUsUUFBUSxDQUFDLElBQUk7UUFDbkIsSUFBSSxFQUFFLFFBQVEsQ0FBQyxJQUFJO1FBQ25CLFdBQVcsRUFBRSxRQUFRLENBQUMsV0FBVyxJQUFJLElBQUk7UUFDekMsS0FBSyxFQUFFLFFBQVEsQ0FBQyxLQUFLLElBQUksSUFBSTtRQUM3QixVQUFVLEVBQUUsUUFBUSxDQUFDLFVBQVUsSUFBSSxDQUFDO0tBQ3JDLENBQUM7QUFDSixDQUFDIn0=