import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import type { INotificationModuleService, Logger } from '@medusajs/framework/types';
import { ownedRecurringOrder } from '../../utils';
import { frequencyLabel, fullName } from '../../../../../modules/recurring-order/lib';
import { syncMercadoPagoSubscriptionStatus } from '../../../../../modules/recurring-order/payment';
import {
  releaseRecurringOrderReservations,
  resetAutomaticCyclesAfterPause,
} from '../../../../../modules/recurring-order/inventory-reservations';
import { withSubscriptionLock } from '../../../../../workflows/run-renewal-cycle';
import { enqueueSubscriptionCommunication } from '../../../../../modules/recurring-order/communications';

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  await withSubscriptionLock(req.scope, `order:${req.params.id as string}`, async () => {
  const { service, recurringOrder } = await ownedRecurringOrder(req, req.params.id as string);
  await syncMercadoPagoSubscriptionStatus(req.scope, recurringOrder, 'paused');
  await releaseRecurringOrderReservations(req.scope, recurringOrder.id);
  if (recurringOrder.payment_mode === 'mercadopago_auto') {
    await resetAutomaticCyclesAfterPause(req.scope, recurringOrder.id);
  }
  const updated = await service.pauseRecurringOrder(recurringOrder.id);
  await enqueueSubscriptionCommunication(
    req.scope, updated, 'recurring-order-paused', {}, `recurring-order-paused:${Date.now()}`,
  );
  await service.log({
    recurring_order_id: recurringOrder.id,
    event: 'paused',
    actor_type: 'customer',
    actor_id: req.auth_context.actor_id,
  });

  // Aviso best-effort: la pausa vale aunque el email falle.
  if (!recurringOrder.plan_id && recurringOrder.email) {
    try {
      const notificationService = req.scope.resolve<INotificationModuleService>(
        Modules.NOTIFICATION,
      );
      await notificationService.createNotifications({
        to: recurringOrder.email,
        channel: 'email',
        template: 'recurring-order-paused',
        data: {
          // La tienda de la suscripción: el aviso de baja tiene que llevar su marca.
          sales_channel_id: recurringOrder.sales_channel_id ?? undefined,
          customer_name:
            fullName(
              recurringOrder.shipping_address?.first_name,
              recurringOrder.shipping_address?.last_name,
            ) || undefined,
          frequency_label: frequencyLabel(
            recurringOrder.frequency_interval,
            recurringOrder.frequency_count,
          ),
        },
      });
    } catch (e) {
      req.scope
        .resolve<Logger>(ContainerRegistrationKeys.LOGGER)
        .warn(`[RecurringOrder] email de pausa falló: ${(e as Error).message}`);
    }
  }

  res.status(200).json({ recurring_order: updated });
  });
}
