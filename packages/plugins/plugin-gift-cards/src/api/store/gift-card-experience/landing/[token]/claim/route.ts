import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { claimGiftCardWorkflow } from '@medusajs/loyalty-plugin/workflows';
import { hashGiftCardToken } from '../../../../../../modules/gift-card-experience/crypto';
import { GIFT_CARD_EXPERIENCE_MODULE } from '../../../../../../modules/gift-card-experience';
import type GiftCardExperienceModuleService from '../../../../../../modules/gift-card-experience/service';

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');
  const customerId = (req as MedusaRequest & { auth_context?: { actor_id?: string } }).auth_context?.actor_id;
  const token = String(req.params.token ?? '');
  if (!customerId || token.length < 32 || token.length > 128) {
    res.status(404).json({ message: 'Esta gift card no está disponible.' });
    return;
  }
  const service = req.scope.resolve<GiftCardExperienceModuleService>(GIFT_CARD_EXPERIENCE_MODULE);
  const delivery = await service.findDeliveryByTokenHash(hashGiftCardToken(token));
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
    if (!card) throw new Error('Gift card not found.');
    await claimGiftCardWorkflow(req.scope).run({ input: { code: card.code, customer_id: customerId } });
    await service.recordEvent('claimed', delivery);
    res.json({ claimed: true, idempotent: false, currency_code: delivery.currency_code });
  } catch (error) {
    await service.releaseConsumedToken(delivery.id, customerId);
    throw error;
  }
}
