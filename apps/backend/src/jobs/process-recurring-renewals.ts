import type { Logger, MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import type { INotificationModuleService } from '@medusajs/framework/types';
import { getKapsoSettings } from '../modules/kapso-whatsapp/settings';
import { RECURRING_ORDER_MODULE } from '../modules/recurring-order';
import type RecurringOrderModuleService from '../modules/recurring-order/service';
import {
  asAddress,
  asFrequency,
  frequencyLabel,
  fullName,
} from '../modules/recurring-order/lib';
import { resolveRuntimeConfig } from '../modules/recurring-order/runtime-config';
import { runRenewalCycleLocked } from '../workflows/run-renewal-cycle';

/**
 * Motor de compras recurrentes. Tres fases por corrida:
 *  1) EJECUTAR: ciclos vencidos (`scheduled`/`failed` reintentable) → workflow.
 *  2) RECORDAR: `pending_payment` sin recordatorio con más de `reminderHours`.
 *  3) EXPIRAR: `pending_payment` con el link vencido → fallo terminal del ciclo
 *     (la suscripción sigue o cae según la racha de fallos).
 * Fire-and-forget: nunca propaga; cada error se loguea y sigue.
 */
export default async function processRecurringRenewalsJob(
  container: MedusaContainer,
): Promise<void> {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const service = container.resolve<RecurringOrderModuleService>(RECURRING_ORDER_MODULE);
  const config = service.getConfig();
  if (!config.enabled) return;

  const now = new Date();

  // ── Fase 1: ciclos vencidos ─────────────────────────────────────────────────
  let executed = 0;
  let pending = 0;
  let failed = 0;
  try {
    const due = await service.listDueCycles(now, config.batchSize);
    for (const cycle of due) {
      try {
        const result = await runRenewalCycleLocked(container, {
          cycleId: cycle.id as string,
        });
        executed++;
        const outcome = (result as { outcome?: string }).outcome;
        if (outcome === 'pending_payment') pending++;
        if (outcome === 'failed_retry' || outcome === 'failed_terminal') failed++;
      } catch (e) {
        failed++;
        logger.warn(
          `[RecurringOrder] ejecución del ciclo ${cycle.id} falló: ${(e as Error).message}`,
        );
      }
    }
  } catch (e) {
    logger.warn(`[RecurringOrder] barrido de vencidos falló: ${(e as Error).message}`);
  }

  // ── Fase 2: recordatorios de pago pendiente ─────────────────────────────────
  let reminded = 0;
  try {
    // Filtro grueso con piso de 1 h; el umbral REAL es por canal (settings
    // runtime del admin, fallback global → env) y se chequea por ciclo.
    const dueReminders = await service.listReminderDue(
      now,
      { ...config, reminderHours: 1 },
      config.batchSize,
    );
    if (dueReminders.length) {
      const notificationService = container.resolve<INotificationModuleService>(
        Modules.NOTIFICATION,
      );
      const whatsappEnabled = Boolean(
        getKapsoSettings().templates.recurringRenewalReminder,
      );
      for (const cycle of dueReminders) {
        try {
          const ro = await service.retrieveRecurringOrder(cycle.recurring_order_id);
          const channelConfig = await resolveRuntimeConfig(container, ro.sales_channel_id);
          const dueAt = new Date(
            new Date(cycle.processed_at).getTime() +
              channelConfig.reminderHours * 60 * 60 * 1000,
          );
          if (dueAt > now) continue; // Todavía no toca para este canal.
          const address = asAddress(ro.shipping_address);
          const data = {
            // La tienda de la suscripción: el provider de email resuelve con esto la
            // marca del mail y el de Kapso el número desde el que sale. Sin él, los dos
            // caen al global y el cliente recibe una marca que no reconoce.
            sales_channel_id: ro.sales_channel_id ?? undefined,
            customer_name:
              fullName(address.first_name, address.last_name) || undefined,
            frequency_label: frequencyLabel(
              asFrequency(ro.frequency_interval),
              ro.frequency_count,
            ),
            confirmation_url: cycle.confirmation_url ?? undefined,
            expires_at: cycle.expires_at
              ? new Date(cycle.expires_at).toISOString()
              : undefined,
          };
          if (ro.email) {
            await notificationService.createNotifications({
              to: ro.email,
              channel: 'email',
              template: 'recurring-renewal-reminder',
              data,
            });
          }
          const whatsappConsent = Boolean(
            (ro.metadata as { whatsapp_consent?: boolean } | null)?.whatsapp_consent,
          );
          if (whatsappEnabled && whatsappConsent && ro.phone) {
            try {
              await notificationService.createNotifications({
                to: ro.phone,
                channel: 'whatsapp',
                template: 'recurring-renewal-reminder',
                data,
              });
            } catch (e) {
              logger.warn(
                `[RecurringOrder] whatsapp recordatorio falló: ${(e as Error).message}`,
              );
            }
          }
          await service.updateRenewalCycles([{ id: cycle.id, reminder_sent_at: now }]);
          reminded++;
        } catch (e) {
          logger.warn(
            `[RecurringOrder] recordatorio del ciclo ${cycle.id} falló: ${(e as Error).message}`,
          );
        }
      }
    }
  } catch (e) {
    logger.warn(`[RecurringOrder] barrido de recordatorios falló: ${(e as Error).message}`);
  }

  // ── Fase 3: links vencidos ──────────────────────────────────────────────────
  let expired = 0;
  try {
    const dueExpired = await service.listExpired(now, config.batchSize);
    for (const cycle of dueExpired) {
      try {
        // La racha de fallos tolerada también es por canal.
        const roChannel = await service.retrieveRecurringOrder(cycle.recurring_order_id);
        const channelConfig = await resolveRuntimeConfig(container, roChannel.sales_channel_id);
        const { subscriptionFailed, recurringOrder } = await service.failCycleTerminal({
          cycleId: cycle.id,
          error: 'payment_link_expired',
          paymentStatus: 'expired',
          config: channelConfig,
          now,
        });
        // La suscripción sale de pending_payment: failCycleTerminal la deja
        // `active` (con próximo ciclo) o `failed` según la racha.
        expired++;
        if (subscriptionFailed && recurringOrder?.email) {
          const notificationService = container.resolve<INotificationModuleService>(
            Modules.NOTIFICATION,
          );
          await notificationService.createNotifications({
            to: recurringOrder.email,
            channel: 'email',
            template: 'recurring-order-failed',
            data: {
              // La tienda de la suscripción, igual que en las fases 1 y 2. Faltaba
              // sólo acá, y era la peor de las tres para que faltara: el cliente ve
              // salir el recordatorio con la marca de su tienda y después el aviso
              // de "se cayó tu suscripción" con la de otra.
              //
              // Sale de `roChannel` y no de `recurringOrder` porque es el objeto que
              // la línea de arriba ya leyó para `resolveRuntimeConfig`: el canal no
              // lo toca `failCycleTerminal`, así que los dos valen y este no agrega
              // una lectura ni depende del tipo de retorno del método.
              sales_channel_id: roChannel.sales_channel_id ?? undefined,
              customer_name:
                fullName(
                  asAddress(recurringOrder.shipping_address).first_name,
                  asAddress(recurringOrder.shipping_address).last_name,
                ) || undefined,
              frequency_label: frequencyLabel(
                asFrequency(recurringOrder.frequency_interval),
                recurringOrder.frequency_count,
              ),
            },
          });
        }
      } catch (e) {
        logger.warn(
          `[RecurringOrder] expiración del ciclo ${cycle.id} falló: ${(e as Error).message}`,
        );
      }
    }
  } catch (e) {
    logger.warn(`[RecurringOrder] barrido de expiraciones falló: ${(e as Error).message}`);
  }

  if (executed || reminded || expired) {
    logger.info(
      `[RecurringOrder] cron: ${executed} ejecutados (${pending} a pago, ${failed} con error), ${reminded} recordatorios, ${expired} expirados.`,
    );
  }
}

export const config = {
  name: 'process-recurring-renewals',
  schedule: process.env.RECURRING_RENEWAL_CRON || '*/5 * * * *',
};
