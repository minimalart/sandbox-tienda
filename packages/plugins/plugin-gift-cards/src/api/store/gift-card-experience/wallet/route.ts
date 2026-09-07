import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { GIFT_CARD_EXPERIENCE_MODULE } from '../../../../modules/gift-card-experience';
import type GiftCardExperienceModuleService from '../../../../modules/gift-card-experience/service';

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');
  const customerId = (req as MedusaRequest & { auth_context?: { actor_id?: string } }).auth_context?.actor_id;
  const service = req.scope.resolve<GiftCardExperienceModuleService>(GIFT_CARD_EXPERIENCE_MODULE);
  const wallets = await service.getCustomerWallet(customerId!);
  res.json({ wallets });
}
