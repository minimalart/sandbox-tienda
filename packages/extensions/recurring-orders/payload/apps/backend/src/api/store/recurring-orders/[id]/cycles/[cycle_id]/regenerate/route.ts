import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { ownedRecurringOrder } from '../../../../utils';
import { runRenewalCycleLocked } from '../../../../../../../workflows/run-renewal-cycle';

/**
 * POST /store/recurring-orders/:id/cycles/:cycle_id/regenerate — el cliente
 * pide un link nuevo para un ciclo cuyo link venció (o quedó `failed` por
 * `payment_link_expired`). Resetea el ciclo a `scheduled` ahora y lo ejecuta
 * en el momento: la respuesta trae el link fresco.
 */
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const { service, recurringOrder } = await ownedRecurringOrder(req, req.params.id as string);

  let cycle: any;
  try {
    cycle = await service.retrieveRenewalCycle(req.params.cycle_id as string);
  } catch {
    res.status(404).json({ message: 'Renovación no encontrada.' });
    return;
  }
  if (cycle.recurring_order_id !== recurringOrder.id) {
    res.status(404).json({ message: 'Renovación no encontrada.' });
    return;
  }
  const expiredPending =
    cycle.status === 'pending_payment' &&
    cycle.expires_at &&
    new Date(cycle.expires_at) <= new Date();
  const expiredFailed =
    cycle.status === 'failed' && cycle.last_error === 'payment_link_expired';
  if (!expiredPending && !expiredFailed) {
    res.status(400).json({ message: 'Esta renovación no admite regenerar el link.' });
    return;
  }
  if (!['active', 'pending_payment', 'failed'].includes(recurringOrder.status)) {
    res.status(400).json({ message: 'La suscripción no está activa.' });
    return;
  }

  // Reset del ciclo a ejecutable + suscripción operativa, y ejecución inmediata.
  await service.updateRenewalCycles([
    {
      id: cycle.id,
      status: 'scheduled',
      scheduled_at: new Date(),
      processed_at: null,
      confirmation_url: null,
      payment_status: null,
      expires_at: null,
      last_error: null,
      attempt_count: 0,
    },
  ]);
  if (recurringOrder.status === 'failed') {
    await service.updateRecurringOrders([
      { id: recurringOrder.id, status: 'active', consecutive_failures: 0 },
    ]);
  }
  await service.log({
    recurring_order_id: recurringOrder.id,
    event: 'link_regenerated',
    actor_type: 'customer',
    actor_id: req.auth_context.actor_id,
    data: { cycle_id: cycle.id },
  });

  const result = await runRenewalCycleLocked(req.scope, {
    cycleId: cycle.id,
    force: true,
  });
  res.status(200).json({ result });
}
