"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const blog_1 = require("../../../modules/blog");
const helpers_1 = require("../blog-posts/helpers");
/**
 * GET /store/blog-categories — public list ordered by sort_order then name.
 * With `sales_channel_id` (demo context) devuelve SOLO las categorías que tienen
 * al menos un artículo publicado visible en ese canal (oculta las vacías).
 */
async function GET(req, res) {
    try {
        const service = req.scope.resolve(blog_1.BLOG_MODULE);
        const salesChannelId = typeof req.query.sales_channel_id === 'string'
            ? req.query.sales_channel_id
            : undefined;
        const strict = (0, helpers_1.readStrictFlag)(req.query);
        const categories = await service.listBlogCategories({}, { order: { sort_order: 'ASC', name: 'ASC' }, take: 200 });
        let visible = categories;
        if (salesChannelId) {
            // Categorías con posts en el canal: juntamos los category_id de los
            // publicados que pertenecen al canal y filtramos. Los blogs de una demo
            // son pocos, así que traer los publicados y filtrar en JS es barato.
            const [posts] = await service.listAndCountBlogPosts({ status: 'published' }, {});
            const categoryIdsInChannel = new Set(posts
                .filter((p) => (0, helpers_1.isPostInSalesChannel)(p, salesChannelId, strict))
                .map((p) => p.category_id)
                .filter(Boolean));
            visible = visible.filter((c) => categoryIdsInChannel.has(c.id));
        }
        return res.status(200).json({
            blog_categories: visible.map(helpers_1.toPublicBlogCategory),
        });
    }
    catch (error) {
        console.error('[Store BlogCategories] Error listing categories:', error);
        return res.status(500).json({ message: 'Error fetching blog categories' });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL3N0b3JlL2Jsb2ctY2F0ZWdvcmllcy9yb3V0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQWNBLGtCQXVDQztBQXBERCxnREFBb0Q7QUFFcEQsbURBSStCO0FBRS9COzs7O0dBSUc7QUFDSSxLQUFLLFVBQVUsR0FBRyxDQUFDLEdBQWtCLEVBQUUsR0FBbUI7SUFDL0QsSUFBSSxDQUFDO1FBQ0gsTUFBTSxPQUFPLEdBQXNCLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLGtCQUFXLENBQUMsQ0FBQztRQUNsRSxNQUFNLGNBQWMsR0FDbEIsT0FBTyxHQUFHLENBQUMsS0FBSyxDQUFDLGdCQUFnQixLQUFLLFFBQVE7WUFDNUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsZ0JBQWdCO1lBQzVCLENBQUMsQ0FBQyxTQUFTLENBQUM7UUFDaEIsTUFBTSxNQUFNLEdBQUcsSUFBQSx3QkFBYyxFQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUV6QyxNQUFNLFVBQVUsR0FBRyxNQUFNLE9BQU8sQ0FBQyxrQkFBa0IsQ0FDakQsRUFBRSxFQUNGLEVBQUUsS0FBSyxFQUFFLEVBQUUsVUFBVSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLEVBQUUsSUFBSSxFQUFFLEdBQUcsRUFBRSxDQUN6RCxDQUFDO1FBRUYsSUFBSSxPQUFPLEdBQUcsVUFBbUMsQ0FBQztRQUNsRCxJQUFJLGNBQWMsRUFBRSxDQUFDO1lBQ25CLG9FQUFvRTtZQUNwRSx3RUFBd0U7WUFDeEUscUVBQXFFO1lBQ3JFLE1BQU0sQ0FBQyxLQUFLLENBQUMsR0FBRyxNQUFNLE9BQU8sQ0FBQyxxQkFBcUIsQ0FDakQsRUFBRSxNQUFNLEVBQUUsV0FBVyxFQUFFLEVBQ3ZCLEVBQUUsQ0FDSCxDQUFDO1lBQ0YsTUFBTSxvQkFBb0IsR0FBRyxJQUFJLEdBQUcsQ0FDakMsS0FBK0I7aUJBQzdCLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsSUFBQSw4QkFBb0IsRUFBQyxDQUFDLEVBQUUsY0FBYyxFQUFFLE1BQU0sQ0FBQyxDQUFDO2lCQUM5RCxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUM7aUJBQ3pCLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FDbkIsQ0FBQztZQUNGLE9BQU8sR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxvQkFBb0IsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDbEUsQ0FBQztRQUVELE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUM7WUFDMUIsZUFBZSxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsOEJBQW9CLENBQUM7U0FDbkQsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7UUFDZixPQUFPLENBQUMsS0FBSyxDQUFDLGtEQUFrRCxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQ3pFLE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxPQUFPLEVBQUUsZ0NBQWdDLEVBQUUsQ0FBQyxDQUFDO0lBQzdFLENBQUM7QUFDSCxDQUFDIn0=