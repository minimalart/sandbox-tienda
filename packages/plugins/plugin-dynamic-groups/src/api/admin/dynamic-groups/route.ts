import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { siteFromRequest } from '../../../lib/multistore/request';
import { siteDefaults, siteFilter } from '../../../lib/multistore/scope';
import { DYNAMIC_GROUP_SITE_SCOPE } from '../../../modules/dynamic-groups/site-scope';
import { DYNAMIC_GROUPS_MODULE } from '../../../modules/dynamic-groups';
import type DynamicGroupsModuleService from '../../../modules/dynamic-groups/service';
import {
  createDynamicGroupWorkflow,
  type CreateDynamicGroupInput,
} from '../../../workflows/create-dynamic-group';
import { PostCreateDynamicGroup } from './validators';

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<DynamicGroupsModuleService>(
    DYNAMIC_GROUPS_MODULE,
  );
  const limit = Number(req.query.limit ?? 50);
  const offset = Number(req.query.offset ?? 0);

  const resolution = await siteFromRequest(req);

  const [dynamic_groups, count] = await service.listAndCountDynamicGroups(
    await siteFilter(req.scope, resolution, DYNAMIC_GROUP_SITE_SCOPE),
    { skip: offset, take: limit, order: { created_at: 'DESC' } },
  );

  res.json({ dynamic_groups, count, limit, offset });
}

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const parsed = PostCreateDynamicGroup.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Invalid body' });
    return;
  }

  // El grupo nace en la tienda activa: si no, se crea desde una tienda y aparece en
  // todas, y el listado filtrado ya no lo encuentra donde se creó.
  const { result } = await createDynamicGroupWorkflow(req.scope).run({
    input: {
      ...siteDefaults(await siteFromRequest(req), DYNAMIC_GROUP_SITE_SCOPE),
      ...parsed.data,
    } as unknown as CreateDynamicGroupInput,
  });

  res.status(201).json({ dynamic_group: result });
}
