"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
const request_1 = require("../../../../../lib/multistore/request");
const scope_1 = require("../../../../../lib/multistore/scope");
const site_scope_1 = require("../../../../../modules/blog/site-scope");
const blog_1 = require("../../../../../modules/blog");
const validators_1 = require("../../validators");
/** GET /admin/blog-posts/:id/products — ordered product ids for the post. */
async function GET(req, res) {
    // El id del padre. Guardarlo alcanza: esta ruta no es alcanzable por otra vía.
    await (0, scope_1.assertIdInSite)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.BLOG_POST_SITE_SCOPE, req.params.id);
    const service = req.scope.resolve(blog_1.BLOG_MODULE);
    const product_ids = await service.getPostProductIds(req.params.id);
    return res.status(200).json({ product_ids });
}
/**
 * POST /admin/blog-posts/:id/products — replace the post's associations with
 * the given ordered `product_ids` (index becomes sort_order).
 */
async function POST(req, res) {
    // El id del padre. Guardarlo alcanza: esta ruta no es alcanzable por otra vía.
    await (0, scope_1.assertIdInSite)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.BLOG_POST_SITE_SCOPE, req.params.id);
    try {
        const { product_ids } = validators_1.PostAdminSetBlogPostProducts.parse(req.body);
        const service = req.scope.resolve(blog_1.BLOG_MODULE);
        await service.setPostProducts(req.params.id, product_ids);
        return res.status(200).json({ product_ids });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Error setting products';
        return res.status(400).json({ message });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2Jsb2ctcG9zdHMvW2lkXS9wcm9kdWN0cy9yb3V0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQVNBLGtCQU9DO0FBTUQsb0JBY0M7QUFuQ0QsbUVBQXdFO0FBQ3hFLCtEQUFxRTtBQUNyRSx1RUFBOEU7QUFDOUUsc0RBQTBEO0FBRTFELGlEQUFnRTtBQUVoRSw2RUFBNkU7QUFDdEUsS0FBSyxVQUFVLEdBQUcsQ0FBQyxHQUFrQixFQUFFLEdBQW1CO0lBQy9ELCtFQUErRTtJQUMvRSxNQUFNLElBQUEsc0JBQWMsRUFBQyxHQUFHLENBQUMsS0FBSyxFQUFFLE1BQU0sSUFBQSx5QkFBZSxFQUFDLEdBQUcsQ0FBQyxFQUFFLGlDQUFvQixFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBWSxDQUFDLENBQUM7SUFFM0csTUFBTSxPQUFPLEdBQXNCLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLGtCQUFXLENBQUMsQ0FBQztJQUNsRSxNQUFNLFdBQVcsR0FBRyxNQUFNLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQVksQ0FBQyxDQUFDO0lBQzdFLE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxXQUFXLEVBQUUsQ0FBQyxDQUFDO0FBQy9DLENBQUM7QUFFRDs7O0dBR0c7QUFDSSxLQUFLLFVBQVUsSUFBSSxDQUFDLEdBQWtCLEVBQUUsR0FBbUI7SUFDaEUsK0VBQStFO0lBQy9FLE1BQU0sSUFBQSxzQkFBYyxFQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsTUFBTSxJQUFBLHlCQUFlLEVBQUMsR0FBRyxDQUFDLEVBQUUsaUNBQW9CLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxFQUFZLENBQUMsQ0FBQztJQUUzRyxJQUFJLENBQUM7UUFDSCxNQUFNLEVBQUUsV0FBVyxFQUFFLEdBQUcseUNBQTRCLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNyRSxNQUFNLE9BQU8sR0FBc0IsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsa0JBQVcsQ0FBQyxDQUFDO1FBQ2xFLE1BQU0sT0FBTyxDQUFDLGVBQWUsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQVksRUFBRSxXQUFXLENBQUMsQ0FBQztRQUNwRSxPQUFPLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsV0FBVyxFQUFFLENBQUMsQ0FBQztJQUMvQyxDQUFDO0lBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztRQUNmLE1BQU0sT0FBTyxHQUNYLEtBQUssWUFBWSxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLHdCQUF3QixDQUFDO1FBQ3BFLE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxPQUFPLEVBQUUsQ0FBQyxDQUFDO0lBQzNDLENBQUM7QUFDSCxDQUFDIn0=