import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { siteFromRequest } from '../../../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../../../lib/multistore/scope';
import { GIFT_CARD_DELIVERY_SITE_SCOPE } from '../../../../../../modules/gift-card-experience/site-scope';
import { GIFT_CARD_EXPERIENCE_MODULE } from '../../../../../../modules/gift-card-experience';
import type GiftCardExperienceModuleService from '../../../../../../modules/gift-card-experience/service';

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  // Mismo guard que el detalle, y por el mismo motivo que dice ahí: reencolar la
  // entrega de otra tienda dispara un mail real con la marca ajena, y un mail no
  // se deshace.
  await assertIdInSite(req.scope, await siteFromRequest(req), GIFT_CARD_DELIVERY_SITE_SCOPE, req.params.id as string);

  const service = req.scope.resolve<GiftCardExperienceModuleService>(GIFT_CARD_EXPERIENCE_MODULE);
  const delivery = await service.requeueDelivery(req.params.id!);
  res.json({ delivery: { id: delivery.id, delivery_status: delivery.delivery_status } });
}
