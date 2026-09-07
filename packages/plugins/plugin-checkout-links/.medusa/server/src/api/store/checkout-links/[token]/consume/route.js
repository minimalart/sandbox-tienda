"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const checkout_link_1 = require("../../../../../modules/checkout-link");
/**
 * POST /store/checkout-links/:token/consume
 *
 * Marks a link as consumed once its order has been placed. Increments the usage
 * counter and, for single-use links, flips the status to `used` so the link can
 * no longer be resolved. Always returns 200 (best-effort, non-blocking for the
 * storefront's order-completion flow).
 */
async function POST(req, res) {
    try {
        const service = req.scope.resolve(checkout_link_1.CHECKOUT_LINK_MODULE);
        await service.markUsed(req.params.token);
    }
    catch (error) {
        console.error('[Store CheckoutLinks] Error consuming token:', error);
    }
    return res.status(200).json({ success: true });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL3N0b3JlL2NoZWNrb3V0LWxpbmtzL1t0b2tlbl0vY29uc3VtZS9yb3V0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQVlBLG9CQVNDO0FBcEJELHdFQUE0RTtBQUc1RTs7Ozs7OztHQU9HO0FBQ0ksS0FBSyxVQUFVLElBQUksQ0FBQyxHQUFrQixFQUFFLEdBQW1CO0lBQ2hFLElBQUksQ0FBQztRQUNILE1BQU0sT0FBTyxHQUNYLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLG9DQUFvQixDQUFDLENBQUM7UUFDMUMsTUFBTSxPQUFPLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBZSxDQUFDLENBQUM7SUFDckQsQ0FBQztJQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7UUFDZixPQUFPLENBQUMsS0FBSyxDQUFDLDhDQUE4QyxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQ3ZFLENBQUM7SUFDRCxPQUFPLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7QUFDakQsQ0FBQyJ9