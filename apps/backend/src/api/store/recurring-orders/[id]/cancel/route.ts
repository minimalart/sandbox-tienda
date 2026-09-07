import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import type { INotificationModuleService, Logger } from '@medusajs/framework/types';
import { z } from 'zod';
import { ownedRecurringOrder } from '../../utils';
import { frequencyLabel, fullName } from '../../../../../modules/recurring-order/lib';
import { syncMercadoPagoSubscriptionStatus } from '../../../../../modules/recurring-order/payment';
import { releaseRecurringOrderReservations } from '../../../../../modules/recurring-order/inventory-reservations';
import { withSubscriptionLock } from '../../../../../workflows/run-renewal-cycle';
import { enqueueSubscriptionCommunication } from '../../../../../modules/recurring-order/communications';

const Body = z.object({
  // Motivo estructurado del case (+ nota libre). `reason` legacy sigue aceptado.
  reason: z.string().max(60).regex(/^[a-z0-9_]+$/).nullish(),
  reason_note: z.string().max(500).nullish(),
});

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const parsed = Body.safeParse(req.body ?? {});
  if (!parsed.success) {
    res
      .status(400)
      .json({ message: parsed.error.issues[0]?.message ?? 'Datos inválidos' });
    return;
  }
  await withSubscriptionLock(req.scope, `order:${req.params.id as string}`, async () => {
  const { service, recurringOrder } = await ownedRecurringOrder(req, req.params.id as string);
  if (parsed.data.reason) {
    const reasons: any[] = await service.listSubscriptionCancellationReasons({
      code: parsed.data.reason,
      enabled: true,
    });
    const valid = reasons.some((reason) =>
      reason.sales_channel_id == null || reason.sales_channel_id === recurringOrder.sales_channel_id,
    );
    if (!valid) {
      res.status(400).json({ message: 'El motivo de cancelación ya no está disponible.' });
      return;
    }
  }
  await syncMercadoPagoSubscriptionStatus(req.scope, recurringOrder, 'cancelled');
  await releaseRecurringOrderReservations(req.scope, recurringOrder.id);
  const updated = await service.cancelRecurringOrder(
    recurringOrder.id,
    parsed.data.reason ?? null,
  );
  await enqueueSubscriptionCommunication(req.scope, updated, 'recurring-order-cancelled', {
    cancellation_reason: parsed.data.reason ?? undefined,
  });

  // Case de cancelación (motivo + desenlace) + auditoría. Best-effort.
  try {
    await service.createCancellationCases([
      {
        recurring_order_id: recurringOrder.id,
        status: 'cancelled',
        reason: parsed.data.reason ?? null,
        reason_note: parsed.data.reason_note ?? null,
        decided_at: new Date(),
      },
    ]);
  } catch {
    // La cancelación ya ocurrió; el case es registro.
  }
  await service.log({
    recurring_order_id: recurringOrder.id,
    event: 'cancelled',
    actor_type: 'customer',
    actor_id: req.auth_context.actor_id,
    data: {
      reason: parsed.data.reason ?? null,
      reason_note: parsed.data.reason_note ?? null,
    },
  });

  if (!recurringOrder.plan_id && recurringOrder.email) {
    try {
      const notificationService = req.scope.resolve<INotificationModuleService>(
        Modules.NOTIFICATION,
      );
      await notificationService.createNotifications({
        to: recurringOrder.email,
        channel: 'email',
        template: 'recurring-order-cancelled',
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
        .warn(`[RecurringOrder] email de cancelación falló: ${(e as Error).message}`);
    }
  }

  res.status(200).json({ recurring_order: updated });
  });
}
