import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { siteFromRequest } from '../../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../../lib/multistore/scope';
import { GIFT_CARD_DELIVERY_SITE_SCOPE } from '../../../../../modules/gift-card-experience/site-scope';
import type { z } from 'zod';
import { GIFT_CARD_EXPERIENCE_MODULE } from '../../../../../modules/gift-card-experience';
import type GiftCardExperienceModuleService from '../../../../../modules/gift-card-experience/service';
import { GiftCardDeliveryUpdate } from '../../validators';

type Input = z.infer<typeof GiftCardDeliveryUpdate>;

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  // Todos los handlers: reenviar una gift card de otra tienda la manda desde
  // otra marca, y un mail no se deshace.
  await assertIdInSite(req.scope, await siteFromRequest(req), GIFT_CARD_DELIVERY_SITE_SCOPE, req.params.id as string);

  const service = req.scope.resolve<GiftCardExperienceModuleService>(GIFT_CARD_EXPERIENCE_MODULE);
  const delivery = await service.retrieveGiftCardDelivery(req.params.id!);
  const operations = await service.getDeliveryOperations(req.params.id!);
  const { token_hash: _hash, token_encrypted: _token, ...safe } = delivery as unknown as Record<string, unknown>;
  res.json({ delivery: { ...safe, token_available: Boolean(_token) }, ...operations });
}

export async function POST(req: MedusaRequest<Input>, res: MedusaResponse): Promise<void> {
  // Todos los handlers: reenviar una gift card de otra tienda la manda desde
  // otra marca, y un mail no se deshace.
  await assertIdInSite(req.scope, await siteFromRequest(req), GIFT_CARD_DELIVERY_SITE_SCOPE, req.params.id as string);

  const service = req.scope.resolve<GiftCardExperienceModuleService>(GIFT_CARD_EXPERIENCE_MODULE);
  const delivery = await service.updateRecipientBeforeSending(req.params.id!, (req.validatedBody as Input).recipient_email);
  const { token_hash: _hash, token_encrypted: _token, ...safe } = delivery as unknown as Record<string, unknown>;
  res.json({ delivery: safe });
}
