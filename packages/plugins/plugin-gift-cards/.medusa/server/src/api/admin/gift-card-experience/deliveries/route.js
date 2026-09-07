"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const request_1 = require("../../../../lib/multistore/request");
const scope_1 = require("../../../../lib/multistore/scope");
const site_scope_1 = require("../../../../modules/gift-card-experience/site-scope");
const gift_card_experience_1 = require("../../../../modules/gift-card-experience");
const safeDelivery = (delivery) => {
    const { token_hash: _hash, token_encrypted: _token, ...safe } = delivery;
    return safe;
};
async function GET(req, res) {
    const service = req.scope.resolve(gift_card_experience_1.GIFT_CARD_EXPERIENCE_MODULE);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const filters = {};
    // La entrega hereda la tienda de su orden. Al WHERE: el listado pagina.
    Object.assign(filters, await (0, scope_1.siteFilter)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.GIFT_CARD_DELIVERY_SITE_SCOPE));
    if (typeof req.query.delivery_status === 'string')
        filters.delivery_status = req.query.delivery_status;
    if (typeof req.query.issuance_status === 'string')
        filters.issuance_status = req.query.issuance_status;
    if (typeof req.query.order_id === 'string')
        filters.order_id = req.query.order_id;
    const [deliveries, count] = await service.listAndCountGiftCardDeliveries(filters, {
        skip: offset, take: limit, order: { created_at: 'DESC' },
    });
    res.json({ deliveries: deliveries.map((row) => safeDelivery(row)), count, limit, offset });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2dpZnQtY2FyZC1leHBlcmllbmNlL2RlbGl2ZXJpZXMvcm91dGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFZQSxrQkFpQkM7QUE1QkQsZ0VBQXFFO0FBQ3JFLDREQUE4RDtBQUM5RCxvRkFBb0c7QUFDcEcsbUZBQXVGO0FBR3ZGLE1BQU0sWUFBWSxHQUFHLENBQUMsUUFBaUMsRUFBRSxFQUFFO0lBQ3pELE1BQU0sRUFBRSxVQUFVLEVBQUUsS0FBSyxFQUFFLGVBQWUsRUFBRSxNQUFNLEVBQUUsR0FBRyxJQUFJLEVBQUUsR0FBRyxRQUFRLENBQUM7SUFDekUsT0FBTyxJQUFJLENBQUM7QUFDZCxDQUFDLENBQUM7QUFFSyxLQUFLLFVBQVUsR0FBRyxDQUFDLEdBQWtCLEVBQUUsR0FBbUI7SUFDL0QsTUFBTSxPQUFPLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQWtDLGtEQUEyQixDQUFDLENBQUM7SUFDaEcsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQztJQUN4RSxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxNQUFNLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUMxRCxNQUFNLE9BQU8sR0FBNEIsRUFBRSxDQUFDO0lBQzVDLHdFQUF3RTtJQUN4RSxNQUFNLENBQUMsTUFBTSxDQUNYLE9BQU8sRUFDUCxNQUFNLElBQUEsa0JBQVUsRUFBQyxHQUFHLENBQUMsS0FBSyxFQUFFLE1BQU0sSUFBQSx5QkFBZSxFQUFDLEdBQUcsQ0FBQyxFQUFFLDBDQUE2QixDQUFDLENBQ3ZGLENBQUM7SUFDRixJQUFJLE9BQU8sR0FBRyxDQUFDLEtBQUssQ0FBQyxlQUFlLEtBQUssUUFBUTtRQUFFLE9BQU8sQ0FBQyxlQUFlLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxlQUFlLENBQUM7SUFDdkcsSUFBSSxPQUFPLEdBQUcsQ0FBQyxLQUFLLENBQUMsZUFBZSxLQUFLLFFBQVE7UUFBRSxPQUFPLENBQUMsZUFBZSxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsZUFBZSxDQUFDO0lBQ3ZHLElBQUksT0FBTyxHQUFHLENBQUMsS0FBSyxDQUFDLFFBQVEsS0FBSyxRQUFRO1FBQUUsT0FBTyxDQUFDLFFBQVEsR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQztJQUNsRixNQUFNLENBQUMsVUFBVSxFQUFFLEtBQUssQ0FBQyxHQUFHLE1BQU0sT0FBTyxDQUFDLDhCQUE4QixDQUFDLE9BQU8sRUFBRTtRQUNoRixJQUFJLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBRTtLQUN6RCxDQUFDLENBQUM7SUFDSCxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsVUFBVSxFQUFFLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLFlBQVksQ0FBQyxHQUF5QyxDQUFDLENBQUMsRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxDQUFDLENBQUM7QUFDbkksQ0FBQyJ9