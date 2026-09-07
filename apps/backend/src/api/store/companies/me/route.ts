import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { Modules } from '@medusajs/framework/utils';
import { COMPANY_MODULE } from '../../../../modules/company';
import CompanyModuleService, { assertRole } from '../../../../modules/company/service';
import { COMPANY_MANAGER_ROLES } from '../../../../modules/company/types';
import { PutCompanyMe } from '../validators';

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const customerId = req.auth_context.actor_id;
  const service = req.scope.resolve<CompanyModuleService>(COMPANY_MODULE);
  const membership = await service.getMembershipByCustomer(customerId);
  if (!membership) {
    res.json({ company: null, membership: null });
    return;
  }
  const company = await service.retrieveCompany(membership.company_id);
  const members = await service.listCompanyMembers({ company_id: membership.company_id });

  // Enriquecer con email/nombre del customer (la tabla de Usuarios los muestra).
  const customerIds = members.map((m) => m.customer_id).filter(Boolean);
  const byId: Record<string, { email?: string; first_name?: string | null; last_name?: string | null }> = {};
  if (customerIds.length) {
    try {
      const customerService = req.scope.resolve(Modules.CUSTOMER);
      const customers = await customerService.listCustomers(
        { id: customerIds },
        { select: ['id', 'email', 'first_name', 'last_name'] },
      );
      for (const c of customers) {
        byId[c.id] = { email: c.email, first_name: c.first_name, last_name: c.last_name };
      }
    } catch {
      /* best-effort */
    }
  }
  const enriched = members.map((m) => ({
    ...m,
    email: byId[m.customer_id]?.email ?? null,
    first_name: byId[m.customer_id]?.first_name ?? null,
    last_name: byId[m.customer_id]?.last_name ?? null,
  }));

  res.json({
    company,
    membership: { id: membership.id, role: membership.role, status: membership.status },
    role: membership.role,
    members: enriched,
  });
}

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const parsed = PutCompanyMe.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Datos inválidos' });
    return;
  }
  const customerId = req.auth_context.actor_id;
  const service = req.scope.resolve<CompanyModuleService>(COMPANY_MODULE);
  const membership = await service.getMembershipByCustomer(customerId);
  if (!membership) {
    res.status(404).json({ message: 'No pertenecés a ninguna empresa.' });
    return;
  }
  assertRole(membership.role, COMPANY_MANAGER_ROLES);
  const updated = await service.updateCompanies({ id: membership.company_id, ...parsed.data } as any);
  res.json({ company: updated });
}
