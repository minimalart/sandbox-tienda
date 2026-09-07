import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { siteFromRequest } from '../../../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../../../lib/multistore/scope';
import { GIFT_CARD_DELIVERY_SITE_SCOPE } from '../../../../../../modules/gift-card-experience/site-scope';
import { GIFT_CARD_EXPERIENCE_MODULE } from '../../../../../../modules/gift-card-experience';
import type GiftCardExperienceModuleService from '../../../../../../modules/gift-card-experience/service';

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  // Mismo guard que el detalle: cancelar la entrega programada de otra tienda le
  // deja al comprador una gift card pagada que nunca llega, y nadie de esa tienda
  // ve quién la frenó.
  await assertIdInSite(req.scope, await siteFromRequest(req), GIFT_CARD_DELIVERY_SITE_SCOPE, req.params.id as string);

  const service = req.scope.resolve<GiftCardExperienceModuleService>(GIFT_CARD_EXPERIENCE_MODULE);
  const delivery = await service.cancelScheduledDelivery(req.params.id!);
  res.json({ delivery: { id: delivery.id, delivery_status: delivery.delivery_status } });
}
