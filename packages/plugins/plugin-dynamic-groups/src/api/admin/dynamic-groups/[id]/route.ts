import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { siteFromRequest } from '../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../lib/multistore/scope';
import { DYNAMIC_GROUP_SITE_SCOPE } from '../../../../modules/dynamic-groups/site-scope';
import { Modules } from '@medusajs/framework/utils';
import { DYNAMIC_GROUPS_MODULE } from '../../../../modules/dynamic-groups';
import type DynamicGroupsModuleService from '../../../../modules/dynamic-groups/service';
import { PostUpdateDynamicGroup } from '../validators';

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  // `req.params.id` es la raíz del dominio: guardarla alcanza, sus hijas no
  // son alcanzables por otra vía. Y va en TODOS los handlers, no sólo el GET.
  await assertIdInSite(req.scope, await siteFromRequest(req), DYNAMIC_GROUP_SITE_SCOPE, req.params.id as string);

  const service = req.scope.resolve<DynamicGroupsModuleService>(
    DYNAMIC_GROUPS_MODULE,
  );
  const group = await service.retrieveDynamicGroup(req.params.id as string);
  res.json({ dynamic_group: group });
}

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  // `req.params.id` es la raíz del dominio: guardarla alcanza, sus hijas no
  // son alcanzables por otra vía. Y va en TODOS los handlers, no sólo el GET.
  await assertIdInSite(req.scope, await siteFromRequest(req), DYNAMIC_GROUP_SITE_SCOPE, req.params.id as string);

  const parsed = PostUpdateDynamicGroup.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Invalid body' });
    return;
  }

  const service = req.scope.resolve<DynamicGroupsModuleService>(
    DYNAMIC_GROUPS_MODULE,
  );
  const id = req.params.id as string;
  const existing = await service.retrieveDynamicGroup(id);

  const updated = await service.updateDynamicGroups({ id, ...parsed.data } as any);

  // Mantener el nombre del customer_group nativo en sync.
  const cgId = existing?.customer_group_id as string | undefined;
  if (parsed.data.name && cgId) {
    try {
      const customerService = req.scope.resolve(Modules.CUSTOMER);
      await customerService.updateCustomerGroups(cgId, {
        name: parsed.data.name,
      });
    } catch {
      /* best-effort */
    }
  }

  res.json({ dynamic_group: updated });
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  // `req.params.id` es la raíz del dominio: guardarla alcanza, sus hijas no
  // son alcanzables por otra vía. Y va en TODOS los handlers, no sólo el GET.
  await assertIdInSite(req.scope, await siteFromRequest(req), DYNAMIC_GROUP_SITE_SCOPE, req.params.id as string);

  const service = req.scope.resolve<DynamicGroupsModuleService>(
    DYNAMIC_GROUPS_MODULE,
  );
  const id = req.params.id as string;
  const existing = await service.retrieveDynamicGroup(id);

  // Borra también el customer_group nativo (libera a los miembros).
  const cgId = existing?.customer_group_id as string | undefined;
  if (cgId) {
    try {
      const customerService = req.scope.resolve(Modules.CUSTOMER);
      await customerService.deleteCustomerGroups([cgId]);
    } catch {
      /* best-effort */
    }
  }
  await service.deleteDynamicGroups([id]);

  res.json({ id, deleted: true });
}
