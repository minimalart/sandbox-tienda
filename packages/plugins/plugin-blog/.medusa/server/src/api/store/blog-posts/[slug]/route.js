"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const blog_1 = require("../../../../modules/blog");
const helpers_1 = require("../helpers");
/**
 * GET /store/blog-posts/:slug — public, single PUBLISHED post by slug, plus its
 * ordered product ids and up to 4 related posts (same category). 404 when not
 * found/published. `?preview=true` also resolves drafts (used by the admin's
 * "Vista previa"); guard behind the admin in production if drafts are sensitive.
 */
async function GET(req, res) {
    try {
        const service = req.scope.resolve(blog_1.BLOG_MODULE);
        const preview = req.query.preview === 'true' || req.query.preview === '1';
        const salesChannelId = typeof req.query.sales_channel_id === 'string'
            ? req.query.sales_channel_id
            : undefined;
        const strict = (0, helpers_1.readStrictFlag)(req.query);
        const filters = { slug: req.params.slug };
        if (!preview) {
            filters.status = 'published';
        }
        const [post] = await service.listBlogPosts(filters, { take: 1 });
        if (!post) {
            return res.status(404).json({ message: 'Blog post not found' });
        }
        // El artículo no debe abrirse por URL directa en un canal donde no es
        // visible (p.ej. un artículo scopeado a una demo, en el store principal).
        // La preview del admin (sin canal) siempre pasa.
        if (!preview &&
            !(0, helpers_1.isPostInSalesChannel)(post, salesChannelId, strict)) {
            return res.status(404).json({ message: 'Blog post not found' });
        }
        const product_ids = await service.getPostProductIds(post.id);
        let related = [];
        if (post.category_id) {
            const candidates = await service.listBlogPosts({
                status: 'published',
                category_id: post.category_id,
            }, { take: 20, order: { published_at: 'DESC' } });
            related = candidates
                .filter((p) => p.id !== post.id)
                // Solo relacionados visibles en el canal que pide (ver isPostInSalesChannel).
                .filter((p) => (0, helpers_1.isPostInSalesChannel)(p, salesChannelId, strict))
                .slice(0, 4)
                .map(helpers_1.toPublicBlogCard);
        }
        return res.status(200).json({
            blog_post: (0, helpers_1.toPublicBlogPost)(post),
            product_ids,
            related_posts: related,
        });
    }
    catch (error) {
        console.error('[Store BlogPosts] Error fetching post:', error);
        return res.status(404).json({ message: 'Blog post not found' });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL3N0b3JlL2Jsb2ctcG9zdHMvW3NsdWddL3JvdXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBZ0JBLGtCQTZEQztBQTVFRCxtREFBdUQ7QUFFdkQsd0NBS29CO0FBRXBCOzs7OztHQUtHO0FBQ0ksS0FBSyxVQUFVLEdBQUcsQ0FBQyxHQUFrQixFQUFFLEdBQW1CO0lBQy9ELElBQUksQ0FBQztRQUNILE1BQU0sT0FBTyxHQUFzQixHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxrQkFBVyxDQUFDLENBQUM7UUFDbEUsTUFBTSxPQUFPLEdBQ1gsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLEtBQUssTUFBTSxJQUFJLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxLQUFLLEdBQUcsQ0FBQztRQUM1RCxNQUFNLGNBQWMsR0FDbEIsT0FBTyxHQUFHLENBQUMsS0FBSyxDQUFDLGdCQUFnQixLQUFLLFFBQVE7WUFDNUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsZ0JBQWdCO1lBQzVCLENBQUMsQ0FBQyxTQUFTLENBQUM7UUFDaEIsTUFBTSxNQUFNLEdBQUcsSUFBQSx3QkFBYyxFQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUV6QyxNQUFNLE9BQU8sR0FBNEIsRUFBRSxJQUFJLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUNuRSxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDYixPQUFPLENBQUMsTUFBTSxHQUFHLFdBQVcsQ0FBQztRQUMvQixDQUFDO1FBRUQsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLE1BQU0sT0FBTyxDQUFDLGFBQWEsQ0FBQyxPQUFPLEVBQUUsRUFBRSxJQUFJLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUNqRSxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDVixPQUFPLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxFQUFFLHFCQUFxQixFQUFFLENBQUMsQ0FBQztRQUNsRSxDQUFDO1FBRUQsc0VBQXNFO1FBQ3RFLDBFQUEwRTtRQUMxRSxpREFBaUQ7UUFDakQsSUFDRSxDQUFDLE9BQU87WUFDUixDQUFDLElBQUEsOEJBQW9CLEVBQUMsSUFBMkIsRUFBRSxjQUFjLEVBQUUsTUFBTSxDQUFDLEVBQzFFLENBQUM7WUFDRCxPQUFPLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxFQUFFLHFCQUFxQixFQUFFLENBQUMsQ0FBQztRQUNsRSxDQUFDO1FBRUQsTUFBTSxXQUFXLEdBQUcsTUFBTSxPQUFPLENBQUMsaUJBQWlCLENBQ2hELElBQXVCLENBQUMsRUFBRSxDQUM1QixDQUFDO1FBRUYsSUFBSSxPQUFPLEdBQTBCLEVBQUUsQ0FBQztRQUN4QyxJQUFLLElBQWlDLENBQUMsV0FBVyxFQUFFLENBQUM7WUFDbkQsTUFBTSxVQUFVLEdBQUcsTUFBTSxPQUFPLENBQUMsYUFBYSxDQUM1QztnQkFDRSxNQUFNLEVBQUUsV0FBVztnQkFDbkIsV0FBVyxFQUFHLElBQWdDLENBQUMsV0FBVzthQUMzRCxFQUNELEVBQUUsSUFBSSxFQUFFLEVBQUUsRUFBRSxLQUFLLEVBQUUsRUFBRSxZQUFZLEVBQUUsTUFBTSxFQUFFLEVBQUUsQ0FDOUMsQ0FBQztZQUNGLE9BQU8sR0FBSSxVQUFvQztpQkFDNUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxLQUFNLElBQXVCLENBQUMsRUFBRSxDQUFDO2dCQUNwRCw4RUFBOEU7aUJBQzdFLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsSUFBQSw4QkFBb0IsRUFBQyxDQUFDLEVBQUUsY0FBYyxFQUFFLE1BQU0sQ0FBQyxDQUFDO2lCQUM5RCxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQztpQkFDWCxHQUFHLENBQUMsMEJBQWdCLENBQUMsQ0FBQztRQUMzQixDQUFDO1FBRUQsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQztZQUMxQixTQUFTLEVBQUUsSUFBQSwwQkFBZ0IsRUFBQyxJQUEyQixDQUFDO1lBQ3hELFdBQVc7WUFDWCxhQUFhLEVBQUUsT0FBTztTQUN2QixDQUFDLENBQUM7SUFDTCxDQUFDO0lBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztRQUNmLE9BQU8sQ0FBQyxLQUFLLENBQUMsd0NBQXdDLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDL0QsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxDQUFDLENBQUM7SUFDbEUsQ0FBQztBQUNILENBQUMifQ==