import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { maskGiftCardCode } from '../../../../../lib/gift-cards-shared';
import { hashGiftCardToken } from '../../../../../modules/gift-card-experience/crypto';
import { GIFT_CARD_EXPERIENCE_MODULE } from '../../../../../modules/gift-card-experience';
import type GiftCardExperienceModuleService from '../../../../../modules/gift-card-experience/service';

function unavailable(res: MedusaResponse): void {
  res.status(404).json({ message: 'Esta gift card no está disponible.' });
}

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  const token = String(req.params.token ?? '');
  if (token.length < 32 || token.length > 128) return unavailable(res);
  const service = req.scope.resolve<GiftCardExperienceModuleService>(GIFT_CARD_EXPERIENCE_MODULE);
  const delivery = await service.findDeliveryByTokenHash(hashGiftCardToken(token));
  if (
    !delivery || delivery.issuance_status !== 'issued' || delivery.claimed_at ||
    (delivery.expires_at && new Date(delivery.expires_at).getTime() <= Date.now())
  ) return unavailable(res);
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
      masked_code: maskGiftCardCode(card?.code),
    },
  });
}
