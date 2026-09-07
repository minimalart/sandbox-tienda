import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { COMPANY_MODULE } from '../../../../../modules/company';
import type CompanyModuleService from '../../../../../modules/company/service';

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const customerId = req.auth_context.actor_id;
  const service = req.scope.resolve<CompanyModuleService>(COMPANY_MODULE);
  const membership = await service.getMembershipByCustomer(customerId);
  if (!membership) {
    res.json({ members: [] });
    return;
  }
  const members = await service.listCompanyMembers({ company_id: membership.company_id });
  res.json({ members });
}
