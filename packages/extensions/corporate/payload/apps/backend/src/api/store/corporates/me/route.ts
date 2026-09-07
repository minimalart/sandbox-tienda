import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { CORPORATE_MODULE } from '../../../../modules/corporate';
import CorporateModuleService, {
  assertRole,
} from '../../../../modules/corporate/service';
import { MANAGER_ROLES } from '../../../../modules/corporate/types';
import { PutCorporateMe } from '../validators';

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const customerId = req.auth_context.actor_id;
  const service = req.scope.resolve<CorporateModuleService>(CORPORATE_MODULE);

  const membership = await service.getActiveMembershipByCustomer(customerId);
  if (!membership) {
    res.json({ corporate: null, membership: null });
    return;
  }
  const corporate = await service.retrieveCorporate(membership.corporate_id);
  const members = await service.listCorporateMembers({
    corporate_id: membership.corporate_id,
  });
  const rules = await service.getActiveRules(membership.corporate_id);

  res.json({
    corporate,
    membership: { id: membership.id, role: membership.role, status: membership.status },
    role: membership.role,
    members,
    rules,
  });
}

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const parsed = PutCorporateMe.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Invalid body' });
    return;
  }
  const customerId = req.auth_context.actor_id;
  const service = req.scope.resolve<CorporateModuleService>(CORPORATE_MODULE);

  const membership = await service.getActiveMembershipByCustomer(customerId);
  if (!membership) {
    res.status(404).json({ message: 'No pertenecés a ninguna empresa.' });
    return;
  }
  assertRole(membership.role, MANAGER_ROLES);

  const updated = await service.updateCorporates({
    id: membership.corporate_id,
    ...parsed.data,
  } as any);
  res.json({ corporate: updated });
}
