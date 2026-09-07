import type { ExecArgs, Logger } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { RECURRING_ORDER_MODULE } from '../modules/recurring-order';
import type RecurringOrderModuleService from '../modules/recurring-order/service';

const validReservation = (value: unknown): boolean =>
  (Array.isArray((value as { ids?: unknown[] } | null)?.ids) &&
    (value as { ids: unknown[] }).ids.length > 0) ||
  (value as { not_required?: unknown } | null)?.not_required === true;

/** Auditoría read-only de invariantes comerciales y financieras de V2. */
export default async function auditSubscriptionsV2({ container }: ExecArgs): Promise<void> {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const service = container.resolve<RecurringOrderModuleService>(RECURRING_ORDER_MODULE);
  const pg = container.resolve<any>(ContainerRegistrationKeys.PG_CONNECTION);
  const subscriptions: any[] = await service.listRecurringOrders({}, { take: 100000 });
  const cycles: any[] = await service.listRenewalCycles({}, { take: 200000 });
  const v2 = subscriptions.filter((subscription) => subscription.plan_id);
  const auto = v2.filter((subscription) => subscription.payment_mode === 'mercadopago_auto');
  const findings = {
    v2_missing_snapshot: v2.filter((subscription) => !subscription.plan_snapshot).length,
    auto_missing_external_id: auto.filter((subscription) => !subscription.external_subscription_id).length,
    charged_without_order: cycles.filter((cycle) =>
      cycle.payment_status === 'paid' && !cycle.generated_order_id && cycle.status !== 'refunded',
    ).length,
    chargeable_without_reservation: cycles.filter((cycle) =>
      ['awaiting_charge', 'past_due'].includes(cycle.status) &&
      !validReservation(cycle.inventory_reservation_ids),
    ).length,
    open_critical_alerts: (await service.listSubscriptionAlerts({
      status: 'open', severity: 'critical',
    }, { take: 10000 })).length,
  };
  const duplicateResult = await pg.raw(`
    SELECT COUNT(*)::int AS count FROM (
      SELECT idempotency_key FROM renewal_cycle
      WHERE deleted_at IS NULL AND idempotency_key IS NOT NULL
      GROUP BY idempotency_key HAVING COUNT(*) > 1
    ) duplicates
  `);
  const duplicateIdempotencyKeys = Number(duplicateResult?.rows?.[0]?.count ?? 0);
  const critical = Object.values(findings).reduce((sum, count) => sum + count, 0) + duplicateIdempotencyKeys;
  logger.info(`[Subscriptions V2 audit] subscriptions=${subscriptions.length} v2=${v2.length} auto=${auto.length} cycles=${cycles.length}`);
  logger.info(`[Subscriptions V2 audit] ${JSON.stringify({ ...findings, duplicate_idempotency_keys: duplicateIdempotencyKeys })}`);
  if (critical > 0 && process.env.AUDIT_STRICT === 'true') {
    throw new Error(`[Subscriptions V2 audit] ${critical} invariantes requieren revisión.`);
  }
}
