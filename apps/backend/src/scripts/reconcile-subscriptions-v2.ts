import type { ExecArgs, Logger } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { RECURRING_ORDER_MODULE } from '../modules/recurring-order';
import type RecurringOrderModuleService from '../modules/recurring-order/service';
import { retrieveMercadoPagoSubscription } from '../modules/recurring-order/payment';

/** Compara contratos automáticos contra MP. Sólo escribe con APPLY=true. */
export default async function reconcileSubscriptionsV2({ container }: ExecArgs): Promise<void> {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const service = container.resolve<RecurringOrderModuleService>(RECURRING_ORDER_MODULE);
  const apply = process.env.APPLY === 'true';
  const subscriptions: any[] = await service.listRecurringOrders(
    { payment_mode: 'mercadopago_auto' },
    { take: 100000, order: { created_at: 'ASC' } },
  );
  let matched = 0;
  let drifted = 0;
  let failed = 0;
  for (const subscription of subscriptions) {
    try {
      const external = await retrieveMercadoPagoSubscription(container, subscription);
      if (!external) {
        failed += 1;
        logger.warn(`[Subscriptions V2 reconcile] ${subscription.id}: falta preapproval externo.`);
        continue;
      }
      const remoteStatus = String(external.status ?? 'pending');
      const localStatus = String(subscription.financial_status ?? 'pending_authorization');
      if (remoteStatus === localStatus) {
        matched += 1;
        continue;
      }
      drifted += 1;
      logger.warn(`[Subscriptions V2 reconcile] ${subscription.id}: local=${localStatus} mp=${remoteStatus}`);
      if (apply) {
        await service.updateRecurringOrders([{
          id: subscription.id,
          financial_status: remoteStatus === 'authorized' ? 'authorized' : remoteStatus,
          provider_state: {
            ...(subscription.provider_state ?? {}),
            status: remoteStatus,
            next_payment_date: external.next_payment_date ?? null,
            reconciled_at: new Date().toISOString(),
          },
        }]);
      }
    } catch (error) {
      failed += 1;
      logger.error(`[Subscriptions V2 reconcile] ${subscription.id}: ${(error as Error).message}`);
    }
  }
  logger.info(`[Subscriptions V2 reconcile] mode=${apply ? 'APPLY' : 'DRY-RUN'} total=${subscriptions.length} matched=${matched} drifted=${drifted} failed=${failed}`);
}
