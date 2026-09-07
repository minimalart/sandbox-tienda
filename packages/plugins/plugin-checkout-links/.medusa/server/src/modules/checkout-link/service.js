"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("@medusajs/framework/utils");
const crypto_1 = require("crypto");
const checkout_link_1 = require("./models/checkout-link");
const types_1 = require("./types");
class CheckoutLinkModuleService extends (0, utils_1.MedusaService)({
    CheckoutLink: checkout_link_1.CheckoutLink,
}) {
    /**
     * URL-safe opaque token. ~11 chars from 8 random bytes (base64url, no
     * padding). Collisions are vanishingly unlikely; the workflow retries on the
     * unique constraint just in case.
     */
    generateToken() {
        return (0, crypto_1.randomBytes)(8).toString('base64url');
    }
    isExpired(link) {
        if (!link.expires_at)
            return false;
        return new Date(link.expires_at) <= new Date();
    }
    /**
     * Resolves a token to the public payload needed to build the cart, or null
     * when the link is missing, disabled, expired, or a consumed single-use link.
     */
    async resolveByToken(token) {
        if (!token)
            return null;
        const [link] = await this.listCheckoutLinks({ token, deleted_at: null });
        if (!link)
            return null;
        if (link.status === types_1.CheckoutLinkStatus.DISABLED)
            return null;
        if (this.isExpired(link))
            return null;
        if (link.single_use && link.status === types_1.CheckoutLinkStatus.USED)
            return null;
        return {
            items: link.items ?? [],
            country_code: link.country_code,
            region_id: link.region_id ?? null,
            sales_channel_id: link.sales_channel_id ?? null,
            email: link.email ?? null,
            shipping_address: link.shipping_address ?? null,
            promo_codes: link.promo_codes ?? [],
        };
    }
    /**
     * Marks a link as consumed after an order is placed. Increments the counter
     * and, for single-use links, flips the status to `used`.
     */
    async markUsed(token) {
        const [link] = await this.listCheckoutLinks({ token, deleted_at: null });
        if (!link)
            return;
        await this.updateCheckoutLinks({
            id: link.id,
            used_count: (link.used_count ?? 0) + 1,
            ...(link.single_use ? { status: types_1.CheckoutLinkStatus.USED } : {}),
        });
    }
}
exports.default = CheckoutLinkModuleService;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL2NoZWNrb3V0LWxpbmsvc2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLHFEQUEwRDtBQUMxRCxtQ0FBcUM7QUFDckMsMERBQXNEO0FBQ3RELG1DQUlpQjtBQUVqQixNQUFNLHlCQUEwQixTQUFRLElBQUEscUJBQWEsRUFBQztJQUNwRCxZQUFZLEVBQVosNEJBQVk7Q0FDYixDQUFDO0lBQ0E7Ozs7T0FJRztJQUNILGFBQWE7UUFDWCxPQUFPLElBQUEsb0JBQVcsRUFBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDLENBQUM7SUFDOUMsQ0FBQztJQUVPLFNBQVMsQ0FBQyxJQUEyQztRQUMzRCxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVU7WUFBRSxPQUFPLEtBQUssQ0FBQztRQUNuQyxPQUFPLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxJQUFJLElBQUksRUFBRSxDQUFDO0lBQ2pELENBQUM7SUFFRDs7O09BR0c7SUFDSCxLQUFLLENBQUMsY0FBYyxDQUFDLEtBQWE7UUFDaEMsSUFBSSxDQUFDLEtBQUs7WUFBRSxPQUFPLElBQUksQ0FBQztRQUV4QixNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsTUFBTSxJQUFJLENBQUMsaUJBQWlCLENBQUMsRUFBRSxLQUFLLEVBQUUsVUFBVSxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7UUFFekUsSUFBSSxDQUFDLElBQUk7WUFBRSxPQUFPLElBQUksQ0FBQztRQUN2QixJQUFJLElBQUksQ0FBQyxNQUFNLEtBQUssMEJBQWtCLENBQUMsUUFBUTtZQUFFLE9BQU8sSUFBSSxDQUFDO1FBQzdELElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUM7WUFBRSxPQUFPLElBQUksQ0FBQztRQUN0QyxJQUFJLElBQUksQ0FBQyxVQUFVLElBQUksSUFBSSxDQUFDLE1BQU0sS0FBSywwQkFBa0IsQ0FBQyxJQUFJO1lBQUUsT0FBTyxJQUFJLENBQUM7UUFFNUUsT0FBTztZQUNMLEtBQUssRUFBRyxJQUFJLENBQUMsS0FBdUMsSUFBSSxFQUFFO1lBQzFELFlBQVksRUFBRSxJQUFJLENBQUMsWUFBWTtZQUMvQixTQUFTLEVBQUUsSUFBSSxDQUFDLFNBQVMsSUFBSSxJQUFJO1lBQ2pDLGdCQUFnQixFQUFFLElBQUksQ0FBQyxnQkFBZ0IsSUFBSSxJQUFJO1lBQy9DLEtBQUssRUFBRSxJQUFJLENBQUMsS0FBSyxJQUFJLElBQUk7WUFDekIsZ0JBQWdCLEVBQUcsSUFBSSxDQUFDLGdCQUF3QixJQUFJLElBQUk7WUFDeEQsV0FBVyxFQUFHLElBQUksQ0FBQyxXQUFtQyxJQUFJLEVBQUU7U0FDN0QsQ0FBQztJQUNKLENBQUM7SUFFRDs7O09BR0c7SUFDSCxLQUFLLENBQUMsUUFBUSxDQUFDLEtBQWE7UUFDMUIsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLE1BQU0sSUFBSSxDQUFDLGlCQUFpQixDQUFDLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBQ3pFLElBQUksQ0FBQyxJQUFJO1lBQUUsT0FBTztRQUVsQixNQUFPLElBQVksQ0FBQyxtQkFBbUIsQ0FBQztZQUN0QyxFQUFFLEVBQUUsSUFBSSxDQUFDLEVBQUU7WUFDWCxVQUFVLEVBQUUsQ0FBQyxJQUFJLENBQUMsVUFBVSxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUM7WUFDdEMsR0FBRyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLEVBQUUsTUFBTSxFQUFFLDBCQUFrQixDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7U0FDaEUsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBRUQsa0JBQWUseUJBQXlCLENBQUMifQ==