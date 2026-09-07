"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
const request_1 = require("../../../lib/multistore/request");
const scope_1 = require("../../../lib/multistore/scope");
const site_scope_1 = require("../../../modules/checkout-link/site-scope");
const checkout_link_1 = require("../../../modules/checkout-link");
const create_checkout_link_1 = require("../../../workflows/create-checkout-link");
const validators_1 = require("./validators");
const helpers_1 = require("./helpers");
/**
 * GET /admin/checkout-links — list all checkout links (newest first)
 */
async function GET(req, res) {
    try {
        const service = req.scope.resolve(checkout_link_1.CHECKOUT_LINK_MODULE);
        const limit = req.query.limit ? Number(req.query.limit) : 50;
        const offset = req.query.offset ? Number(req.query.offset) : 0;
        const resolution = await (0, request_1.siteFromRequest)(req);
        const [checkout_links, count] = await service.listAndCountCheckoutLinks({
            deleted_at: null,
            ...(await (0, scope_1.siteFilter)(req.scope, resolution, site_scope_1.CHECKOUT_LINK_SITE_SCOPE)),
        }, { skip: offset, take: limit, order: { created_at: 'DESC' } });
        return res.status(200).json({
            checkout_links: checkout_links.map((l) => (0, helpers_1.withPublicUrl)(l)),
            count,
            offset,
            limit,
        });
    }
    catch (error) {
        console.error('[Admin CheckoutLinks] Error listing links:', error);
        return res.status(500).json({ message: 'Error fetching checkout links' });
    }
}
/**
 * POST /admin/checkout-links — create a checkout link (validated, via workflow)
 */
async function POST(req, res) {
    try {
        const validated = validators_1.PostAdminCreateCheckoutLink.parse(req.body);
        /**
         * Los defaults van PRIMERO: un `sales_channel_id` explícito en el body gana.
         * Al revés, el default pisaría siempre y el campo del formulario sería
         * decorativo.
         */
        const { result } = await (0, create_checkout_link_1.createCheckoutLinkWorkflow)(req.scope).run({
            input: {
                ...(0, scope_1.siteDefaults)(await (0, request_1.siteFromRequest)(req), site_scope_1.CHECKOUT_LINK_SITE_SCOPE),
                ...validated,
                created_by: req.auth_context?.actor_id,
            },
        });
        return res.status(201).json({ checkout_link: (0, helpers_1.withPublicUrl)(result) });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Error creating checkout link';
        console.error('[Admin CheckoutLinks] Error creating link:', message);
        return res.status(400).json({ message });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2NoZWNrb3V0LWxpbmtzL3JvdXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBYUEsa0JBd0JDO0FBS0Qsb0JBd0JDO0FBakVELDZEQUFrRTtBQUNsRSx5REFBeUU7QUFDekUsMEVBQXFGO0FBQ3JGLGtFQUFzRTtBQUV0RSxrRkFBcUY7QUFDckYsNkNBQTJEO0FBQzNELHVDQUEwQztBQUUxQzs7R0FFRztBQUNJLEtBQUssVUFBVSxHQUFHLENBQUMsR0FBa0IsRUFBRSxHQUFtQjtJQUMvRCxJQUFJLENBQUM7UUFDSCxNQUFNLE9BQU8sR0FDWCxHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxvQ0FBb0IsQ0FBQyxDQUFDO1FBQzFDLE1BQU0sS0FBSyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO1FBQzdELE1BQU0sTUFBTSxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQy9ELE1BQU0sVUFBVSxHQUFHLE1BQU0sSUFBQSx5QkFBZSxFQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQzlDLE1BQU0sQ0FBQyxjQUFjLEVBQUUsS0FBSyxDQUFDLEdBQUcsTUFBTSxPQUFPLENBQUMseUJBQXlCLENBQ3JFO1lBQ0UsVUFBVSxFQUFFLElBQUk7WUFDaEIsR0FBRyxDQUFDLE1BQU0sSUFBQSxrQkFBVSxFQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsVUFBVSxFQUFFLHFDQUF3QixDQUFDLENBQUM7U0FDdkUsRUFDRCxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsRUFBRSxVQUFVLEVBQUUsTUFBTSxFQUFFLEVBQUUsQ0FDN0QsQ0FBQztRQUNGLE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUM7WUFDMUIsY0FBYyxFQUFFLGNBQWMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFNLEVBQUUsRUFBRSxDQUFDLElBQUEsdUJBQWEsRUFBQyxDQUFDLENBQUMsQ0FBQztZQUNoRSxLQUFLO1lBQ0wsTUFBTTtZQUNOLEtBQUs7U0FDTixDQUFDLENBQUM7SUFDTCxDQUFDO0lBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztRQUNmLE9BQU8sQ0FBQyxLQUFLLENBQUMsNENBQTRDLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDbkUsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQU8sRUFBRSwrQkFBK0IsRUFBRSxDQUFDLENBQUM7SUFDNUUsQ0FBQztBQUNILENBQUM7QUFFRDs7R0FFRztBQUNJLEtBQUssVUFBVSxJQUFJLENBQUMsR0FBa0IsRUFBRSxHQUFtQjtJQUNoRSxJQUFJLENBQUM7UUFDSCxNQUFNLFNBQVMsR0FBRyx3Q0FBMkIsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBRTlEOzs7O1dBSUc7UUFDSCxNQUFNLEVBQUUsTUFBTSxFQUFFLEdBQUcsTUFBTSxJQUFBLGlEQUEwQixFQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLENBQUM7WUFDakUsS0FBSyxFQUFFO2dCQUNMLEdBQUcsSUFBQSxvQkFBWSxFQUFDLE1BQU0sSUFBQSx5QkFBZSxFQUFDLEdBQUcsQ0FBQyxFQUFFLHFDQUF3QixDQUFDO2dCQUNyRSxHQUFHLFNBQVM7Z0JBQ1osVUFBVSxFQUFHLEdBQVcsQ0FBQyxZQUFZLEVBQUUsUUFBUTthQUNoRDtTQUNGLENBQUMsQ0FBQztRQUVILE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxhQUFhLEVBQUUsSUFBQSx1QkFBYSxFQUFDLE1BQWEsQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUMvRSxDQUFDO0lBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztRQUNmLE1BQU0sT0FBTyxHQUNYLEtBQUssWUFBWSxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLDhCQUE4QixDQUFDO1FBQzFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsNENBQTRDLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDckUsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQU8sRUFBRSxDQUFDLENBQUM7SUFDM0MsQ0FBQztBQUNILENBQUMifQ==