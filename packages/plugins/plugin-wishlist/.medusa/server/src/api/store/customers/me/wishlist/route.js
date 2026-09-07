"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const wishlist_1 = require("../../../../../modules/wishlist");
// GET /store/customers/me/wishlist — the authenticated customer's wishlist.
// Mounted under /store/customers/me so the core applies customer auth.
async function GET(req, res) {
    const customerId = req.auth_context.actor_id;
    const service = req.scope.resolve(wishlist_1.WISHLIST_MODULE);
    const wishlists = await service.listWishlists({ customer_id: customerId }, { relations: ['items'] });
    const wishlist = wishlists[0];
    res.status(200).json({
        wishlist: {
            id: wishlist?.id ?? null,
            items: wishlist?.items ?? [],
        },
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL3N0b3JlL2N1c3RvbWVycy9tZS93aXNobGlzdC9yb3V0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQU1BLGtCQWdCQztBQXJCRCw4REFBa0U7QUFHbEUsNEVBQTRFO0FBQzVFLHVFQUF1RTtBQUNoRSxLQUFLLFVBQVUsR0FBRyxDQUFDLEdBQStCLEVBQUUsR0FBbUI7SUFDNUUsTUFBTSxVQUFVLEdBQUcsR0FBRyxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUM7SUFDN0MsTUFBTSxPQUFPLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQXdCLDBCQUFlLENBQUMsQ0FBQztJQUUxRSxNQUFNLFNBQVMsR0FBRyxNQUFNLE9BQU8sQ0FBQyxhQUFhLENBQzNDLEVBQUUsV0FBVyxFQUFFLFVBQVUsRUFBRSxFQUMzQixFQUFFLFNBQVMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQ3pCLENBQUM7SUFDRixNQUFNLFFBQVEsR0FBRyxTQUFTLENBQUMsQ0FBQyxDQUFvRCxDQUFDO0lBRWpGLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDO1FBQ25CLFFBQVEsRUFBRTtZQUNSLEVBQUUsRUFBRSxRQUFRLEVBQUUsRUFBRSxJQUFJLElBQUk7WUFDeEIsS0FBSyxFQUFFLFFBQVEsRUFBRSxLQUFLLElBQUksRUFBRTtTQUM3QjtLQUNGLENBQUMsQ0FBQztBQUNMLENBQUMifQ==