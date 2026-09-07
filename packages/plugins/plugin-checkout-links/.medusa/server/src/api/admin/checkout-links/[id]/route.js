"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
exports.DELETE = DELETE;
const request_1 = require("../../../../lib/multistore/request");
const scope_1 = require("../../../../lib/multistore/scope");
const site_scope_1 = require("../../../../modules/checkout-link/site-scope");
const checkout_link_1 = require("../../../../modules/checkout-link");
const validators_1 = require("../validators");
const helpers_1 = require("../helpers");
/**
 * GET /admin/checkout-links/:id
 */
async function GET(req, res) {
    // Todos los handlers: el listado filtra, pero el id se adivina desde ahí.
    await (0, scope_1.assertIdInSite)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.CHECKOUT_LINK_SITE_SCOPE, req.params.id);
    try {
        const service = req.scope.resolve(checkout_link_1.CHECKOUT_LINK_MODULE);
        const checkout_link = await service.retrieveCheckoutLink(req.params.id);
        return res.status(200).json({ checkout_link: (0, helpers_1.withPublicUrl)(checkout_link) });
    }
    catch (error) {
        console.error('[Admin CheckoutLinks] Error retrieving link:', error);
        return res.status(404).json({ message: 'Checkout link not found' });
    }
}
/**
 * POST /admin/checkout-links/:id — update (status, expiry, items, etc.)
 */
async function POST(req, res) {
    // Todos los handlers: el listado filtra, pero el id se adivina desde ahí.
    await (0, scope_1.assertIdInSite)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.CHECKOUT_LINK_SITE_SCOPE, req.params.id);
    try {
        const service = req.scope.resolve(checkout_link_1.CHECKOUT_LINK_MODULE);
        const validated = validators_1.PostAdminUpdateCheckoutLink.parse(req.body);
        const checkout_link = await service.updateCheckoutLinks({
            id: req.params.id,
            ...validated,
            ...(validated.expires_at !== undefined
                ? {
                    expires_at: validated.expires_at
                        ? new Date(validated.expires_at)
                        : null,
                }
                : {}),
        });
        return res.status(200).json({ checkout_link: (0, helpers_1.withPublicUrl)(checkout_link) });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Error updating checkout link';
        console.error('[Admin CheckoutLinks] Error updating link:', message);
        return res.status(400).json({ message });
    }
}
/**
 * DELETE /admin/checkout-links/:id
 */
async function DELETE(req, res) {
    // Todos los handlers: el listado filtra, pero el id se adivina desde ahí.
    await (0, scope_1.assertIdInSite)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.CHECKOUT_LINK_SITE_SCOPE, req.params.id);
    try {
        const service = req.scope.resolve(checkout_link_1.CHECKOUT_LINK_MODULE);
        await service.deleteCheckoutLinks(req.params.id);
        return res
            .status(200)
            .json({ id: req.params.id, object: 'checkout_link', deleted: true });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Error deleting checkout link';
        console.error('[Admin CheckoutLinks] Error deleting link:', message);
        return res.status(400).json({ message });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2NoZWNrb3V0LWxpbmtzL1tpZF0vcm91dGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFZQSxrQkFlQztBQUtELG9CQTRCQztBQUtELHdCQWlCQztBQWpGRCxnRUFBcUU7QUFDckUsNERBQWtFO0FBQ2xFLDZFQUF3RjtBQUN4RixxRUFBeUU7QUFFekUsOENBQTREO0FBQzVELHdDQUEyQztBQUUzQzs7R0FFRztBQUNJLEtBQUssVUFBVSxHQUFHLENBQUMsR0FBa0IsRUFBRSxHQUFtQjtJQUMvRCwwRUFBMEU7SUFDMUUsTUFBTSxJQUFBLHNCQUFjLEVBQUMsR0FBRyxDQUFDLEtBQUssRUFBRSxNQUFNLElBQUEseUJBQWUsRUFBQyxHQUFHLENBQUMsRUFBRSxxQ0FBd0IsRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQVksQ0FBQyxDQUFDO0lBRS9HLElBQUksQ0FBQztRQUNILE1BQU0sT0FBTyxHQUNYLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLG9DQUFvQixDQUFDLENBQUM7UUFDMUMsTUFBTSxhQUFhLEdBQUcsTUFBTSxPQUFPLENBQUMsb0JBQW9CLENBQ3RELEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBWSxDQUN4QixDQUFDO1FBQ0YsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLGFBQWEsRUFBRSxJQUFBLHVCQUFhLEVBQUMsYUFBb0IsQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUN0RixDQUFDO0lBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztRQUNmLE9BQU8sQ0FBQyxLQUFLLENBQUMsOENBQThDLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDckUsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQU8sRUFBRSx5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