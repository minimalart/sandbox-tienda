"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const checkout_link_1 = require("../../../../modules/checkout-link");
/**
 * GET /store/checkout-links/:token
 *
 * Public resolver for a preloaded checkout link. Returns only the data needed
 * to build the cart (never `created_by`/internal metadata). Responds 404 when
 * the link is missing, disabled, expired, or a consumed single-use link.
 */
async function GET(req, res) {
    try {
        const service = req.scope.resolve(checkout_link_1.CHECKOUT_LINK_MODULE);
        const resolved = await service.resolveByToken(req.params.token);
        if (!resolved) {
            return res
                .status(404)
                .json({ message: 'Checkout link not found or no longer available' });
        }
        return res.status(200).json({ checkout_link: resolved });
    }
    catch (error) {
        console.error('[Store CheckoutLinks] Error resolving token:', error);
        return res
            .status(404)
            .json({ message: 'Checkout link not found or no longer available' });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL3N0b3JlL2NoZWNrb3V0LWxpbmtzL1t0b2tlbl0vcm91dGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFXQSxrQkFvQkM7QUE5QkQscUVBQXlFO0FBR3pFOzs7Ozs7R0FNRztBQUNJLEtBQUssVUFBVSxHQUFHLENBQUMsR0FBa0IsRUFBRSxHQUFtQjtJQUMvRCxJQUFJLENBQUM7UUFDSCxNQUFNLE9BQU8sR0FDWCxHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxvQ0FBb0IsQ0FBQyxDQUFDO1FBRTFDLE1BQU0sUUFBUSxHQUFHLE1BQU0sT0FBTyxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLEtBQWUsQ0FBQyxDQUFDO1FBRTFFLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUNkLE9BQU8sR0FBRztpQkFDUCxNQUFNLENBQUMsR0FBRyxDQUFDO2lCQUNYLElBQUksQ0FBQyxFQUFFLE9BQU8sRUFBRSxnREFBZ0QsRUFBRSxDQUFDLENBQUM7UUFDekUsQ0FBQztRQUVELE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxhQUFhLEVBQUUsUUFBUSxFQUFFLENBQUMsQ0FBQztJQUMzRCxDQUFDO0lBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztRQUNmLE9BQU8sQ0FBQyxLQUFLLENBQUMsOENBQThDLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDckUsT0FBTyxHQUFHO2FBQ1AsTUFBTSxDQUFDLEdBQUcsQ0FBQzthQUNYLElBQUksQ0FBQyxFQUFFLE9BQU8sRUFBRSxnREFBZ0QsRUFBRSxDQUFDLENBQUM7SUFDekUsQ0FBQztBQUNILENBQUMifQ==