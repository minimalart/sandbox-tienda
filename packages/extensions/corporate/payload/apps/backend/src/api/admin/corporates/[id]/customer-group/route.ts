import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { Modules } from '@medusajs/framework/utils';
import { CORPORATE_MODULE } from '../../../../../modules/corporate';
import type CorporateModuleService from '../../../../../modules/corporate/service';
import { linkCorporateCustomerGroupWorkflow } from '../../../../../workflows/link-corporate-customer-group';
import { PostCustomerGroup } from '../../validators';
import { siteFromRequest } from '../../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../../lib/multistore/scope';
import { CORPORATE_SITE_SCOPE } from '../../../../../modules/corporate/site-scope';

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const parsed = PostCustomerGroup.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Invalid body' });
    return;
  }
  const corporateId = req.params.id as string;
  const service = req.scope.resolve<CorporateModuleService>(CORPORATE_MODULE);

  // `req.params.id` es la raíz del dominio, como en `corporates/[id]`. Va antes del
  // switch y no adentro de cada rama: las dos acciones mutan la misma empresa —
  // `link` le cuelga un customer group, `unlink` se lo saca y de paso echa del grupo
  // a todos sus miembros activos—.
  await assertIdInSite(req.scope, await siteFromRequest(req), CORPORATE_SITE_SCOPE, corporateId);

  if (parsed.data.action === 'link') {
    const { result } = await linkCorporateCustomerGroupWorkflow(req.scope).run({
      input: { corporate_id: corporateId, customer_group_id: parsed.data.customer_group_id },
    });
    res.json({ corporate_id: corporateId, customer_group_id: result.customer_group_id });
    return;
  }

  // unlink: saca a los miembros activos del grupo y desvincula (no borra el grupo).
  const corporate = await service.retrieveCorporate(corporateId);
  const cgId = corporate?.customer_group_id as string | undefined;
  if (cgId) {
    try {
      const customerService = req.scope.resolve(Modules.CUSTOMER);
      const members = await service.listCorporateMembers({
        corporate_id: corporateId,
        status: 'active',
      });
      const entries = members
        .map((m) => ({ customer_id: m.customer_id as string, customer_group_id: cgId }))
        .filter((e) => e.customer_id);
      if (entries.length) await customerService.removeCustomerFromGroup(entries);
    } catch {
      /* best-effort */
    }
  }
  await service.updateCorporates({ id: corporateId, customer_group_id: null });
  res.json({ corporate_id: corporateId, customer_group_id: null });
}
