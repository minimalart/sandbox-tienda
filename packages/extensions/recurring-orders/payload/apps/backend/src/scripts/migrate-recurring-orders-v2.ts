import type { ExecArgs, Logger } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { RECURRING_ORDER_MODULE } from '../modules/recurring-order';
import type RecurringOrderModuleService from '../modules/recurring-order/service';
import { createPlanVersion, snapshotPlan } from '../modules/recurring-order/plans';

/**
 * Migra contratos manuales sin tocar IDs, historial ni próximas fechas.
 * Dry-run por defecto; usar APPLY=true sólo después de revisar los conteos.
 */
export default async function migrateRecurringOrdersV2({ container }: ExecArgs): Promise<void> {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const service = container.resolve<RecurringOrderModuleService>(RECURRING_ORDER_MODULE);
  const apply = process.env.APPLY === 'true';
  const legacy = await service.listRecurringOrders(
    { plan_id: null },
    { take: 100_000, order: { created_at: 'ASC' } },
  );
  const byChannel = new Map<string, any[]>();
  for (const row of legacy) {
    const channel = String(row.sales_channel_id);
    byChannel.set(channel, [...(byChannel.get(channel) ?? []), row]);
  }
  logger.info(
    `[Subscriptions V2] ${apply ? 'APPLY' : 'DRY-RUN'}: ${legacy.length} suscripciones heredadas en ${byChannel.size} canales.`,
  );
  if (!apply) {
    for (const [channel, rows] of byChannel) {
      logger.info(`[Subscriptions V2] canal=${channel}: ${rows.length} contratos, próximas fechas intactas.`);
    }
    return;
  }

  for (const [salesChannelId, rows] of byChannel) {
    let [plan]: any[] = await service.listSubscriptionPlans({
      sales_channel_id: salesChannelId,
      handle: 'reposicion-programada-heredada',
      legacy: true,
    }, { take: 1 });
    if (!plan) {
      const frequencies = new Map<string, { interval: 'day' | 'week' | 'month'; count: number }>();
      for (const row of rows) {
        const interval = ['day', 'week', 'month'].includes(row.frequency_interval)
          ? row.frequency_interval as 'day' | 'week' | 'month'
          : 'month';
        const count = Math.max(1, Number(row.frequency_count) || 1);
        frequencies.set(`${interval}:${count}`, { interval, count });
      }
      plan = await createPlanVersion(service, {
        sales_channel_id: salesChannelId,
        name: 'Reposición programada heredada',
        handle: 'reposicion-programada-heredada',
        purchase_mode: 'one_time_and_subscription',
        price_policy: 'dynamic',
        promotion_policy: 'best_benefit',
        allow_stacking: false,
        offers: [...frequencies.values()].map((frequency, index) => ({
          label: null,
          frequency_interval: frequency.interval,
          frequency_count: frequency.count,
          discount_type: 'none',
          discount_value: 0,
          sort_order: index,
        })),
        // Target imposible: conserva el plan operativo sin publicarlo a altas nuevas.
        targets: [{ target_type: 'tag', target_id: '__mercatto_legacy_manual__' }],
        metadata: { hidden: true, migrated_from: 'recurring-order-v1' },
      }, { status: 'active', legacy: true });
    }
    const offers = await service.listSubscriptionPlanOffers({ plan_id: plan.id });
    for (const row of rows) {
      const offer: any = offers.find(
        (candidate: any) =>
          candidate.frequency_interval === row.frequency_interval &&
          Number(candidate.frequency_count) === Number(row.frequency_count),
      ) ?? offers[0];
      const planSnapshot = await snapshotPlan(service, plan.id, offer.id);
      await service.updateRecurringOrders([{
        id: row.id,
        plan_id: plan.id,
        plan_version: plan.version,
        offer_id: offer.id,
        plan_snapshot: planSnapshot,
        payment_mode: 'manual_link',
        payment_provider: 'manual',
        financial_status: 'manual',
        next_billing_at: row.next_execution_at,
      }]);
    }
    logger.info(`[Subscriptions V2] canal=${salesChannelId}: migradas ${rows.length}.`);
  }
}
