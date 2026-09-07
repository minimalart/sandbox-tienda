import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { BILLING_PROFILE_MODULE } from '../../../../../modules/billing-profile';
import type BillingProfileModuleService from '../../../../../modules/billing-profile/service';

// GET /admin/customers/:id/billing-profiles — perfiles fiscales del cliente (read-only v1).
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<BillingProfileModuleService>(BILLING_PROFILE_MODULE);
  const billing_profiles = await service.listByCustomer(req.params.id as string);
  res.json({ billing_profiles });
}
