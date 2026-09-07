"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const gift_card_experience_1 = require("../../../../modules/gift-card-experience");
const request_1 = require("../../../../lib/multistore/request");
const scope_1 = require("../../../../lib/multistore/scope");
const site_scope_1 = require("../../../../modules/gift-card-experience/site-scope");
async function GET(req, res) {
    const service = req.scope.resolve(gift_card_experience_1.GIFT_CARD_EXPERIENCE_MODULE);
    /**
     * Las entregas de la tienda acotan el agregado. `siteFilter` devuelve `{}` cuando no
     * hay que filtrar y `{ id: [...] }` cuando sí; se extraen los ids porque los KPIs se
     * computan en SQL y el predicado tiene que entrar ahí.
     */
    const where = await (0, scope_1.siteFilter)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.GIFT_CARD_DELIVERY_SITE_SCOPE);
    const deliveryIds = Array.isArray(where.id)
        ? where.id
        : null;
    res.json({ analytics: await service.analytics(deliveryIds) });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2dpZnQtY2FyZC1leHBlcmllbmNlL2FuYWx5dGljcy9yb3V0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQVFBLGtCQWlCQztBQXhCRCxtRkFBdUY7QUFHdkYsZ0VBQXFFO0FBQ3JFLDREQUE4RDtBQUM5RCxvRkFBb0c7QUFFN0YsS0FBSyxVQUFVLEdBQUcsQ0FBQyxHQUFrQixFQUFFLEdBQW1CO0lBQy9ELE1BQU0sT0FBTyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFrQyxrREFBMkIsQ0FBQyxDQUFDO0lBQ2hHOzs7O09BSUc7SUFDSCxNQUFNLEtBQUssR0FBRyxNQUFNLElBQUEsa0JBQVUsRUFDNUIsR0FBRyxDQUFDLEtBQUssRUFDVCxNQUFNLElBQUEseUJBQWUsRUFBQyxHQUFHLENBQUMsRUFDMUIsMENBQTZCLENBQzlCLENBQUM7SUFDRixNQUFNLFdBQVcsR0FBRyxLQUFLLENBQUMsT0FBTyxDQUFFLEtBQTBCLENBQUMsRUFBRSxDQUFDO1FBQy9ELENBQUMsQ0FBRSxLQUEwQixDQUFDLEVBQUU7UUFDaEMsQ0FBQyxDQUFDLElBQUksQ0FBQztJQUVULEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxTQUFTLEVBQUUsTUFBTSxPQUFPLENBQUMsU0FBUyxDQUFDLFdBQVcsQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUNoRSxDQUFDIn0=