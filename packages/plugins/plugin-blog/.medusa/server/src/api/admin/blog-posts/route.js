"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
const blog_1 = require("../../../modules/blog");
const validators_1 = require("./validators");
const request_1 = require("../../../lib/multistore/request");
const scope_1 = require("../../../lib/multistore/scope");
const site_scope_1 = require("../../../modules/blog/site-scope");
/**
 * GET /admin/blog-posts — paginated list (limit, offset, status, category_id, q).
 * `q` matches title/excerpt/slug case-insensitively. Newest first.
 */
async function GET(req, res) {
    try {
        const service = req.scope.resolve(blog_1.BLOG_MODULE);
        const limit = req.query.limit ? Number(req.query.limit) : 20;
        const offset = req.query.offset ? Number(req.query.offset) : 0;
        const status = typeof req.query.status === 'string' ? req.query.status : undefined;
        const category_id = typeof req.query.category_id === 'string'
            ? req.query.category_id
            : undefined;
        const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
        const [blog_posts, count] = await service.searchPosts(q, {
            status,
            category_id,
            limit,
            offset,
            extraFilters: await (0, scope_1.siteFilter)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.BLOG_POST_SITE_SCOPE),
        });
        return res.status(200).json({ blog_posts, count, limit, offset });
    }
    catch (error) {
        console.error('[Admin BlogPosts] Error listing posts:', error);
        return res.status(500).json({ message: 'Error fetching blog posts' });
    }
}
/** POST /admin/blog-posts — create a post. Slug generated from title when omitted. */
async function POST(req, res) {
    try {
        const validated = validators_1.PostAdminCreateBlogPost.parse(req.body);
        const service = req.scope.resolve(blog_1.BLOG_MODULE);
        const slug = await service.ensureUniquePostSlug(validated.slug || validated.title);
        // Sin canales explícitos, el post nace en la tienda activa.
        const channels = validated.sales_channel_ids === undefined
            ? (0, scope_1.siteDefaults)(await (0, request_1.siteFromRequest)(req), site_scope_1.BLOG_POST_SITE_SCOPE)
            : {};
        const blog_post = await service.createBlogPosts({
            ...validated,
            ...channels,
            slug,
            cover_image: (validated.cover_image ?? null),
            content: (validated.content ?? null),
            // sales_channel_ids: array en columna model.json() (tipada como Record).
            sales_channel_ids: (validated.sales_channel_ids ?? null),
            published_at: validated.status === 'published' ? new Date() : null,
        });
        return res.status(201).json({ blog_post });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Error creating blog post';
        console.error('[Admin BlogPosts] Error creating post:', message);
        return res.status(400).json({ message });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2Jsb2ctcG9zdHMvcm91dGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFZQSxrQkEwQkM7QUFHRCxvQkFxQ0M7QUE3RUQsZ0RBQW9EO0FBRXBELDZDQUF1RDtBQUN2RCw2REFBa0U7QUFDbEUseURBQXlFO0FBQ3pFLGlFQUF3RTtBQUV4RTs7O0dBR0c7QUFDSSxLQUFLLFVBQVUsR0FBRyxDQUFDLEdBQWtCLEVBQUUsR0FBbUI7SUFDL0QsSUFBSSxDQUFDO1FBQ0gsTUFBTSxPQUFPLEdBQXNCLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLGtCQUFXLENBQUMsQ0FBQztRQUNsRSxNQUFNLEtBQUssR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztRQUM3RCxNQUFNLE1BQU0sR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUMvRCxNQUFNLE1BQU0sR0FDVixPQUFPLEdBQUcsQ0FBQyxLQUFLLENBQUMsTUFBTSxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztRQUN0RSxNQUFNLFdBQVcsR0FDZixPQUFPLEdBQUcsQ0FBQyxLQUFLLENBQUMsV0FBVyxLQUFLLFFBQVE7WUFDdkMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsV0FBVztZQUN2QixDQUFDLENBQUMsU0FBUyxDQUFDO1FBQ2hCLE1BQU0sQ0FBQyxHQUFHLE9BQU8sR0FB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