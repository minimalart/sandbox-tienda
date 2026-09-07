"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const request_1 = require("../../../../../../lib/multistore/request");
const scope_1 = require("../../../../../../lib/multistore/scope");
const site_scope_1 = require("../../../../../../modules/gift-card-experience/site-scope");
const gift_card_experience_1 = require("../../../../../../modules/gift-card-experience");
async function POST(req, res) {
    // Mismo guard que el detalle, y por el mismo motivo que dice ahí: reencolar la
    // entrega de otra tienda dispara un mail real con la marca ajena, y un mail no
    // se deshace.
    await (0, scope_1.assertIdInSite)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.GIFT_CARD_DELIVERY_SITE_SCOPE, req.params.id);
    const service = req.scope.resolve(gift_card_experience_1.GIFT_CARD_EXPERIENCE_MODULE);
    const delivery = await service.requeueDelivery(req.params.id);
    res.json({ delivery: { id: delivery.id, delivery_status: delivery.delivery_status } });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2dpZnQtY2FyZC1leHBlcmllbmNlL2RlbGl2ZXJpZXMvW2lkXS9yZXRyeS9yb3V0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQU9BLG9CQVNDO0FBZkQsc0VBQTJFO0FBQzNFLGtFQUF3RTtBQUN4RSwwRkFBMEc7QUFDMUcseUZBQTZGO0FBR3RGLEtBQUssVUFBVSxJQUFJLENBQUMsR0FBa0IsRUFBRSxHQUFtQjtJQUNoRSwrRUFBK0U7SUFDL0UsK0VBQStFO0lBQy9FLGNBQWM7SUFDZCxNQUFNLElBQUEsc0JBQWMsRUFBQyxHQUFHLENBQUMsS0FBSyxFQUFFLE1BQU0sSUFBQSx5QkFBZSxFQUFDLEdBQUcsQ0FBQyxFQUFFLDBDQUE2QixFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBWSxDQUFDLENBQUM7SUFFcEgsTUFBTSxPQUFPLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQWtDLGtEQUEyQixDQUFDLENBQUM7SUFDaEcsTUFBTSxRQUFRLEdBQUcsTUFBTSxPQUFPLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBRyxDQUFDLENBQUM7SUFDL0QsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLFFBQVEsRUFBRSxFQUFFLEVBQUUsRUFBRSxRQUFRLENBQUMsRUFBRSxFQUFFLGVBQWUsRUFBRSxRQUFRLENBQUMsZUFBZSxFQUFFLEVBQUUsQ0FBQyxDQUFDO0FBQ3pGLENBQUMifQ==