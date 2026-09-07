import type { MedusaContainer } from '@medusajs/framework/types';
import { deleteReservationsWorkflow } from '@medusajs/medusa/core-flows';
import { RECURRING_ORDER_MODULE } from './types';
import type RecurringOrderModuleService from './service';

const idsFrom = (value: unknown): string[] => {
  const ids = Array.isArray(value)
    ? value
    : Array.isArray((value as { ids?: unknown[] } | null)?.ids)
      ? (value as { ids: unknown[] }).ids
      : [];
  return ids.filter((id): id is string => typeof id === 'string');
};

/** Libera reservas abiertas antes de pausar, omitir o cancelar una suscripción. */
export async function releaseRecurringOrderReservations(
  container: MedusaContainer,
  recurringOrderId: string,
): Promise<void> {
  const service = container.resolve<RecurringOrderModuleService>(RECURRING_ORDER_MODULE);
  const cycles: any[] = await service.listRenewalCycles(
    {
      recurring_order_id: recurringOrderId,
      status: [
        'scheduled', 'forecasted', 'quoted', 'inventory_reserved', 'processing',
        'retrying_stock', 'awaiting_authorization', 'awaiting_charge', 'past_due',
        'pending_payment',
      ],
    },
    { take: 100 },
  );
  for (const cycle of cycles) {
    const ids = idsFrom(cycle.inventory_reservation_ids);
    if (!ids.length) continue;
    try {
      await deleteReservationsWorkflow(container).run({ input: { ids } });
      await service.updateRenewalCycles([{
        id: cycle.id,
        inventory_reservation_ids: { ids: [], not_required: false },
        reserved_at: null,
      }]);
    } catch (error) {
      await service.upsertAlert({
        dedupe_key: `reservation-release:${cycle.id}`,
        sales_channel_id: null,
        recurring_order_id: recurringOrderId,
        renewal_cycle_id: cycle.id,
        type: 'inventory',
        severity: 'critical',
        title: 'No se pudo liberar una reserva de suscripción',
        message: (error as Error).message,
        data: { reservation_ids: ids, detected_at: new Date().toISOString() },
      });
    }
  }
}

/**
 * Devuelve a `scheduled` cualquier ciclo automático que quedó a mitad de
 * preflight al pausar. Sin esta normalización, reanudar podía dejar un ciclo
 * `awaiting_charge` sin reserva y fuera de todos los jobs.
 */
export async function resetAutomaticCyclesAfterPause(
  container: MedusaContainer,
  recurringOrderId: string,
): Promise<void> {
  const service = container.resolve<RecurringOrderModuleService>(RECURRING_ORDER_MODULE);
  const cycles: any[] = await service.listRenewalCycles(
    {
      recurring_order_id: recurringOrderId,
      status: [
        'forecasted', 'quoted', 'inventory_reserved', 'processing',
        'retrying_stock', 'awaiting_charge', 'past_due',
      ],
    },
    { take: 100 },
  );
  for (const cycle of cycles) {
    await service.updateRenewalCycles([{
      id: cycle.id,
      status: 'scheduled',
      processed_at: null,
      cart_id: null,
      confirmation_url: null,
      payment_status: null,
      payment_reference: null,
      expected_amount: null,
      charged_amount: null,
      quote_snapshot: null,
      quote_hash: null,
      quoted_at: null,
      inventory_reservation_ids: { ids: [], not_required: false },
      reserved_at: null,
      retry_until: null,
      last_error: null,
    }]);
  }
}
