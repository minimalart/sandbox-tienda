import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { Modules } from '@medusajs/framework/utils';
import { z } from 'zod';
import { COMPANY_MODULE } from '../../../../../modules/company';
import type CompanyModuleService from '../../../../../modules/company/service';
import { linkCompanyCustomerGroupWorkflow } from '../../../../../workflows/link-company-customer-group';
import { siteFromRequest, assertRowInSite } from '../../../../../lib/multistore';
import { COMPANY_SITE_SCOPE } from '../../../../../modules/company/site-scope';

const Body = z.object({
  action: z.enum(['link', 'unlink']),
  customer_group_id: z.string().optional(),
});

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Datos inválidos' });
    return;
  }
  const companyId = req.params.id as string;
  const service = req.scope.resolve<CompanyModuleService>(COMPANY_MODULE);

  // Como en `companies/[id]`: se lee la empresa y se chequea la fila. Va ANTES del
  // switch de acción y no adentro de cada rama, porque las dos mutan la misma
  // empresa —`link` le cuelga un customer group, `unlink` se lo saca junto con los
  // miembros—. Y va con la fila leída una sola vez: la rama `unlink` la reusa, así
  // que el guard no agrega una consulta, mueve la que ya estaba.
  const company = await service.retrieveCompany(companyId);
  assertRowInSite(company as Record<string, unknown>, await siteFromRequest(req), COMPANY_SITE_SCOPE);

  if (parsed.data.action === 'link') {
    const { result } = await linkCompanyCustomerGroupWorkflow(req.scope).run({
      input: { company_id: companyId, customer_group_id: parsed.data.customer_group_id },
    });
    res.json({ company_id: companyId, customer_group_id: result.customer_group_id });
    return;
  }

  const cgId = company?.customer_group_id as string | undefined;
  if (cgId) {
    try {
      const customerService = req.scope.resolve(Modules.CUSTOMER);
      const members = await service.getActiveMembers(companyId);
      const entries = members
        .map((m) => ({ customer_id: m.customer_id as string, customer_group_id: cgId }))
        .filter((e) => e.customer_id);
      if (entries.length) await customerService.removeCustomerFromGroup(entries);
    } catch {
      /* best-effort */
    }
  }
  await service.updateCompanies({ id: companyId, customer_group_id: null });
  res.json({ company_id: companyId, customer_group_id: null });
}
