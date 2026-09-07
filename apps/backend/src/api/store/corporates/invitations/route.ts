import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { CORPORATE_MODULE } from '../../../../modules/corporate';
import CorporateModuleService, {
  assertRole,
} from '../../../../modules/corporate/service';
import { MANAGER_ROLES } from '../../../../modules/corporate/types';
import { inviteCorporateMemberWorkflow } from '../../../../workflows/invite-corporate-member';
import { PostInvite } from '../validators';

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const parsed = PostInvite.safeParse(req.body);
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

  const { result } = await inviteCorporateMemberWorkflow(req.scope).run({
    input: {
      corporate_id: membership.corporate_id,
      email: parsed.data.email,
      role: parsed.data.role ?? 'buyer',
      invited_by: customerId,
    },
  });

  res.status(201).json({ invitation: result });
}
