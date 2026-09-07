"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const workflows_1 = require("@medusajs/loyalty-plugin/workflows");
const crypto_1 = require("../../../../../../modules/gift-card-experience/crypto");
const gift_card_experience_1 = require("../../../../../../modules/gift-card-experience");
async function POST(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    const customerId = req.auth_context?.actor_id;
    const token = String(req.params.token ?? '');
    if (!customerId || token.length < 32 || token.length > 128) {
        res.status(404).json({ message: 'Esta gift card no está disponible.' });
        return;
    }
    const service = req.scope.resolve(gift_card_experience_1.GIFT_CARD_EXPERIENCE_MODULE);
    const delivery = await service.findDeliveryByTokenHash((0, crypto_1.hashGiftCardToken)(token));
    if (!delivery?.gift_card_id) {
        res.status(404).json({ message: 'Esta gift card no está disponible.' });
        return;
    }
    const consumed = await service.consumeToken(delivery.id, customerId);
    if (consumed === 'same_customer') {
        res.json({ claimed: true, idempotent: true, currency_code: delivery.currency_code });
        return;
    }
    if (consumed === 'unavailable') {
        res.status(404).json({ message: 'Esta gift card no está disponible.' });
        return;
    }
    try {
        const card = await service.retrieveOfficialGiftCard(delivery.gift_card_id);
        if (!card)
            throw new Error('Gift card not found.');
        await (0, workflows_1.claimGiftCardWorkflow)(req.scope).run({ input: { code: card.code, customer_id: customerId } });
        await service.recordEvent('claimed', delivery);
        res.json({ claimed: true, idempotent: false, currency_code: delivery.currency_code });
    }
    catch (error) {
        await service.releaseConsumedToken(delivery.id, customerId);
        throw error;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL3N0b3JlL2dpZnQtY2FyZC1leHBlcmllbmNlL2xhbmRpbmcvW3Rva2VuXS9jbGFpbS9yb3V0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQU1BLG9CQWlDQztBQXRDRCxrRUFBMkU7QUFDM0Usa0ZBQTBGO0FBQzFGLHlGQUE2RjtBQUd0RixLQUFLLFVBQVUsSUFBSSxDQUFDLEdBQWtCLEVBQUUsR0FBbUI7SUFDaEUsR0FBRyxDQUFDLFNBQVMsQ0FBQyxlQUFlLEVBQUUsVUFBVSxDQUFDLENBQUM7SUFDM0MsTUFBTSxVQUFVLEdBQUksR0FBZ0UsQ0FBQyxZQUFZLEVBQUUsUUFBUSxDQUFDO0lBQzVHLE1BQU0sS0FBSyxHQUFHLE1BQU0sQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLEtBQUssSUFBSSxFQUFFLENBQUMsQ0FBQztJQUM3QyxJQUFJLENBQUMsVUFBVSxJQUFJLEtBQUssQ0FBQyxNQUFNLEdBQUcsRUFBRSxJQUFJLEtBQUssQ0FBQyxNQUFNLEdBQUcsR0FBRyxFQUFFLENBQUM7UUFDM0QsR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxPQUFPLEVBQUUsb0NBQW9DLEVBQUUsQ0FBQyxDQUFDO1FBQ3hFLE9BQU87SUFDVCxDQUFDO0lBQ0QsTUFBTSxPQUFPLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQWtDLGtEQUEyQixDQUFDLENBQUM7SUFDaEcsTUFBTSxRQUFRLEdBQUcsTUFBTSxPQUFPLENBQUMsdUJBQXVCLENBQUMsSUFBQSwwQkFBaUIsRUFBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0lBQ2pGLElBQUksQ0FBQyxRQUFRLEVBQUUsWUFBWSxFQUFFLENBQUM7UUFDNUIsR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxPQUFPLEVBQUUsb0NBQW9DLEVBQUUsQ0FBQyxDQUFDO1FBQ3hFLE9BQU87SUFDVCxDQUFDO0lBQ0QsTUFBTSxRQUFRLEdBQUcsTUFBTSxPQUFPLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQyxFQUFFLEVBQUUsVUFBVSxDQUFDLENBQUM7SUFDckUsSUFBSSxRQUFRLEtBQUssZUFBZSxFQUFFLENBQUM7UUFDakMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFFLElBQUksRUFBRSxhQUFhLEVBQUUsUUFBUSxDQUFDLGFBQWEsRUFBRSxDQUFDLENBQUM7UUFDckYsT0FBTztJQUNULENBQUM7SUFDRCxJQUFJLFFBQVEsS0FBSyxhQUFhLEVBQUUsQ0FBQztRQUMvQixHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQU8sRUFBRSxvQ0FBb0MsRUFBRSxDQUFDLENBQUM7UUFDeEUsT0FBTztJQUNULENBQUM7SUFDRCxJQUFJLENBQUM7UUFDSCxNQUFNLElBQUksR0FBRyxNQUFNLE9BQU8sQ0FBQyx3QkFBd0IsQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDM0UsSUFBSSxDQUFDLElBQUk7WUFBRSxNQUFNLElBQUksS0FBSyxDQUFDLHNCQUFzQixDQUFDLENBQUM7UUFDbkQsTUFBTSxJQUFBLGlDQUFxQixFQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRSxLQUFLLEVBQUUsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBRSxXQUFXLEVBQUUsVUFBVSxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBQ3BHLE1BQU0sT0FBTyxDQUFDLFdBQVcsQ0FBQyxTQUFTLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFDL0MsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFFLEtBQUssRUFBRSxhQUFhLEVBQUUsUUFBUSxDQUFDLGFBQWEsRUFBRSxDQUFDLENBQUM7SUFDeEYsQ0FBQztJQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7UUFDZixNQUFNLE9BQU8sQ0FBQyxvQkFBb0IsQ0FBQyxRQUFRLENBQUMsRUFBRSxFQUFFLFVBQVUsQ0FBQyxDQUFDO1FBQzVELE1BQU0sS0FBSyxDQUFDO0lBQ2QsQ0FBQztBQUNILENBQUMifQ==