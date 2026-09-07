import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { RECURRING_ORDER_MODULE } from '../../../modules/recurring-order';
import type RecurringOrderModuleService from '../../../modules/recurring-order/service';
import { siteFromRequest, siteChannelFilter } from '../../../lib/multistore';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Listado del backoffice + métricas livianas para los KPIs de la sección.
 * `pending_payment_value` sale del snapshot de totales que el motor guarda en
 * `renewal_cycle.metadata.totals` al generar el carrito.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<RecurringOrderModuleService>(RECURRING_ORDER_MODULE);

  const limit = req.query.limit ? Math.min(Number(req.query.limit) || 20, 100) : 20;
  const offset = req.query.offset ? Number(req.query.offset) || 0 : 0;
  const status = req.query.status as string | undefined;
  const salesChannelId = req.query.sales_channel_id as string | undefined;
  const q = (req.query.q as string | undefined)?.trim();

  const filters: Record<string, unknown> = {};
  if (status) filters.status = status.includes(',') ? status.split(',') : status;
  // Param explícito > tienda activa. Con la tienda, filtra por sus DOS canales.
  const scopedFilter = siteChannelFilter(await siteFromRequest(req), salesChannelId);
  Object.assign(filters, scopedFilter);

  let recurring_orders: any[];
  let count: number;
  if (q) {
    const candidates: any[] = await service.listRecurringOrders(filters, {
      take: 10000,
      order: { created_at: 'DESC' },
      relations: ['items'],
    });
    const candidateIds = candidates.map((subscription) => subscription.id);
    const cycles: any[] = candidateIds.length
      ? await service.listRenewalCycles(
          { recurring_order_id: candidateIds },
          { take: 50000 },
        )
      : [];
    const ordersBySubscription = new Map<string, string[]>();
    for (const cycle of cycles) {
      if (!cycle.generated_order_id) continue;
      const values = ordersBySubscription.get(cycle.recurring_order_id) ?? [];
      values.push(cycle.generated_order_id);
      ordersBySubscription.set(cycle.recurring_order_id, values);
    }
    const planIds = [...new Set(candidates.map((subscription) => subscription.plan_id).filter(Boolean))];
    const plans: any[] = planIds.length
      ? await service.listSubscriptionPlans({ id: planIds }, { take: planIds.length })
      : [];
    const planName = new Map(plans.map((plan) => [plan.id, plan.name]));
    const needle = q.toLowerCase();
    const matches = candidates.filter((subscription) =>
      [
        subscription.id,
        subscription.email,
        subscription.customer_id,
        subscription.external_subscription_id,
        subscription.plan_id,
        planName.get(subscription.plan_id),
        ...(ordersBySubscription.get(subscription.id) ?? []),
        ...(subscription.items ?? []).flatMap((item: any) => [
          item.product_id,
          item.variant_id,
          item.product_snapshot?.title,
          item.product_snapshot?.sku,
        ]),
      ].some((value) => String(value ?? '').toLowerCase().includes(needle)),
    );
    count = matches.length;
    recurring_orders = matches.slice(offset, offset + limit).map((subscription) => ({
      ...subscription,
      plan_name: planName.get(subscription.plan_id) ?? null,
    }));
  } else {
    [recurring_orders, count] = await service.listAndCountRecurringOrders(filters, {
      take: limit,
      skip: offset,
      order: { created_at: 'DESC' },
      relations: ['items'],
    });
  }

  // Métricas globales (independientes de los filtros del listado).
  const now = new Date();
  const [, total] = await service.listAndCountRecurringOrders(scopedFilter, { take: 1 });
  const byStatus: Record<string, number> = {};
  for (const s of ['active', 'paused', 'pending_payment', 'failed', 'cancelled']) {
    const [, c] = await service.listAndCountRecurringOrders(
      { ...scopedFilter, status: s },
      { take: 1 },
    );
    byStatus[s] = c;
  }
  const scopedSubscriptions: any[] = await service.listRecurringOrders(scopedFilter, { take: 10000 });
  const scopedIds = scopedSubscriptions.map((subscription) => subscription.id);
  const cycleScope = scopedIds.length ? { recurring_order_id: scopedIds } : { recurring_order_id: [] };
  const [, dueNext7d] = await service.listAndCountRenewalCycles(
    {
      ...cycleScope,
      status: 'scheduled',
      scheduled_at: { $lte: new Date(now.getTime() + 7 * DAY_MS) },
    },
    { take: 1 },
  );
  const pendingCycles = await service.listRenewalCycles(
    { ...cycleScope, status: 'pending_payment' },
    { take: 200 },
  );
  const pendingPaymentValue = pendingCycles.reduce((sum: number, c: any) => {
    const total = Number(c.metadata?.totals?.total);
    return Number.isFinite(total) ? sum + total : sum;
  }, 0);
  const [, failed30d] = await service.listAndCountRenewalCycles(
    {
      ...cycleScope,
      status: 'failed',
      processed_at: { $gte: new Date(now.getTime() - 30 * DAY_MS), $ne: null },
    },
    { take: 1 },
  );

  res.status(200).json({
    recurring_orders,
    count,
    limit,
    offset,
    metrics: {
      total,
      by_status: byStatus,
      due_next_7d: dueNext7d,
      pending_payment_count: pendingCycles.length,
      pending_payment_value: pendingPaymentValue,
      failed_cycles_30d: failed30d,
    },
  });
}
