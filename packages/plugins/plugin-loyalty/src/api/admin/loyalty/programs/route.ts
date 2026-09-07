import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { LOYALTY_MODULE } from '../../../../modules/loyalty';
import type LoyaltyModuleService from '../../../../modules/loyalty/service';
import { siteFromRequest } from '../../../../lib/multistore/request';
import { siteDefaults, siteFilter } from '../../../../lib/multistore/scope';
import { LOYALTY_PROGRAM_SITE_SCOPE } from '../../../../modules/loyalty/site-scope';

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve<LoyaltyModuleService>(LOYALTY_MODULE);
  const resolution = await siteFromRequest(req);
  const [programs, count] = await service.listAndCountLoyaltyPrograms(
    await siteFilter(req.scope, resolution, LOYALTY_PROGRAM_SITE_SCOPE),
    { order: { created_at: 'DESC' } },
  );
  res.json({ programs, count });
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve<LoyaltyModuleService>(LOYALTY_MODULE);
  const resolution = await siteFromRequest(req);

  /**
   * El programa nace en la tienda activa.
   *
   * Los defaults van PRIMERO para que un `site_id` explícito en el body gane: es lo
   * que permite crear el programa de otra tienda desde un script sin pelear con el
   * header. Al revés, el default pisaría siempre y el body sería decorativo.
   */
  const created = await service.createLoyaltyPrograms({
    ...siteDefaults(resolution, LOYALTY_PROGRAM_SITE_SCOPE),
    ...(req.validatedBody as Record<string, unknown>),
  });
  res.status(201).json({ program: created });
}
