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
/** GET /admin/blog-categories/:id */
async function GET(req, res) {
    // Todos los handlers: borrar la categoría de otra tienda deja sus posts
    // publicados apuntando a nada.
    await (0, scope_1.assertIdInSite)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.BLOG_CATEGORY_SITE_SCOPE, req.params.id);
    const service = req.scope.resolve(blog_1.BLOG_MODULE);
    try {
        const blog_category = await service.retrieveBlogCategory(req.params.id);
        return res.status(200).json({ blog_category });
    }
    catch {
        return res.status(404).json({ message: 'Blog category not found' });
    }
}
/** POST /admin/blog-categories/:id — partial update. */
async function POST(req, res) {
    // Todos los handlers: borrar la categoría de otra tienda deja sus posts
    // publicados apuntando a nada.
    await (0, scope_1.assertIdInSite)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.BLOG_CATEGORY_SITE_SCOPE, req.params.id);
    try {
        const validated = validators_1.PostAdminUpdateBlogCategory.parse(req.body);
        const service = req.scope.resolve(blog_1.BLOG_MODULE);
        const id = req.params.id;
        const { slug, ...rest } = validated;
        const next = { id, ...rest };
        if (slug !== undefined) {
            next.slug = await service.ensureUniqueCategorySlug(slug, id);
        }
        const blog_category = await service.updateBlogCategories(next);
        return res.status(200).json({ blog_category });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Error updating blog category';
        return res.status(400).json({ message });
    }
}
/** DELETE /admin/blog-categories/:id — soft-delete. */
async function DELETE(req, res) {
    // Todos los handlers: borrar la categoría de otra tienda deja sus posts
    // publicados apuntando a nada.
    await (0, scope_1.assertIdInSite)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.BLOG_CATEGORY_SITE_SCOPE, req.params.id);
    const service = req.scope.resolve(blog_1.BLOG_MODULE);
    try {
        const id = req.params.id;
        await service.softDeleteBlogCategories(id);
        return res.status(200).json({ id, object: 'blog_category', deleted: true });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Error deleting blog category';
        return res.status(400).json({ message });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2Jsb2ctY2F0ZWdvcmllcy9baWRdL3JvdXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBVUEsa0JBY0M7QUFHRCxvQkFxQkM7QUFHRCx3QkFlQztBQWpFRCxtREFBdUQ7QUFFdkQsOENBQTREO0FBRTVELGdFQUFxRTtBQUNyRSw0REFBa0U7QUFDbEUsb0VBQStFO0FBRS9FLHFDQUFxQztBQUM5QixLQUFLLFVBQVUsR0FBRyxDQUFDLEdBQWtCLEVBQUUsR0FBbUI7SUFDL0Qsd0VBQXdFO0lBQ3hFLCtCQUErQjtJQUMvQixNQUFNLElBQUEsc0JBQWMsRUFBQyxHQUFHLENBQUMsS0FBSyxFQUFFLE1BQU0sSUFBQSx5QkFBZSxFQUFDLEdBQUcsQ0FBQyxFQUFFLHFDQUF3QixFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBWSxDQUFDLENBQUM7SUFFL0csTUFBTSxPQUFPLEdBQXNCLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLGtCQUFXLENBQUMsQ0FBQztJQUNsRSxJQUFJLENBQUM7UUFDSCxNQUFNLGFBQWEsR0FBRyxNQUFNLE9BQU8sQ0FBQyxvQkFBb0IsQ0FDdEQsR0FBRyxDQUFDLE1BQU0sQ0FBQyxFQUFZLENBQ3hCLENBQUM7UUFDRixPQUFPLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsYUFBYSxFQUFFLENBQUMsQ0FBQztJQUNqRCxDQUFDO0lBQUMsTUFBTSxDQUFDO1FBQ1AsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQU8sRUFBRSx5QkFBeUIsRUFBRSxDQUFDLENBQUM7SUFDdEUsQ0FBQztBQUNILENBQUM7QUFFRCx3REFBd0Q7QUFDakQsS0FBSyxVQUFVLElBQUksQ0FBQyxHQUFrQixFQUFFLEdB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