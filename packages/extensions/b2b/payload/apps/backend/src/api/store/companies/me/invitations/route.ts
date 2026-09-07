import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { COMPANY_MODULE } from '../../../../../modules/company';
import CompanyModuleService, { assertRole } from '../../../../../modules/company/service';
import { COMPANY_MANAGER_ROLES } from '../../../../../modules/company/types';
import { inviteCompanyMemberWorkflow } from '../../../../../workflows/invite-company-member';
import { PostInvite } from '../../validators';

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const parsed = PostInvite.safeParse(req.body);
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
  const { result } = await inviteCompanyMemberWorkflow(req.scope).run({
    input: {
      company_id: membership.company_id,
      email: parsed.data.email,
      role: parsed.data.role ?? 'buyer',
      invited_by: customerId,
    },
  });
  res.status(201).json({ invitation: result });
}
