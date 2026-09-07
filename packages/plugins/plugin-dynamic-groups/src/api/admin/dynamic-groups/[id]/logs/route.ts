import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { siteFromRequest } from '../../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../../lib/multistore/scope';
import { DYNAMIC_GROUP_SITE_SCOPE } from '../../../../../modules/dynamic-groups/site-scope';
import { DYNAMIC_GROUPS_MODULE } from '../../../../../modules/dynamic-groups';
import type DynamicGroupsModuleService from '../../../../../modules/dynamic-groups/service';

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  // `req.params.id` es la raíz del dominio: guardarla alcanza, sus hijas no
  // son alcanzables por otra vía. Y va en TODOS los handlers, no sólo el GET.
  await assertIdInSite(req.scope, await siteFromRequest(req), DYNAMIC_GROUP_SITE_SCOPE, req.params.id as string);

  const service = req.scope.resolve<DynamicGroupsModuleService>(
    DYNAMIC_GROUPS_MODULE,
  );
  const limit = Number(req.query.limit ?? 50);
  const offset = Number(req.query.offset ?? 0);

  const [logs, count] = await service.listAndCountDynamicGroupMembershipLogs(
    { dynamic_group_id: req.params.id },
    { skip: offset, take: limit, order: { created_at: 'DESC' } },
  );

  res.json({ logs, count, limit, offset });
}
