"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
exports.DELETE = DELETE;
const blog_1 = require("../../../../modules/blog");
const validators_1 = require("../validators");
const request_1 = require("../../../../lib/multistore/request");
const scope_1 = require("../../../../lib/multistore/scope");
const site_scope_1 = require("../../../../modules/blog/site-scope");
/** GET /admin/blog-posts/:id — retrieve a post + its ordered product ids. */
async function GET(req, res) {
    const service = req.scope.resolve(blog_1.BLOG_MODULE);
    try {
        const id = req.params.id;
        const blog_post = await service.retrieveBlogPost(id);
        (0, scope_1.assertRowInSite)(blog_post, await (0, request_1.siteFromRequest)(req), site_scope_1.BLOG_POST_SITE_SCOPE);
        const product_ids = await service.getPostProductIds(id);
        return res.status(200).json({ blog_post, product_ids });
    }
    catch {
        return res.status(404).json({ message: 'Blog post not found' });
    }
}
/** POST /admin/blog-posts/:id — partial update. */
async function POST(req, res) {
    try {
        const validated = validators_1.PostAdminUpdateBlogPost.parse(req.body);
        const service = req.scope.resolve(blog_1.BLOG_MODULE);
        const id = req.params.id;
        const { slug, ...rest } = validated;
        const next = { id, ...rest };
        if (slug !== undefined) {
            next.slug = await service.ensureUniquePostSlug(slug, id);
        }
        // When transitioning to published and no published_at yet, stamp it.
        if (validated.status === 'published') {
            const current = await service.retrieveBlogPost(id);
            if (!current.published_at) {
                next.published_at = new Date();
            }
        }
        (0, scope_1.assertRowInSite)((await service.retrieveBlogPost(id)), await (0, request_1.siteFromRequest)(req), site_scope_1.BLOG_POST_SITE_SCOPE);
        const blog_post = await service.updateBlogPosts(next);
        return res.status(200).json({ blog_post });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Error updating blog post';
        console.error('[Admin BlogPosts] Error updating post:', message);
        return res.status(400).json({ message });
    }
}
/** DELETE /admin/blog-posts/:id — soft-delete (and its product links). */
async function DELETE(req, res) {
    const service = req.scope.resolve(blog_1.BLOG_MODULE);
    try {
        const id = req.params.id;
        await service.setPostProducts(id, []);
        (0, scope_1.assertRowInSite)((await service.retrieveBlogPost(id)), await (0, request_1.siteFromRequest)(req), site_scope_1.BLOG_POST_SITE_SCOPE);
        await service.softDeleteBlogPosts(id);
        return res
            .status(200)
            .json({ id, object: 'blog_post', deleted: true });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Error deleting blog post';
        return res.status(400).json({ message });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2Jsb2ctcG9zdHMvW2lkXS9yb3V0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQVNBLGtCQVdDO0FBR0Qsb0JBa0NDO0FBR0Qsd0JBb0JDO0FBL0VELG1EQUF1RDtBQUV2RCw4Q0FBd0Q7QUFDeEQsZ0VBQXFFO0FBQ3JFLDREQUFtRTtBQUNuRSxvRUFBMkU7QUFFM0UsNkVBQTZFO0FBQ3RFLEtBQUssVUFBVSxHQUFHLENBQUMsR0FBa0IsRUFBRSxHQUFtQjtJQUMvRCxNQUFNLE9BQU8sR0FBc0IsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsa0JBQVcsQ0FBQyxDQUFDO0lBQ2xFLElBQUksQ0FBQztRQUNILE1BQU0sRUFBRSxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBWSxDQUFDO1FBQ25DLE1BQU0sU0FBUyxHQUFHLE1BQU0sT0FBTyxDQUFDLGdCQUFnQixDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQ3JELElBQUEsdUJBQWUsRUFBQyxTQUFvQyxFQUFFLE1BQU0sSUFBQSx5QkFBZSxFQUFDLEdBQUcsQ0FBQyxFQUFFLGlDQUFvQixDQUFDLENBQUM7UUFDeEcsTUFBTSxXQUFXLEdBQUcsTUFBTSxPQUFPLENBQUMsaUJBQWlCLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDeEQsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLFNBQVMsRUFBRSxXQUFXLEVBQUUsQ0FBQyxDQUFDO0lBQzFELENBQUM7SUFBQyxNQUFNLENBQUM7UUFDUCxPQUFPLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxFQUFFLHFCQUFxQixFQUFFLENBQUMsQ0FBQztJQUNsRSxDQUFDO0FBQ0gsQ0FBQztBQUVELG1EQUFtRDtBQUM1QyxLQUFL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