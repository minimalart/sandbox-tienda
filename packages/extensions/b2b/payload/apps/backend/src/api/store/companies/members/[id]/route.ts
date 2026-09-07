import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { Modules } from '@medusajs/framework/utils';
import { COMPANY_MODULE } from '../../../../../modules/company';
import CompanyModuleService, { assertRole } from '../../../../../modules/company/service';
import { COMPANY_MANAGER_ROLES } from '../../../../../modules/company/types';
import { PutMember } from '../../validators';

async function authorize(
  req: AuthenticatedMedusaRequest,
  service: CompanyModuleService,
  memberId: string,
) {
  const caller = await service.getMembershipByCustomer(req.auth_context.actor_id);
  if (!caller) return { error: 'No pertenecés a ninguna empresa.' as const };
  assertRole(caller.role, COMPANY_MANAGER_ROLES);
  const target = await service.retrieveCompanyMember(memberId).catch(() => null);
  if (!target || target.company_id !== caller.company_id) {
    return { error: 'Miembro no encontrado en tu empresa.' as const };
  }
  if (target.role === 'owner') return { error: 'No se puede modificar al owner.' as const };
  return { target };
}

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const parsed = PutMember.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Datos inválidos' });
    return;
  }
  const service = req.scope.resolve<CompanyModuleService>(COMPANY_MODULE);
  const memberId = req.params.id as string;
  const auth = await authorize(req, service, memberId);
  if ('error' in auth) {
    res.status(403).json({ message: auth.error });
    return;
  }
  const updated = await service.updateCompanyMembers({ id: memberId, ...parsed.data } as any);

  // Sync customer group si cambió el estado.
  const company = await service.retrieveCompany(auth.target.company_id);
  const cgId = company?.customer_group_id as string | undefined;
  if (cgId && parsed.data.status && parsed.data.status !== auth.target.status) {
    try {
      const customerService = req.scope.resolve(Modules.CUSTOMER);
      const entry = { customer_id: auth.target.customer_id as string, customer_group_id: cgId };
      if (parsed.data.status === 'active') await customerService.addCustomerToGroup(entry);
      else await customerService.removeCustomerFromGroup(entry);
    } catch {
      /* best-effort */
    }
  }
  res.json({ member: updated });
}

export async function DELETE(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const service = req.scope.resolve<CompanyModuleService>(COMPANY_MODULE);
  const memberId = req.params.id as string;
  const auth = await authorize(req, service, memberId);
  if ('error' in auth) {
    res.status(403).json({ message: auth.error });
    return;
  }
  const company = await service.retrieveCompany(auth.target.company_id);
  const cgId = company?.customer_group_id as string | undefined;
  if (cgId && auth.target.customer_id) {
    try {
      const customerService = req.scope.resolve(Modules.CUSTOMER);
      await customerService.removeCustomerFromGroup({
        customer_id: auth.target.customer_id as string,
        customer_group_id: cgId,
      });
    } catch {
      /* best-effort */
    }
  }
  await service.deleteCompanyMembers([memberId]);
  res.json({ id: memberId, deleted: true });
}
