"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const request_1 = require("../../../../lib/multistore/request");
const scope_1 = require("../../../../lib/multistore/scope");
const site_scope_1 = require("../../../../modules/payment-benefits/site-scope");
const payment_benefits_1 = require("../../../../modules/payment-benefits");
const providers_1 = require("../../../../modules/payment-benefits/providers");
/** Métricas del dashboard + proveedores disponibles (PRD §11). */
async function GET(req, res) {
    const service = req.scope.resolve(payment_benefits_1.PAYMENT_BENEFITS_MODULE);
    const dashboard = await service.getDashboard(await (0, scope_1.siteFilter)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.PAYMENT_BENEFIT_SITE_SCOPE));
    const providers = Object.values(providers_1.PROVIDERS).map((p) => ({
        code: p.code,
        supports_sync: p.supportsSync,
    }));
    res.json({ ...dashboard, providers });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL3BheW1lbnQtYmVuZWZpdHMvZGFzaGJvYXJkL3JvdXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBU0Esa0JBVUM7QUFsQkQsZ0VBQXFFO0FBQ3JFLDREQUE4RDtBQUM5RCxnRkFBNkY7QUFDN0YsMkVBQStFO0FBRS9FLDhFQUEyRTtBQUUzRSxrRUFBa0U7QUFDM0QsS0FBSyxVQUFVLEdBQUcsQ0FBQyxHQUErQixFQUFFLEdBQW1CO0lBQzVFLE1BQU0sT0FBTyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUErQiwwQ0FBdUIsQ0FBQyxDQUFDO0lBQ3pGLE1BQU0sU0FBUyxHQUFHLE1BQU0sT0FBTyxDQUFDLFlBQVksQ0FDMUMsTUFBTSxJQUFBLGtCQUFVLEVBQUMsR0FBRyxDQUFDLEtBQUssRUFBRSxNQUFNLElBQUEseUJBQWUsRUFBQyxHQUFHLENBQUMsRUFBRSx1Q0FBMEIsQ0FBQyxDQUNwRixDQUFDO0lBQ0YsTUFBTSxTQUFTLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxxQkFBUyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBQ3JELElBQUksRUFBRSxDQUFDLENBQUMsSUFBSTtRQUNaLGFBQWEsRUFBRSxDQUFDLENBQUMsWUFBWTtLQUM5QixDQUFDLENBQUMsQ0FBQztJQUNKLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxHQUFHLFNBQVMsRUFBRSxTQUFTLEVBQUUsQ0FBQyxDQUFDO0FBQ3hDLENBQUMifQ==