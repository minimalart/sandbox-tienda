import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { Modules } from '@medusajs/framework/utils';
import { CORPORATE_MODULE } from '../../../../../modules/corporate';
import CorporateModuleService, {
  assertRole,
} from '../../../../../modules/corporate/service';
import { MANAGER_ROLES } from '../../../../../modules/corporate/types';
import { PutMember } from '../../validators';

/** Resuelve la membership del caller y valida que sea manager del corporate del target. */
async function authorizeManager(
  req: AuthenticatedMedusaRequest,
  service: CorporateModuleService,
  memberId: string,
) {
  const callerId = req.auth_context.actor_id;
  const caller = await service.getActiveMembershipByCustomer(callerId);
  if (!caller) return { error: 'No pertenecés a ninguna empresa.' as const };
  assertRole(caller.role, MANAGER_ROLES);
  const target = await service.retrieveCorporateMember(memberId);
  if (!target || target.corporate_id !== caller.corporate_id) {
    return { error: 'Miembro no encontrado en tu empresa.' as const };
  }
  if (target.role === 'owner') {
    return { error: 'No se puede modificar al owner.' as const };
  }
  return { caller, target };
}

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const parsed = PutMember.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Invalid body' });
    return;
  }
  const service = req.scope.resolve<CorporateModuleService>(CORPORATE_MODULE);
  const memberId = req.params.id as string;
  const auth = await authorizeManager(req, service, memberId);
  if ('error' in auth) {
    res.status(403).json({ message: auth.error });
    return;
  }

  const updated = await service.updateCorporateMembers({ id: memberId, ...parsed.data } as any);

  // Sync customer group si cambió el estado.
  const corporate = await service.retrieveCorporate(auth.target.corporate_id);
  const cgId = corporate?.customer_group_id as string | undefined;
  if (cgId && parsed.data.status && parsed.data.status !== auth.target.status) {
    try {
      const customerService = req.scope.resolve(Modules.CUSTOMER);
      const entry = {
        customer_id: auth.target.customer_id as string,
        customer_group_id: cgId,
      };
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
  const service = req.scope.resolve<CorporateModuleService>(CORPORATE_MODULE);
  const memberId = req.params.id as string;
  const auth = await authorizeManager(req, service, memberId);
  if ('error' in auth) {
    res.status(403).json({ message: auth.error });
    return;
  }

  const corporate = await service.retrieveCorporate(auth.target.corporate_id);
  const cgId = corporate?.customer_group_id as string | undefined;
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

  await service.deleteCorporateMembers([memberId]);
  res.json({ id: memberId, deleted: true });
}
