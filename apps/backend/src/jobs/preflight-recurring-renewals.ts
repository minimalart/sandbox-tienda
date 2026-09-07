import { isSubscriptionFeatureEnabled } from '../modules/recurring-order/settings';
import type { Logger, MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { RECURRING_ORDER_MODULE } from '../modules/recurring-order';
import type RecurringOrderModuleService from '../modules/recurring-order/service';
import { runRenewalCycleLocked } from '../workflows/run-renewal-cycle';
import { withSubscriptionLock } from '../workflows/run-renewal-cycle';
import {
  rotateMercadoPagoSubscription,
  syncMercadoPagoSubscriptionStatus,
} from '../modules/recurring-order/payment';
import { releaseRecurringOrderReservations } from '../modules/recurring-order/inventory-reservations';

const hasReservation = (value: unknown): boolean => {
  const state = value as { ids?: unknown[]; not_required?: unknown } | null;
  return (
    (Array.isArray(state?.ids) && state.ids.some((id) => typeof id === 'string')) ||
    state?.not_required === true
  );
};

async function rotateAfterSkippedCycle(
  container: MedusaContainer,
  service: RecurringOrderModuleService,
  subscription: any,
  reason: string
) {
  const [nextCycle] = await service.listRenewalCycles(
    { recurring_order_id: subscription.id, status: 'scheduled' },
    { take: 1, order: { scheduled_at: 'ASC' } }
  );
  if (!nextCycle) return;
  try {
    const rotation = await rotateMercadoPagoSubscription(container, subscription, {
      interval: subscription.frequency_interval,
      count: subscription.frequency_count,
      nextPaymentAt: new Date(nextCycle.scheduled_at),
      cycleId: nextCycle.id,
    });
    await service.updateRecurringOrders([
      {
        id: subscription.id,
        external_subscription_id: rotation.externalSubscriptionId,
        financial_status: 'pending_authorization',
        provider_state: rotation.providerState,
        payment_context: {
          ...(subscription.payment_context ?? {}),
          provider: 'mercado_pago',
          preapproval_id: rotation.externalSubscriptionId,
        },
      },
    ]);
    await service.updateRenewalCycles([
      {
        id: nextCycle.id,
        status: 'awaiting_authorization',
        confirmation_url: rotation.authorizationUrl,
        payment_status: 'pending',
      },
    ]);
  } catch (error) {
    await service.updateRecurringOrders([
      {
        id: subscription.id,
        financial_status: 'paused',
        provider_state: {
          ...(subscription.provider_state ?? {}),
          status: 'paused',
          schedule_reauthorization_required: true,
          schedule_reauthorization_reason: reason,
        },
      },
    ]);
    await service.upsertAlert({
      dedupe_key: `payment-rotation:${nextCycle.id}`,
      sales_channel_id: subscription.sales_channel_id,
      recurring_order_id: subscription.id,
      renewal_cycle_id: nextCycle.id,
      type: 'payment',
      severity: 'critical',
      title: 'La próxima agenda necesita reautorización',
      message: (error as Error).message,
      data: { reason, detected_at: new Date().toISOString() },
    });
  }
}

/**
 * Cierra la cotización y sincroniza el importe del preapproval antes del cobro.
 * El webhook financiero sólo concilia esa cotización: nunca la recalcula.
 */
export default async function preflightRecurringRenewalsJob(
  container: MedusaContainer
): Promise<void> {
  if (
    !isSubscriptionFeatureEnabled('SUBSCRIPTIONS_V2_ENABLED') ||
    !isSubscriptionFeatureEnabled('SUBSCRIPTIONS_AUTO_PAYMENT_ENABLED')
  )
    return;
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const service = container.resolve<RecurringOrderModuleService>(RECURRING_ORDER_MODULE);
  const now = new Date();
  // Busca hasta el máximo aceptado por plan; cada contrato decide abajo cuándo
  // entra realmente según su snapshot versionado de reservation_hours.
  const horizon = new Date(now.getTime() + 168 * 60 * 60 * 1000);
  try {
    const cycles = await service.listRenewalCycles(
      {
        status: 'scheduled',
        scheduled_at: { $gte: now, $lte: horizon },
        recurring_order: { status: 'active', payment_mode: 'mercadopago_auto' },
      },
      { take: 100, order: { scheduled_at: 'ASC' } }
    );
    for (const cycle of cycles) {
      try {
        const subscription: any = await service.retrieveRecurringOrder(cycle.recurring_order_id);
        const reservationHours = Number(subscription.plan_snapshot?.reservation_hours ?? 24);
        if (
          new Date(cycle.scheduled_at).getTime() >
          now.getTime() + reservationHours * 60 * 60 * 1000
        ) {
          continue;
        }
        await runRenewalCycleLocked(container, { cycleId: cycle.id, force: true });
      } catch (error) {
        logger.warn(`[Subscriptions V2] preflight ${cycle.id} falló: ${(error as Error).message}`);
      }
    }

    const paymentRetries = await service.listRenewalCycles(
      {
        status: 'past_due',
        scheduled_at: { $lte: now },
        recurring_order: { status: 'active', payment_mode: 'mercadopago_auto' },
      },
      { take: 100, order: { scheduled_at: 'ASC' } }
    );
    for (const listedCycle of paymentRetries) {
      try {
        await withSubscriptionLock(
          container,
          [`order:${listedCycle.recurring_order_id}`, `renewal:${listedCycle.id}`],
          async () => {
            const cycle: any = await service.retrieveRenewalCycle(listedCycle.id);
            if (cycle.status !== 'past_due') return;
            const subscription: any = await service.retrieveRecurringOrder(
              cycle.recurring_order_id
            );
            const expired = cycle.retry_until && now >= new Date(cycle.retry_until);
            if (expired || !hasReservation(cycle.inventory_reservation_ids)) {
              await releaseRecurringOrderReservations(container, subscription.id);
              await service.skipCycle(
                cycle.id,
                expired ? 'payment-retries-exhausted' : 'payment-reservation-lost',
                { scheduleNext: true },
                now
              );
              await rotateAfterSkippedCycle(
                container,
                service,
                subscription,
                expired ? 'payment-retries-exhausted' : 'payment-reservation-lost'
              );
              return;
            }
            await service.updateRenewalCycles([
              {
                id: cycle.id,
                status: 'awaiting_charge',
                last_error: null,
              },
            ]);
            try {
              await syncMercadoPagoSubscriptionStatus(container, subscription, 'authorized');
            } catch (error) {
              await service.updateRenewalCycles([
                {
                  id: cycle.id,
                  status: 'past_due',
                  last_error: (error as Error).message,
                },
              ]);
              throw error;
            }
          }
        );
      } catch (error) {
        logger.warn(
          `[Subscriptions V2] reintento de cobro ${listedCycle.id} falló: ${(error as Error).message}`
        );
      }
    }
  } catch (error) {
    logger.error(`[Subscriptions V2] barrido preflight falló: ${(error as Error).message}`);
  }
}

export const config = {
  name: 'preflight-recurring-renewals',
  schedule: process.env.SUBSCRIPTIONS_PREFLIGHT_CRON || '7 * * * *',
};
