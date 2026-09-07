/**
 * Métricas de compras recurrentes.
 *
 * `computeMetricsForDate` recomputa el snapshot de UN día desde las tablas
 * fuente (suscripciones + items + ciclos) y lo upsertea por
 * (date, sales_channel_id) — idempotente, sirve para el cron diario y para
 * rebuilds de rangos.
 *
 * Limitación documentada: los eventos del día (altas, bajas, renovaciones) se
 * reconstruyen EXACTO desde timestamps; la foto de estados (active/paused/…)
 * y el MRR usan el estado ACTUAL de las suscripciones, así que un rebuild de
 * fechas viejas aproxima esas columnas al presente. La serie precisa la
 * construye el cron corriendo cada día.
 */

import type { MedusaContainer } from '@medusajs/framework/types';
import { RECURRING_ORDER_MODULE } from './types';
import type { RecurringFrequencyInterval } from './types';

const INTERVAL_DAYS: Record<RecurringFrequencyInterval, number> = {
  day: 1,
  week: 7,
  month: 30,
};

/** Factor para normalizar un total por entrega a mensual (30 días). */
export function monthlyFactor(interval: RecurringFrequencyInterval, count: number): number {
  const days = (INTERVAL_DAYS[interval] ?? 30) * Math.max(1, count || 1);
  return 30 / days;
}

type SubscriptionLike = {
  frequency_interval: RecurringFrequencyInterval;
  frequency_count: number;
  items?: Array<{
    quantity: number;
    pricing_snapshot?: {
      unit_price?: number | null;
      discount_percentage?: number | null;
    } | null;
  }> | null;
};

/**
 * Valor mensual estimado de una suscripción: suma de snapshots de precio
 * (con el descuento de suscripción si lo hay) normalizada a 30 días.
 * Determinístico y barato; el precio vigente real puede diferir.
 */
export function subscriptionMonthlyValue(sub: SubscriptionLike): number {
  const perDelivery = (sub.items ?? []).reduce((sum, item) => {
    const unit = Number(item.pricing_snapshot?.unit_price ?? 0);
    if (!Number.isFinite(unit) || unit <= 0) return sum;
    const pct = Number(item.pricing_snapshot?.discount_percentage ?? 0);
    const discounted = pct > 0 && pct <= 90 ? unit * (1 - pct / 100) : unit;
    return sum + discounted * Math.max(1, item.quantity || 1);
  }, 0);
  return perDelivery * monthlyFactor(sub.frequency_interval, sub.frequency_count);
}

/** Churn del período: bajas / activos al inicio (0 si no había activos). */
export function churnRate(cancelledInPeriod: number, activeAtStart: number): number {
  if (activeAtStart <= 0) return 0;
  return cancelledInPeriod / activeAtStart;
}

export type TopProduct = { product_id: string; title: string | null; subscriptions: number };

/** Top N productos por cantidad de suscripciones activas que los incluyen. */
export function buildTopProducts(
  subscriptions: Array<{
    items?: Array<{
      product_id: string;
      product_snapshot?: { title?: string | null } | null;
    }> | null;
  }>,
  limit = 5,
): TopProduct[] {
  const byProduct = new Map<string, TopProduct>();
  for (const sub of subscriptions) {
    const seen = new Set<string>();
    for (const item of sub.items ?? []) {
      if (!item.product_id || seen.has(item.product_id)) continue;
      seen.add(item.product_id);
      const entry = byProduct.get(item.product_id) ?? {
        product_id: item.product_id,
        title: item.product_snapshot?.title ?? null,
        subscriptions: 0,
      };
      entry.subscriptions += 1;
      byProduct.set(item.product_id, entry);
    }
  }
  return [...byProduct.values()]
    .sort((a, b) => b.subscriptions - a.subscriptions)
    .slice(0, limit);
}

/** Rango UTC [inicio, fin) de un día YYYY-MM-DD. */
export function dayRange(dateStr: string): { start: Date; end: Date } {
  const start = new Date(`${dateStr}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

type MetricsRow = Record<string, unknown> & { date: string; sales_channel_id: string | null };

/**
 * Computa y upsertea los snapshots de un día: una fila por canal con
 * suscripciones + la fila agregada global (sales_channel_id null).
 */
export async function computeMetricsForDate(
  container: MedusaContainer,
  dateStr: string,
): Promise<{ rows: number }> {
  const service: any = container.resolve(RECURRING_ORDER_MODULE);
  const { start, end } = dayRange(dateStr);

  const subscriptions: any[] = await service.listRecurringOrders(
    {},
    { relations: ['items'], take: 10000 },
  );
  // Ciclos con actividad del día (procesados o programados en el rango) +
  // pending_payment vivos para el valor pendiente.
  const cycles: any[] = await service.listRenewalCycles(
    {},
    {
      take: 50000,
      select: ['id', 'recurring_order_id', 'status', 'processed_at', 'scheduled_at', 'metadata'],
    },
  );

  const channels = new Set<string | null>([null]);
  for (const sub of subscriptions) channels.add(sub.sales_channel_id ?? null);

  const inDay = (value: unknown): boolean => {
    if (!value) return false;
    const d = new Date(value as string);
    return d >= start && d < end;
  };

  let rows = 0;
  for (const channel of channels) {
    const subs = subscriptions.filter(
      (s) => channel === null || (s.sales_channel_id ?? null) === channel,
    );
    if (!subs.length && channel !== null) continue;
    const subIds = new Set(subs.map((s) => s.id));
    const channelCycles = cycles.filter((c) => subIds.has(c.recurring_order_id));

    const byStatus = (status: string) => subs.filter((s) => s.status === status).length;
    const activeSubs = subs.filter((s) => s.status === 'active' || s.status === 'pending_payment');
    const mrr = activeSubs.reduce((sum, s) => sum + subscriptionMonthlyValue(s), 0);

    const pendingValue = channelCycles
      .filter((c) => c.status === 'pending_payment')
      .reduce((sum, c) => sum + Number(c.metadata?.totals?.total ?? 0), 0);

    const currency =
      subs.find((s) => s.currency_code)?.currency_code ?? null;

    const row: MetricsRow = {
      date: dateStr,
      sales_channel_id: channel,
      active_count: byStatus('active'),
      paused_count: byStatus('paused'),
      pending_payment_count: byStatus('pending_payment'),
      failed_count: byStatus('failed'),
      cancelled_count: byStatus('cancelled'),
      new_count: subs.filter((s) => inDay(s.created_at)).length,
      cancelled_today: subs.filter((s) => inDay(s.cancelled_at)).length,
      renewals_success: channelCycles.filter(
        (c) => c.status === 'success' && inDay(c.processed_at),
      ).length,
      renewals_failed: channelCycles.filter(
        (c) => c.status === 'failed' && inDay(c.processed_at ?? c.scheduled_at),
      ).length,
      renewals_skipped: channelCycles.filter(
        (c) => c.status === 'skipped' && inDay(c.processed_at ?? c.scheduled_at),
      ).length,
      pending_value: Math.round(pendingValue * 100) / 100,
      mrr_estimate: Math.round(mrr * 100) / 100,
      currency_code: currency,
      top_products: buildTopProducts(activeSubs),
    };

    const [existing] = await service.listRecurringMetricsDailies(
      { date: dateStr, sales_channel_id: channel },
      { take: 1 },
    );
    if (existing) {
      await service.updateRecurringMetricsDailies([{ id: existing.id, ...row }]);
    } else {
      await service.createRecurringMetricsDailies([row]);
    }
    rows += 1;
  }
  return { rows };
}
