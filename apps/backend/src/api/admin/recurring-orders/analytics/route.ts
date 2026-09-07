import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { siteFromRequest } from '../../../../lib/multistore/request';
import { siteChannelFilter } from '../../../../lib/multistore/scope';
import { RECURRING_ORDER_MODULE } from '../../../../modules/recurring-order';
import type RecurringOrderModuleService from '../../../../modules/recurring-order/service';
import { churnRate } from '../../../../modules/recurring-order/analytics';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * GET /admin/recurring-orders/analytics?from=YYYY-MM-DD&to=YYYY-MM-DD&sales_channel_id=
 *
 * Serie diaria del rango (default: últimos 30 días) + agregados: KPIs de la
 * última foto (activas, MRR, valor pendiente), sumas de eventos del rango y
 * churn (bajas del rango / activos al inicio). `sales_channel_id` ausente =
 * fila global.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<RecurringOrderModuleService>(RECURRING_ORDER_MODULE);
  const salesChannelId = (req.query.sales_channel_id as string | undefined) || null;
  const siteResolution = await siteFromRequest(req);
  const subscriptionScope = siteChannelFilter(siteResolution, salesChannelId ?? undefined);

  const toStr = (d: Date) => d.toISOString().slice(0, 10);
  const now = new Date();
  const to = (req.query.to as string | undefined) || toStr(now);
  const from =
    (req.query.from as string | undefined) || toStr(new Date(now.getTime() - 29 * DAY_MS));

  /**
   * Acá `NULL` NO es fallback global: una métrica diaria pertenece al canal que la
   * generó, y la fila sin canal es de antes de que hubiera tiendas. Por eso va con
   * `siteChannelFilter` —data— y no con precedencia —config—, a diferencia de
   * `settings` y `offers` en este mismo módulo.
   *
   * Filtra por LOS DOS canales de una tienda B2B: sumar sólo el retail daba números
   * bajos que parecían un problema de negocio.
   */
  const rows: any[] = await service.listRecurringMetricsDailies(
    subscriptionScope,
    { take: 400, order: { date: 'ASC' } },
  );
  const series = rows
    .filter((r) => r.date >= from && r.date <= to)
    .map((r) => ({
      date: r.date,
      active_count: r.active_count,
      paused_count: r.paused_count,
      pending_payment_count: r.pending_payment_count,
      failed_count: r.failed_count,
      cancelled_count: r.cancelled_count,
      new_count: r.new_count,
      cancelled_today: r.cancelled_today,
      renewals_success: r.renewals_success,
      renewals_failed: r.renewals_failed,
      renewals_skipped: r.renewals_skipped,
      pending_value: Number(r.pending_value ?? 0),
      mrr_estimate: Number(r.mrr_estimate ?? 0),
      currency_code: r.currency_code ?? null,
      top_products: r.top_products ?? [],
    }));

  const latest = series[series.length - 1] ?? null;
  const first = series[0] ?? null;
  const sum = (key: string) =>
    series.reduce((acc, r) => acc + Number((r as Record<string, unknown>)[key] ?? 0), 0);
  const renewalsSuccess = sum('renewals_success');
  const renewalsFailed = sum('renewals_failed');

  // Los importes financieros salen de ciclos reales, no de snapshots. Así el
  // dashboard y su CSV se pueden conciliar contra cobros/pedidos aun si el cron
  // diario se atrasó.
  const subscriptions: any[] = await service.listRecurringOrders(
    subscriptionScope,
    { take: 10000 },
  );
  const subscriptionIds = new Set(subscriptions.map((subscription) => subscription.id));
  const cycles: any[] = subscriptionIds.size
    ? await service.listRenewalCycles(
        { recurring_order_id: [...subscriptionIds] },
        { take: 50000, order: { scheduled_at: 'DESC' } },
      )
    : [];
  const fromDate = new Date(`${from}T00:00:00.000Z`);
  const toDate = new Date(new Date(`${to}T00:00:00.000Z`).getTime() + DAY_MS);
  const occurredInRange = (cycle: any): boolean => {
    const raw = cycle.paid_at ?? cycle.processed_at ?? cycle.scheduled_at;
    if (!raw) return false;
    const date = new Date(raw);
    return date >= fromDate && date < toDate;
  };
  const amountOf = (cycle: any): number => {
    const candidates = [
      cycle.charged_amount,
      cycle.expected_amount,
      cycle.metadata?.totals?.total,
    ];
    for (const candidate of candidates) {
      const amount = Number(candidate);
      if (Number.isFinite(amount) && amount > 0) return amount;
    }
    return 0;
  };
  const paidStatuses = new Set(['paid', 'order_created', 'success']);
  const paidInRange = cycles.filter(
    (cycle) =>
      occurredInRange(cycle) &&
      (paidStatuses.has(cycle.status) || cycle.payment_status === 'paid'),
  );
  const paidLifetime = cycles.filter(
    (cycle) => paidStatuses.has(cycle.status) || cycle.payment_status === 'paid',
  );
  const gmvRecurring = paidInRange.reduce((total, cycle) => total + amountOf(cycle), 0);
  const recoveredCycles = paidInRange.filter((cycle) => Number(cycle.attempt_count ?? 0) > 1);
  const recoveredRevenue = recoveredCycles.reduce(
    (total, cycle) => total + amountOf(cycle),
    0,
  );
  const failedPayments = cycles.filter(
    (cycle) =>
      occurredInRange(cycle) &&
      (cycle.status === 'past_due' || cycle.payment_status === 'failed'),
  ).length;
  const customers = new Set(
    subscriptions.map((subscription) =>
      subscription.customer_id || subscription.email || subscription.id,
    ),
  );
  const lifetimeRevenue = paidLifetime.reduce((total, cycle) => total + amountOf(cycle), 0);

  res.status(200).json({
    from,
    to,
    series,
    summary: latest
      ? {
          active_count: latest.active_count,
          mrr_estimate: latest.mrr_estimate,
          pending_value: latest.pending_value,
          currency_code: latest.currency_code,
          new_in_range: sum('new_count'),
          cancelled_in_range: sum('cancelled_today'),
          renewals_success: renewalsSuccess,
          renewals_failed: renewalsFailed,
          renewals_skipped: sum('renewals_skipped'),
          gmv_recurring: Math.round(gmvRecurring * 100) / 100,
          failed_payments: failedPayments,
          recovered_payments: recoveredCycles.length,
          recovered_revenue: Math.round(recoveredRevenue * 100) / 100,
          ltv_average:
            customers.size > 0
              ? Math.round((lifetimeRevenue / customers.size) * 100) / 100
              : 0,
          renewal_success_rate:
            renewalsSuccess + renewalsFailed > 0
              ? renewalsSuccess / (renewalsSuccess + renewalsFailed)
              : null,
          churn_rate: first ? churnRate(sum('cancelled_today'), first.active_count) : null,
          top_products: latest.top_products,
        }
      : null,
  });
}
