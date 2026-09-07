import type { MedusaContainer } from '@medusajs/framework/types';
import { MedusaError } from '@medusajs/framework/utils';
import { addInterval } from './lib';
import type RecurringOrderModuleService from './service';
import {
  compensateMercadoPagoSubscriptionRotation,
  rotateMercadoPagoSubscription,
  syncMercadoPagoSubscriptionStatus,
} from './payment';
import {
  releaseRecurringOrderReservations,
  resetAutomaticCyclesAfterPause,
} from './inventory-reservations';

export async function pauseRecurringOrderSafely(
  container: MedusaContainer,
  service: RecurringOrderModuleService,
  recurringOrder: any,
) {
  await syncMercadoPagoSubscriptionStatus(container, recurringOrder, 'paused');
  await releaseRecurringOrderReservations(container, recurringOrder.id);
  if (recurringOrder.payment_mode === 'mercadopago_auto') {
    await resetAutomaticCyclesAfterPause(container, recurringOrder.id);
  }
  return await service.pauseRecurringOrder(recurringOrder.id);
}

export async function skipNextRecurringOrderDelivery(
  container: MedusaContainer,
  service: RecurringOrderModuleService,
  recurringOrder: any,
): Promise<{ recurringOrder: any; authorizationUrl: string | null }> {
  if (recurringOrder.status !== 'active') {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      'Solo se puede omitir la próxima entrega de una suscripción activa.',
    );
  }
  if (recurringOrder.payment_mode !== 'mercadopago_auto') {
    const [updated] = await service.updateRecurringOrders([{
      id: recurringOrder.id,
      skip_next_cycle: true,
    }]);
    return { recurringOrder: updated, authorizationUrl: null };
  }

  const [cycle] = await service.listRenewalCycles(
    {
      recurring_order_id: recurringOrder.id,
      status: ['scheduled', 'retrying_stock', 'inventory_reserved', 'awaiting_authorization', 'awaiting_charge', 'past_due'],
    },
    { take: 1, order: { scheduled_at: 'ASC' } },
  );
  if (!cycle) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      'La próxima entrega ya está en proceso y no se puede omitir.',
    );
  }
  const next = addInterval(
    new Date(cycle.scheduled_at),
    recurringOrder.frequency_interval,
    recurringOrder.frequency_count,
  );
  const [nextCycle] = await service.createRenewalCycles([{
    recurring_order_id: recurringOrder.id,
    scheduled_at: next,
    status: 'awaiting_authorization',
    metadata: { created_by: 'customer-skip', replaces_cycle_id: cycle.id },
  }]);
  if (!nextCycle) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      'No se pudo crear el próximo ciclo de la suscripción.',
    );
  }
  try {
    const rotation = await rotateMercadoPagoSubscription(container, recurringOrder, {
      interval: recurringOrder.frequency_interval,
      count: recurringOrder.frequency_count,
      nextPaymentAt: next,
      cycleId: nextCycle.id,
    });
    try {
      await releaseRecurringOrderReservations(container, recurringOrder.id);
      await service.skipCycle(cycle.id, 'skip-next-cycle', { scheduleNext: false });
      const [updated] = await service.updateRecurringOrders([{
        id: recurringOrder.id,
        skip_next_cycle: false,
        next_execution_at: next,
        next_billing_at: next,
        external_subscription_id: rotation.externalSubscriptionId,
        financial_status: 'pending_authorization',
        provider_state: rotation.providerState,
        payment_context: {
          ...(recurringOrder.payment_context ?? {}),
          provider: 'mercado_pago',
          preapproval_id: rotation.externalSubscriptionId,
        },
      }]);
      await service.updateRenewalCycles([{
        id: nextCycle.id,
        confirmation_url: rotation.authorizationUrl,
      }]);
      return { recurringOrder: updated, authorizationUrl: rotation.authorizationUrl };
    } catch (error) {
      await compensateMercadoPagoSubscriptionRotation(container, recurringOrder, rotation);
      if (rotation.previousStatus === 'authorized') {
        await syncMercadoPagoSubscriptionStatus(container, recurringOrder, 'paused');
      }
      await service.updateRecurringOrders([{
        id: recurringOrder.id,
        next_execution_at: recurringOrder.next_execution_at,
        next_billing_at: recurringOrder.next_billing_at,
        external_subscription_id: recurringOrder.external_subscription_id,
        financial_status: rotation.previousStatus === 'authorized' ? 'paused' : recurringOrder.financial_status,
        provider_state: {
          ...(recurringOrder.provider_state ?? {}),
          status: rotation.previousStatus === 'authorized' ? 'paused' : rotation.previousStatus,
        },
        payment_context: recurringOrder.payment_context,
      }]);
      await service.updateRenewalCycles([{
        id: cycle.id,
        status: cycle.status === 'awaiting_authorization' ? cycle.status : 'scheduled',
        scheduled_at: cycle.scheduled_at,
        processed_at: null,
        cart_id: cycle.status === 'awaiting_authorization' ? cycle.cart_id : null,
        confirmation_url: cycle.confirmation_url,
        payment_status: cycle.status === 'awaiting_authorization' ? cycle.payment_status : null,
        expected_amount: cycle.status === 'awaiting_authorization' ? cycle.expected_amount : null,
        quote_snapshot: cycle.status === 'awaiting_authorization' ? cycle.quote_snapshot : null,
        quote_hash: cycle.status === 'awaiting_authorization' ? cycle.quote_hash : null,
        quoted_at: cycle.status === 'awaiting_authorization' ? cycle.quoted_at : null,
        inventory_reservation_ids: { ids: [], not_required: false },
        reserved_at: null,
        last_error: null,
        metadata: cycle.metadata,
      }]);
      throw error;
    }
  } finally {
    try {
      const persisted: any = await service.retrieveRenewalCycle(nextCycle.id);
      if (!persisted.confirmation_url) await service.deleteRenewalCycles([nextCycle.id]);
    } catch {
      // Ya fue eliminado durante la compensación o persistido correctamente.
    }
  }
}
