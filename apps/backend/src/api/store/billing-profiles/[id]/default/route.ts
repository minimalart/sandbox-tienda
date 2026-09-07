import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { Modules } from '@medusajs/framework/utils';
import { BILLING_PROFILE_MODULE } from '../../../../../modules/billing-profile';
import BillingProfileModuleService, {
  assertOwner,
} from '../../../../../modules/billing-profile/service';

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const customerId = req.auth_context.actor_id;
  const id = req.params.id as string;
  const service = req.scope.resolve<BillingProfileModuleService>(BILLING_PROFILE_MODULE);

  const existing = await service.retrieveBillingProfile(id).catch(() => null);
  assertOwner(existing, customerId);

  await service.setDefault(customerId, id);

  const eventBus = req.scope.resolve(Modules.EVENT_BUS);
  await eventBus.emit({ name: 'billing_profile.default_changed', data: { id } });

  res.json({ id, is_default: true });
}
