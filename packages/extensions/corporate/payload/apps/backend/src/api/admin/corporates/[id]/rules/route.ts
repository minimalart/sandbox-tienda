import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { siteFromRequest } from '../../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../../lib/multistore/scope';
import { CORPORATE_SITE_SCOPE } from '../../../../../modules/corporate/site-scope';
import { Modules } from '@medusajs/framework/utils';
import { CORPORATE_MODULE } from '../../../../../modules/corporate';
import type CorporateModuleService from '../../../../../modules/corporate/service';
import { PostCreateRule } from '../../validators';

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  // `req.params.id` es la raíz del dominio: guardarla alcanza, sus hijas no
  // son alcanzables por otra vía. Y va en TODOS los handlers, no sólo el GET.
  await assertIdInSite(req.scope, await siteFromRequest(req), CORPORATE_SITE_SCOPE, req.params.id as string);

  const service = req.scope.resolve<CorporateModuleService>(CORPORATE_MODULE);
  const rules = await service.listCorporateRules({
    corporate_id: req.params.id as string,
  });
  res.json({ rules });
}

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  // `req.params.id` es la raíz del dominio: guardarla alcanza, sus hijas no
  // son alcanzables por otra vía. Y va en TODOS los handlers, no sólo el GET.
  await assertIdInSite(req.scope, await siteFromRequest(req), CORPORATE_SITE_SCOPE, req.params.id as string);

  const parsed = PostCreateRule.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Invalid body' });
    return;
  }
  const service = req.scope.resolve<CorporateModuleService>(CORPORATE_MODULE);
  const created = await service.createCorporateRules({
    corporate_id: req.params.id as string,
    type: parsed.data.type,
    config: parsed.data.config,
    enabled: parsed.data.enabled ?? true,
  });
  const rule = Array.isArray(created) ? created[0] : created;

  const eventBus = req.scope.resolve(Modules.EVENT_BUS);
  await eventBus.emit({ name: 'corporate.rule.updated', data: { id: req.params.id } });

  res.status(201).json({ rule });
}
