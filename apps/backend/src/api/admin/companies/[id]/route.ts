import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { Modules } from '@medusajs/framework/utils';
import { z } from 'zod';
import { COMPANY_MODULE } from '../../../../modules/company';
import type CompanyModuleService from '../../../../modules/company/service';
import { siteFromRequest, assertRowInSite } from '../../../../lib/multistore';
import { COMPANY_SITE_SCOPE } from '../../../../modules/company/site-scope';

const PostUpdate = z.object({
  name: z.string().min(2).optional(),
  legal_name: z.string().optional().nullable(),
  tax_id: z.string().optional().nullable(),
  status: z.enum(['pending', 'active', 'suspended', 'archived']).optional(),
  sales_channel_id: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<CompanyModuleService>(COMPANY_MODULE);
  const id = req.params.id as string;
  const company = await service.retrieveCompany(id);
  assertRowInSite(company as Record<string, unknown>, await siteFromRequest(req), COMPANY_SITE_SCOPE);
  const members = await service.listCompanyMembers({ company_id: id });
  const invitations = await service.listCompanyInvitations({ company_id: id });

  // Enriquecer cada miembro con el email/nombre del customer.
  let enriched = members as Array<Record<string, unknown>>;
  const customerIds = members.map((m) => m.customer_id as string).filter(Boolean);
  if (customerIds.length) {
    try {
      const customerService = req.scope.resolve(Modules.CUSTOMER);
      const customers = await customerService.listCustomers(
        { id: customerIds },
        { select: ['id', 'email', 'first_name', 'last_name'] },
      );
      const byId = new Map(customers.map((c) => [c.id, c]));
      enriched = members.map((m) => {
        const cust = byId.get(m.customer_id as string);
        return {
          ...m,
          email: cust?.email ?? null,
          first_name: cust?.first_name ?? null,
          last_name: cust?.last_name ?? null,
        };
      });
    } catch {
      /* best-effort: si falla, devolvemos los miembros sin enriquecer */
    }
  }

  res.json({ company: { ...company, members: enriched, invitations } });
}

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const parsed = PostUpdate.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Datos inválidos' });
    return;
  }
  const service = req.scope.resolve<CompanyModuleService>(COMPANY_MODULE);
  assertRowInSite(
    (await service.retrieveCompany(req.params.id as string)) as Record<string, unknown>,
    await siteFromRequest(req),
    COMPANY_SITE_SCOPE,
  );

  const company = await service.updateCompanies({ id: req.params.id, ...parsed.data } as any);
  res.json({ company });
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<CompanyModuleService>(COMPANY_MODULE);
  const id = req.params.id as string;
  const existing = await service.retrieveCompany(id);
  assertRowInSite(existing as Record<string, unknown>, await siteFromRequest(req), COMPANY_SITE_SCOPE);

  // Libera el customer group creado para la empresa (si lo hubiera).
  const cgId = existing?.customer_group_id as string | undefined;
  if (cgId) {
    try {
      const customerService = req.scope.resolve(Modules.CUSTOMER);
      await customerService.deleteCustomerGroups([cgId]);
    } catch {
      /* best-effort */
    }
  }

  const members = await service.listCompanyMembers({ company_id: id });
  if (members.length) {
    await service.deleteCompanyMembers(members.map((m) => m.id));
  }
  const invitations = await service.listCompanyInvitations({ company_id: id });
  if (invitations.length) {
    await service.deleteCompanyInvitations(invitations.map((i) => i.id));
  }
  await service.deleteCompanies([id]);

  res.json({ id, deleted: true });
}
