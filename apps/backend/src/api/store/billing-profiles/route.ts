import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { Modules } from '@medusajs/framework/utils';
import { BILLING_PROFILE_MODULE } from '../../../modules/billing-profile';
import type BillingProfileModuleService from '../../../modules/billing-profile/service';
import { PostCreateProfile } from './validators';

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const customerId = req.auth_context.actor_id;
  const service = req.scope.resolve<BillingProfileModuleService>(BILLING_PROFILE_MODULE);
  const billing_profiles = await service.listByCustomer(customerId);
  res.json({ billing_profiles });
}

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const parsed = PostCreateProfile.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Datos inválidos' });
    return;
  }
  const customerId = req.auth_context.actor_id;
  const service = req.scope.resolve<BillingProfileModuleService>(BILLING_PROFILE_MODULE);
  const { is_default, ...data } = parsed.data;

  const created = await service.createBillingProfiles({
    customer_id: customerId,
    invoice_type: 'invoice_a',
    ...data,
  });
  const profile = Array.isArray(created) ? created[0] : created;

  if (is_default && profile) {
    await service.setDefault(customerId, profile.id);
  }

  const eventBus = req.scope.resolve(Modules.EVENT_BUS);
  await eventBus.emit({ name: 'billing_profile.created', data: { id: profile?.id } });

  res.status(201).json({ billing_profile: profile });
}
