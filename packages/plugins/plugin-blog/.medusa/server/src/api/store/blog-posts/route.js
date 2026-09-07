"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const blog_1 = require("../../../modules/blog");
const helpers_1 = require("./helpers");
/**
 * GET /store/blog-posts — public, PUBLISHED posts only. Supports `category_id`,
 * `q`, `limit`/`offset`. Ordered by published_at desc. Returns card projections
 * (no body) to keep the list response light.
 */
async function GET(req, res) {
    try {
        const service = req.scope.resolve(blog_1.BLOG_MODULE);
        const limit = req.query.limit ? Number(req.query.limit) : 12;
        const offset = req.query.offset ? Number(req.query.offset) : 0;
        const category_id = typeof req.query.category_id === 'string'
            ? req.query.category_id
            : undefined;
        const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
        const salesChannelId = typeof req.query.sales_channel_id === 'string'
            ? req.query.sales_channel_id
            : undefined;
        const strict = (0, helpers_1.readStrictFlag)(req.query);
        const filters = { status: 'published' };
        if (category_id) {
            filters.category_id = category_id;
        }
        if (q) {
            filters.$or = [
                { title: { $ilike: `%${q}%` } },
                { excerpt: { $ilike: `%${q}%` } },
            ];
        }
        // El canal filtra por pertenencia a sales_channel_ids (ver
        // isPostInSalesChannel). Como es un array JSON, traemos los publicados que
        // matchean (sin paginar en DB) y paginamos en JS. Los blogs son pocos, así
        // que es barato. Sin canal (callers legacy) mantenemos la query paginada en
        // DB, sin cambios.
        if (salesChannelId) {
            const [all] = await service.listAndCountBlogPosts(filters, {
                order: { published_at: 'DESC' },
            });
            const scoped = all.filter((post) => (0, helpers_1.isPostInSalesChannel)(post, salesChannelId, strict));
            const paged = scoped.slice(offset, offset + limit);
            return res.status(200).json({
                blog_posts: paged.map(helpers_1.toPublicBlogCard),
                count: scoped.length,
                limit,
                offset,
            });
        }
        const [posts, count] = await service.listAndCountBlogPosts(filters, {
            skip: offset,
            take: limit,
            order: { published_at: 'DESC' },
        });
        return res.status(200).json({
            blog_posts: posts.map(helpers_1.toPublicBlogCard),
            count,
            limit,
            offset,
        });
    }
    catch (error) {
        console.error('[Store BlogPosts] Error listing posts:', error);
        return res.status(500).json({ message: 'Error fetching blog posts' });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL3N0b3JlL2Jsb2ctcG9zdHMvcm91dGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFjQSxrQkFnRUM7QUE3RUQsZ0RBQW9EO0FBRXBELHVDQUltQjtBQUVuQjs7OztHQUlHO0FBQ0ksS0FBSyxVQUFVLEdBQUcsQ0FBQyxHQUFrQixFQUFFLEdBQW1CO0lBQy9ELElBQUksQ0FBQztRQUNILE1BQU0sT0FBTyxHQUFzQixHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxrQkFBVyxDQUFDLENBQUM7UUFDbEUsTUFBTSxLQUFLLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7UUFDN0QsTUFBTSxNQUFNLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDL0QsTUFBTSxXQUFXLEdBQ2YsT0FBTyxHQUFHLENBQUMsS0FBSyxDQUFDLFdBQVcsS0FBSyxRQUFRO1lBQ3ZDLENBQUMsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLFdBQVc7WUFDdkIsQ0FBQyxDQUFDLFNBQVMsQ0FBQztRQUNoQixNQUFNLENBQUMsR0FBRyxPQUFPLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztRQUNwRSxNQUFNLGNBQWMsR0FDbEIsT0FBTyxHQUFHLENBQUMsS0FBSyxDQUFDLGdCQUFnQixLQUFLLFFBQVE7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