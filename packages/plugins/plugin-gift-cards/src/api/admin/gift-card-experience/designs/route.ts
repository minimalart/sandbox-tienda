import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { GIFT_CARD_EXPERIENCE_MODULE } from '../../../../modules/gift-card-experience';
import type GiftCardExperienceModuleService from '../../../../modules/gift-card-experience/service';
import type { z } from 'zod';
import { GiftCardDesignInput } from '../validators';

import { siteFromRequest } from '../../../../lib/multistore/request';
import { siteDefaults, siteFilter } from '../../../../lib/multistore/scope';
import { GIFT_CARD_DESIGN_SITE_SCOPE } from '../../../../modules/gift-card-experience/site-scope';

type Input = z.infer<typeof GiftCardDesignInput>;

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<GiftCardExperienceModuleService>(GIFT_CARD_EXPERIENCE_MODULE);
  await service.ensureDefaultDesign();
  const resolution = await siteFromRequest(req);
  const [designs, count] = await service.listAndCountGiftCardDesigns(
    await siteFilter(req.scope, resolution, GIFT_CARD_DESIGN_SITE_SCOPE),
    { order: { sort_order: 'ASC' } },
  );
  res.json({ designs, count });
}

export async function POST(req: MedusaRequest<Input>, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<GiftCardExperienceModuleService>(GIFT_CARD_EXPERIENCE_MODULE);
  const design = await service.createGiftCardDesigns({
    // El diseño nace en la tienda activa.
    ...siteDefaults(await siteFromRequest(req), GIFT_CARD_DESIGN_SITE_SCOPE),
    ...(req.validatedBody as Input),
  });
  res.status(201).json({ design });
}
