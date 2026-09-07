"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const payment_benefits_1 = require("../../../../modules/payment-benefits");
const request_1 = require("../../../../lib/multistore/request");
const scope_1 = require("../../../../lib/multistore/scope");
const site_scope_1 = require("../../../../modules/payment-benefits/site-scope");
/** Catálogo crudo de medios de pago sincronizado del proveedor. */
async function GET(req, res) {
    const service = req.scope.resolve(payment_benefits_1.PAYMENT_BENEFITS_MODULE);
    const q = req.query;
    const filters = {};
    if (q.provider_code)
        filters.provider_code = q.provider_code;
    // El catálogo sigue a la cuenta del proveedor, que ya es por tienda.
    Object.assign(filters, await (0, scope_1.siteFilter)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.PAYMENT_METHOD_CATALOG_SITE_SCOPE));
    const methods = await service.listPaymentMethodCatalogs(filters, {
        order: { payment_type_id: 'ASC', name: 'ASC' },
        take: 500,
    });
    res.json({ payment_methods: methods });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL3BheW1lbnQtYmVuZWZpdHMvY2F0YWxvZy9yb3V0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQVNBLGtCQWlCQztBQXpCRCwyRUFBK0U7QUFHL0UsZ0VBQXFFO0FBQ3JFLDREQUE4RDtBQUM5RCxnRkFBb0c7QUFFcEcsbUVBQW1FO0FBQzVELEtBQUssVUFBVSxHQUFHLENBQUMsR0FBK0IsRUFBRSxHQUFtQjtJQUM1RSxNQUFNLE9BQU8sR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBK0IsMENBQXVCLENBQUMsQ0FBQztJQUN6RixNQUFNLENBQUMsR0FBRyxHQUFHLENBQUMsS0FBMkMsQ0FBQztJQUMxRCxNQUFNLE9BQU8sR0FBNEIsRUFBRSxDQUFDO0lBQzVDLElBQUksQ0FBQyxDQUFDLGFBQWE7UUFBRSxPQUFPLENBQUMsYUFBYSxHQUFHLENBQUMsQ0FBQyxhQUFhLENBQUM7SUFFN0QscUVBQXFFO0lBQ3JFLE1BQU0sQ0FBQyxNQUFNLENBQ1gsT0FBTyxFQUNQLE1BQU0sSUFBQSxrQkFBVSxFQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsTUFBTSxJQUFBLHlCQUFlLEVBQUMsR0FBRyxDQUFDLEVBQUUsOENBQWlDLENBQUMsQ0FDM0YsQ0FBQztJQUVGLE1BQU0sT0FBTyxHQUFHLE1BQU0sT0FBTyxDQUFDLHlCQUF5QixDQUFDLE9BQU8sRUFBRTtRQUMvRCxLQUFLLEVBQUUsRUFBRSxlQUFlLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUU7UUFDOUMsSUFBSSxFQUFFLEdBQUc7S0FDVixDQUFDLENBQUM7SUFDSCxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsZUFBZSxFQUFFLE9BQU8sRUFBRSxDQUFDLENBQUM7QUFDekMsQ0FBQyJ9