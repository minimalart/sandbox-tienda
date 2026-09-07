import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { siteFromRequest } from '../../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../../lib/multistore/scope';
import { CORPORATE_SITE_SCOPE } from '../../../../../modules/corporate/site-scope';
import { CORPORATE_MODULE } from '../../../../../modules/corporate';
import type CorporateModuleService from '../../../../../modules/corporate/service';

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  // `req.params.id` es la raíz del dominio: guardarla alcanza, sus hijas no
  // son alcanzables por otra vía. Y va en TODOS los handlers, no sólo el GET.
  await assertIdInSite(req.scope, await siteFromRequest(req), CORPORATE_SITE_SCOPE, req.params.id as string);

  const service = req.scope.resolve<CorporateModuleService>(CORPORATE_MODULE);
  const id = req.params.id as string;

  const [invitations] = await service.listAndCountCorporateInvitations(
    { corporate_id: id },
    { order: { created_at: 'DESC' }, take: 100 },
  );
  const [members] = await service.listAndCountCorporateMembers(
    { corporate_id: id },
    { order: { created_at: 'DESC' }, take: 200 },
  );

  res.json({ invitations, members });
}
