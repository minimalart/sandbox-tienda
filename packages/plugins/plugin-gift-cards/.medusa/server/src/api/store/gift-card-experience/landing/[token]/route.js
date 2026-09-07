"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const gift_cards_shared_1 = require("../../../../../lib/gift-cards-shared");
const crypto_1 = require("../../../../../modules/gift-card-experience/crypto");
const gift_card_experience_1 = require("../../../../../modules/gift-card-experience");
function unavailable(res) {
    res.status(404).json({ message: 'Esta gift card no está disponible.' });
}
async function GET(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    const token = String(req.params.token ?? '');
    if (token.length < 32 || token.length > 128)
        return unavailable(res);
    const service = req.scope.resolve(gift_card_experience_1.GIFT_CARD_EXPERIENCE_MODULE);
    const delivery = await service.findDeliveryByTokenHash((0, crypto_1.hashGiftCardToken)(token));
    if (!delivery || delivery.issuance_status !== 'issued' || delivery.claimed_at ||
        (delivery.expires_at && new Date(delivery.expires_at).getTime() <= Date.now()))
        return unavailable(res);
    const card = delivery.gift_card_id ? await service.retrieveOfficialGiftCard(delivery.gift_card_id) : null;
    await service.recordEvent('view', delivery);
    res.json({
        gift_card: {
            design: delivery.design_snapshot,
            recipient_name: delivery.recipient_name,
            sender_name: delivery.anonymous ? null : delivery.sender_name,
            anonymous: delivery.anonymous,
            message: delivery.message,
            value: Number(delivery.face_value),
            currency_code: delivery.currency_code,
            expires_at: delivery.expires_at,
            masked_code: (0, gift_cards_shared_1.maskGiftCardCode)(card?.code),
        },
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL3N0b3JlL2dpZnQtY2FyZC1leHBlcmllbmNlL2xhbmRpbmcvW3Rva2VuXS9yb3V0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQVVBLGtCQTBCQztBQW5DRCw0RUFBd0U7QUFDeEUsK0VBQXVGO0FBQ3ZGLHNGQUEwRjtBQUcxRixTQUFTLFdBQVcsQ0FBQyxHQUFtQjtJQUN0QyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQU8sRUFBRSxvQ0FBb0MsRUFBRSxDQUFDLENBQUM7QUFDMUUsQ0FBQztBQUVNLEtBQUssVUFBVSxHQUFHLENBQUMsR0FBa0IsRUFBRSxHQUFtQjtJQUMvRCxHQUFHLENBQUMsU0FBUyxDQUFDLGVBQWUsRUFBRSxVQUFVLENBQUMsQ0FBQztJQUMzQyxHQUFHLENBQUMsU0FBUyxDQUFDLGNBQWMsRUFBRSw4QkFBOEIsQ0FBQyxDQUFDO0lBQzlELE1BQU0sS0FBSyxHQUFHLE1BQU0sQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLEtBQUssSUFBSSxFQUFFLENBQUMsQ0FBQztJQUM3QyxJQUFJLEtBQUssQ0FBQyxNQUFNLEdBQUcsRUFBRSxJQUFJLEtBQUssQ0FBQyxNQUFNLEdBQUcsR0FBRztRQUFFLE9BQU8sV0FBVyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ3JFLE1BQU0sT0FBTyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFrQyxrREFBMkIsQ0FBQyxDQUFDO0lBQ2hHLE1BQU0sUUFBUSxHQUFHLE1BQU0sT0FBTyxDQUFDLHVCQUF1QixDQUFDLElBQUEsMEJBQWlCLEVBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztJQUNqRixJQUNFLENBQUMsUUFBUSxJQUFJLFFBQVEsQ0FBQyxlQUFlLEtBQUssUUFBUSxJQUFJLFFBQVEsQ0FBQyxVQUFVO1FBQ3pFLENBQUMsUUFBUSxDQUFDLFVBQVUsSUFBSSxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLENBQUMsT0FBTyxFQUFFLElBQUksSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDO1FBQzlFLE9BQU8sV0FBVyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQzFCLE1BQU0sSUFBSSxHQUFHLFFBQVEsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLE1BQU0sT0FBTyxDQUFDLHdCQUF3QixDQUFDLFFBQVEsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO0lBQzFHLE1BQU0sT0FBTyxDQUFDLFdBQVcsQ0FBQyxNQUFNLEVBQUUsUUFBUSxDQUFDLENBQUM7SUFDNUMsR0FBRyxDQUFDLElBQUksQ0FBQztRQUNQLFNBQVMsRUFBRTtZQUNULE1BQU0sRUFBRSxRQUFRLENBQUMsZUFBZTtZQUNoQyxjQUFjLEVBQUUsUUFBUSxDQUFDLGNBQWM7WUFDdkMsV0FBVyxFQUFFLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLFdBQVc7WUFDN0QsU0FBUyxFQUFFLFFBQVEsQ0FBQyxTQUFTO1lBQzdCLE9BQU8sRUFBRSxRQUFRLENBQUMsT0FBTztZQUN6QixLQUFLLEVBQUUsTUFBTSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUM7WUFDbEMsYUFBYSxFQUFFLFFBQVEsQ0FBQyxhQUFhO1lBQ3JDLFVBQVUsRUFBRSxRQUFRLENBQUMsVUFBVTtZQUMvQixXQUFXLEVBQUUsSUFBQSxvQ0FBZ0IsRUFBQyxJQUFJLEVBQUUsSUFBSSxDQUFDO1NBQzFDO0tBQ0YsQ0FBQyxDQUFDO0FBQ0wsQ0FBQyJ9