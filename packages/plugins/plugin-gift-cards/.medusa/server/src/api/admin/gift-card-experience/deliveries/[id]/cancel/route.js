"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const request_1 = require("../../../../../../lib/multistore/request");
const scope_1 = require("../../../../../../lib/multistore/scope");
const site_scope_1 = require("../../../../../../modules/gift-card-experience/site-scope");
const gift_card_experience_1 = require("../../../../../../modules/gift-card-experience");
async function POST(req, res) {
    // Mismo guard que el detalle: cancelar la entrega programada de otra tienda le
    // deja al comprador una gift card pagada que nunca llega, y nadie de esa tienda
    // ve quién la frenó.
    await (0, scope_1.assertIdInSite)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.GIFT_CARD_DELIVERY_SITE_SCOPE, req.params.id);
    const service = req.scope.resolve(gift_card_experience_1.GIFT_CARD_EXPERIENCE_MODULE);
    const delivery = await service.cancelScheduledDelivery(req.params.id);
    res.json({ delivery: { id: delivery.id, delivery_status: delivery.delivery_status } });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2dpZnQtY2FyZC1leHBlcmllbmNlL2RlbGl2ZXJpZXMvW2lkXS9jYW5jZWwvcm91dGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFPQSxvQkFTQztBQWZELHNFQUEyRTtBQUMzRSxrRUFBd0U7QUFDeEUsMEZBQTBHO0FBQzFHLHlGQUE2RjtBQUd0RixLQUFLLFVBQVUsSUFBSSxDQUFDLEdBQWtCLEVBQUUsR0FBbUI7SUFDaEUsK0VBQStFO0lBQy9FLGdGQUFnRjtJQUNoRixxQkFBcUI7SUFDckIsTUFBTSxJQUFBLHNCQUFjLEVBQUMsR0FBRyxDQUFDLEtBQUssRUFBRSxNQUFNLElBQUEseUJBQWUsRUFBQyxHQUFHLENBQUMsRUFBRSwwQ0FBNkIsRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQVksQ0FBQyxDQUFDO0lBRXBILE1BQU0sT0FBTyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFrQyxrREFBMkIsQ0FBQyxDQUFDO0lBQ2hHLE1BQU0sUUFBUSxHQUFHLE1BQU0sT0FBTyxDQUFDLHVCQUF1QixDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBRyxDQUFDLENBQUM7SUFDdkUsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLFFBQVEsRUFBRSxFQUFFLEVBQUUsRUFBRSxRQUFRLENBQUMsRUFBRSxFQUFFLGVBQWUsRUFBRSxRQUFRLENBQUMsZUFBZSxFQUFFLEVBQUUsQ0FBQyxDQUFDO0FBQ3pGLENBQUMifQ==