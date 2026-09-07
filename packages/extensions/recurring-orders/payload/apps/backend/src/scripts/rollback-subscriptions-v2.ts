import type { ExecArgs, Logger } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { RECURRING_ORDER_MODULE } from '../modules/recurring-order';
import type RecurringOrderModuleService from '../modules/recurring-order/service';
import { syncMercadoPagoSubscriptionStatus } from '../modules/recurring-order/payment';
import { releaseRecurringOrderReservations } from '../modules/recurring-order/inventory-reservations';

/**
 * Rollback no destructivo. Primero apagar SUBSCRIPTIONS_AUTO_PAYMENT_ENABLED;
 * después revisar este dry-run y ejecutar con APPLY=true.
 */
export default async function rollbackSubscriptionsV2({ container }: ExecArgs): Promise<void> {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const service = container.resolve<RecurringOrderModuleService>(RECURRING_ORDER_MODULE);
  const apply = process.env.APPLY === 'true';
  const subscriptions: any[] = await service.listRecurringOrders(
    {
      payment_mode: 'mercadopago_auto',
      status: ['active', 'paused', 'pending_payment', 'failed'],
    },
    { take: 100000 },
  );
  logger.info(`[Subscriptions V2 rollback] ${apply ? 'APPLY' : 'DRY-RUN'}: ${subscriptions.length} contratos pasarían a manual_link.`);
  if (!apply) return;
  for (const subscription of subscriptions) {
    try {
      if (subscription.external_subscription_id && subscription.financial_status !== 'paused') {
        await syncMercadoPagoSubscriptionStatus(container, subscription, 'paused');
      }
      await releaseRecurringOrderReservations(container, subscription.id);
      await service.updateRecurringOrders([{
        id: subscription.id,
        payment_mode: 'manual_link',
        payment_provider: 'manual',
        financial_status: 'manual',
        provider_state: {
          ...(subscription.provider_state ?? {}),
          rollback_preapproval_paused: true,
          rolled_back_at: new Date().toISOString(),
        },
      }]);
      await service.log({
        recurring_order_id: subscription.id,
        event: 'automatic_payment_rolled_back',
        data: { external_subscription_id: subscription.external_subscription_id },
      });
    } catch (error) {
      logger.error(`[Subscriptions V2 rollback] ${subscription.id}: ${(error as Error).message}`);
      await service.upsertAlert({
        dedupe_key: `rollback:${subscription.id}`,
        sales_channel_id: subscription.sales_channel_id,
        recurring_order_id: subscription.id,
        type: 'provider_sync',
        severity: 'critical',
        title: 'Rollback de cobro automático incompleto',
        message: (error as Error).message,
        data: { detected_at: new Date().toISOString() },
      });
    }
  }
}
