import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { CORPORATE_MODULE } from '../../../../../modules/corporate';
import type CorporateModuleService from '../../../../../modules/corporate/service';

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const customerId = req.auth_context.actor_id;
  const service = req.scope.resolve<CorporateModuleService>(CORPORATE_MODULE);

  const membership = await service.getActiveMembershipByCustomer(customerId);
  if (!membership) {
    res.json({ members: [] });
    return;
  }
  const members = await service.listCorporateMembers({
    corporate_id: membership.corporate_id,
  });
  res.json({ members });
}
