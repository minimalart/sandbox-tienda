"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
const request_1 = require("../../../../../lib/multistore/request");
const scope_1 = require("../../../../../lib/multistore/scope");
const site_scope_1 = require("../../../../../modules/gift-card-experience/site-scope");
const gift_card_experience_1 = require("../../../../../modules/gift-card-experience");
async function GET(req, res) {
    // Todos los handlers: reenviar una gift card de otra tienda la manda desde
    // otra marca, y un mail no se deshace.
    await (0, scope_1.assertIdInSite)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.GIFT_CARD_DELIVERY_SITE_SCOPE, req.params.id);
    const service = req.scope.resolve(gift_card_experience_1.GIFT_CARD_EXPERIENCE_MODULE);
    const delivery = await service.retrieveGiftCardDelivery(req.params.id);
    const operations = await service.getDeliveryOperations(req.params.id);
    const { token_hash: _hash, token_encrypted: _token, ...safe } = delivery;
    res.json({ delivery: { ...safe, token_available: Boolean(_token) }, ...operations });
}
async function POST(req, res) {
    // Todos los handlers: reenviar una gift card de otra tienda la manda desde
    // otra marca, y un mail no se deshace.
    await (0, scope_1.assertIdInSite)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.GIFT_CARD_DELIVERY_SITE_SCOPE, req.params.id);
    const service = req.scope.resolve(gift_card_experience_1.GIFT_CARD_EXPERIENCE_MODULE);
    const delivery = await service.updateRecipientBeforeSending(req.params.id, req.validatedBody.recipient_email);
    const { token_hash: _hash, token_encrypted: _token, ...safe } = delivery;
    res.json({ delivery: safe });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2dpZnQtY2FyZC1leHBlcmllbmNlL2RlbGl2ZXJpZXMvW2lkXS9yb3V0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQVdBLGtCQVVDO0FBRUQsb0JBU0M7QUEvQkQsbUVBQXdFO0FBQ3hFLCtEQUFxRTtBQUNyRSx1RkFBdUc7QUFFdkcsc0ZBQTBGO0FBTW5GLEtBQUssVUFBVSxHQUFHLENBQUMsR0FBa0IsRUFBRSxHQUFtQjtJQUMvRCwyRUFBMkU7SUFDM0UsdUNBQXVDO0lBQ3ZDLE1BQU0sSUFBQSxzQkFBYyxFQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsTUFBTSxJQUFBLHlCQUFlLEVBQUMsR0FBRyxDQUFDLEVBQUUsMENBQTZCLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxFQUFZLENBQUMsQ0FBQztJQUVwSCxNQUFNLE9BQU8sR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBa0Msa0RBQTJCLENBQUMsQ0FBQztJQUNoRyxNQUFNLFFBQVEsR0FBRyxNQUFNLE9BQU8sQ0FBQyx3QkFBd0IsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQUcsQ0FBQyxDQUFDO0lBQ3hFLE1BQU0sVUFBVSxHQUFHLE1BQU0sT0FBTyxDQUFDLHFCQUFxQixDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBRyxDQUFDLENBQUM7SUFDdkUsTUFBTSxFQUFFLFVBQVUsRUFBRSxLQUFLLEVBQUUsZUFBZSxFQUFFLE1BQU0sRUFBRSxHQUFHLElBQUksRUFBRSxHQUFHLFFBQThDLENBQUM7SUFDL0csR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLFFBQVEsRUFBRSxFQUFFLEdBQUcsSUFBSSxFQUFFLGVBQWUsRUFBRSxPQUFPLENBQUMsTUFBTSxDQUFDLEVBQUUsRUFBRSxHQUFHLFVBQVUsRUFBRSxDQUFDLENBQUM7QUFDdkYsQ0FBQztBQUVNLEtBQUssVUFBVSxJQUFJLENBQUMsR0FBeUIsRUFBRSxHQUFtQjtJQUN2RSwyRUFBMkU7SUFDM0UsdUNBQXVDO0lBQ3ZDLE1BQU0sSUFBQSxzQkFBYyxFQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsTUFBTSxJQUFBLHlCQUFlLEVBQUMsR0FBRyxDQUFDLEVBQUUsMENBQTZCLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxFQUFZLENBQUMsQ0FBQztJQUVwSCxNQUFNLE9BQU8sR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBa0Msa0RBQTJCLENBQUMsQ0FBQztJQUNoRyxNQUFNLFFBQVEsR0FBRyxNQUFNLE9BQU8sQ0FBQyw0QkFBNEIsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQUcsRUFBRyxHQUFHLENBQUMsYUFBdUIsQ0FBQyxlQUFlLENBQUMsQ0FBQztJQUMxSCxNQUFNLEVBQUUsVUFBVSxFQUFFLEtBQUssRUFBRSxlQUFlLEVBQUUsTUFBTSxFQUFFLEdBQUcsSUFBSSxFQUFFLEdBQUcsUUFBOEMsQ0FBQztJQUMvRyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7QUFDL0IsQ0FBQyJ9