import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { GIFT_CARD_EXPERIENCE_MODULE } from '../../../../modules/gift-card-experience';
import type GiftCardExperienceModuleService from '../../../../modules/gift-card-experience/service';

import { siteFromRequest } from '../../../../lib/multistore/request';
import { siteFilter } from '../../../../lib/multistore/scope';
import { GIFT_CARD_DELIVERY_SITE_SCOPE } from '../../../../modules/gift-card-experience/site-scope';

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<GiftCardExperienceModuleService>(GIFT_CARD_EXPERIENCE_MODULE);
  /**
   * Las entregas de la tienda acotan el agregado. `siteFilter` devuelve `{}` cuando no
   * hay que filtrar y `{ id: [...] }` cuando sí; se extraen los ids porque los KPIs se
   * computan en SQL y el predicado tiene que entrar ahí.
   */
  const where = await siteFilter(
    req.scope,
    await siteFromRequest(req),
    GIFT_CARD_DELIVERY_SITE_SCOPE,
  );
  const deliveryIds = Array.isArray((where as { id?: unknown }).id)
    ? (where as { id: string[] }).id
    : null;

  res.json({ analytics: await service.analytics(deliveryIds) });
}
