import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { Modules } from '@medusajs/framework/utils';
import { BILLING_PROFILE_MODULE } from '../../../../modules/billing-profile';
import BillingProfileModuleService, {
  assertOwner,
} from '../../../../modules/billing-profile/service';
import { PutUpdateProfile } from '../validators';

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const parsed = PutUpdateProfile.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Datos inválidos' });
    return;
  }
  const customerId = req.auth_context.actor_id;
  const id = req.params.id as string;
  const service = req.scope.resolve<BillingProfileModuleService>(BILLING_PROFILE_MODULE);

  const existing = await service.retrieveBillingProfile(id).catch(() => null);
  assertOwner(existing, customerId);

  const { is_default, ...data } = parsed.data;
  const updated = await service.updateBillingProfiles({ id, ...data } as any);
  if (is_default) {
    await service.setDefault(customerId, id);
  }

  const eventBus = req.scope.resolve(Modules.EVENT_BUS);
  await eventBus.emit({ name: 'billing_profile.updated', data: { id } });

  res.json({ billing_profile: updated });
}

export async function DELETE(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const customerId = req.auth_context.actor_id;
  const id = req.params.id as string;
  const service = req.scope.resolve<BillingProfileModuleService>(BILLING_PROFILE_MODULE);

  const existing = await service.retrieveBillingProfile(id).catch(() => null);
  assertOwner(existing, customerId);

  // Borrar el default deja al cliente SIN default (recomendación PRD).
  await service.deleteBillingProfiles([id]);

  const eventBus = req.scope.resolve(Modules.EVENT_BUS);
  await eventBus.emit({ name: 'billing_profile.deleted', data: { id } });

  res.json({ id, deleted: true });
}
