import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { MedusaContainer } from '@medusajs/framework/types';
import type { NativeToolContext, NativeToolDef } from './index';
import { NATIVE_TOOL } from './names';

/**
 * Tools nativas de ANALYTICS del Asistente IA: lecturas agregadas de alto valor
 * (ventas, productos, clientes) para que el analista de propuestas obtenga el
 * panorama del negocio en 1-3 llamadas en vez de quemar su presupuesto de pasos
 * listando órdenes crudas del MCP. Fuente primaria: las métricas precomputadas
 * de `commerce-dashboard`; si el módulo no está o el rango no tiene filas, cae a
 * un escaneo vivo de órdenes vía query.graph (la salida marca `data_source`).
 *
 * Los colectores (`collect*`) se exportan aparte de las tools: el motor de
 * propuestas los llama directo (sin LLM) para armar el digest de señales.
 */

type Num = number;
const num = (v: unknown): Num => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};
const r2 = (n: number): number => Math.round(n * 100) / 100;

const dayStr = (d: Date): string => d.toISOString().slice(0, 10);

export type DateRange = { from: string; to: string; days: number };

/** Rango [hoy - (days-1), hoy] en fechas YYYY-MM-DD (el dashboard incluye el día `to` completo). */
export function computeRange(days: unknown, now: Date = new Date()): DateRange {
  const d = Math.min(Math.max(Math.trunc(num(days)) || 30, 1), 365);
  const from = new Date(now.getTime() - (d - 1) * 24 * 3600 * 1000);
  return { from: dayStr(from), to: dayStr(now), days: d };
}

/** Rango inmediatamente anterior, del mismo largo (para el fallback vivo). */
export function previousRange(range: DateRange): DateRange {
  const from = new Date(new Date(`${range.from}T00:00:00Z`).getTime() - range.days * 24 * 3600 * 1000);
  const to = new Date(new Date(`${range.from}T00:00:00Z`).getTime() - 24 * 3600 * 1000);
  return { from: dayStr(from), to: dayStr(to), days: range.days };
}

// ---------------------------------------------------------------------------
// Fuente primaria: commerce-dashboard (métricas precomputadas)
// ---------------------------------------------------------------------------

type DashboardService = {
  getDashboard: (filters: Record<string, unknown>) => Promise<any>;
  getLastAggregatedAt: (filters: Record<string, unknown>) => Promise<string | null>;
  listProductMetricsDailies?: (filters: any, config?: any) => Promise<any[]>;
  listCustomerMetricsDailies?: (filters: any, config?: any) => Promise<any[]>;
};

function resolveDashboard(container: MedusaContainer): DashboardService | null {
  try {
    const svc = container.resolve('commerce_dashboard') as unknown as DashboardService;
    return typeof svc?.getDashboard === 'function' ? svc : null;
  } catch {
    return null;
  }
}

const STALE_MS = 12 * 3600 * 1000;

/**
 * Garantiza que las métricas del rango (y su período previo, para los deltas)
 * estén agregadas y frescas (<12 h). Best-effort: si la agregación falla se
 * sigue con lo que haya (o con el fallback vivo).
 */
async function ensureFreshMetrics(
  container: MedusaContainer,
  svc: DashboardService,
  range: DateRange,
): Promise<void> {
  try {
    const last = await svc.getLastAggregatedAt({ from: range.from, to: range.to });
    if (last && Date.now() - new Date(last).getTime() < STALE_MS) return;
    const prev = previousRange(range);
    // Import dinámico + string dinámico para no acoplar el módulo ai-assistant al build del
    // workflow. El workflow vive en @minimalart/mercatto-plugin-commerce-dashboard; el
    // catch de abajo hace no-op si el plugin no está instalado.
    const workflowSpecifier =
      '@minimalart/mercatto-plugin-commerce-dashboard/.medusa/server/src/workflows/aggregate-commerce-metrics.js';
    const mod = (await import(/* @vite-ignore */ workflowSpecifier)) as {
      aggregateCommerceMetricsWorkflow: (c: unknown) => {
        run: (arg: { input: { from: string; to: string } }) => Promise<unknown>;
      };
    };
    await mod.aggregateCommerceMetricsWorkflow(container as any).run({
      input: { from: prev.from, to: range.to },
    });
  } catch {
    // best-effort
  }
}

/** Achica la serie diaria del dashboard a ≤ maxPoints puntos (sumando por tramo). */
export function groupTrend(
  points: Array<{ period: unknown; value: unknown }>,
  maxPoints = 8,
): Array<{ from: string; revenue: number }> {
  const list = (points ?? []).map((p) => ({
    period: p.period instanceof Date ? dayStr(p.period) : String(p.period ?? '').slice(0, 10),
    value: num(p.value),
  }));
  if (!list.length) return [];
  const size = Math.max(1, Math.ceil(list.length / maxPoints));
  const out: Array<{ from: string; revenue: number }> = [];
  for (let i = 0; i < list.length; i += size) {
    const chunk = list.slice(i, i + size);
    const first = chunk[0];
    if (!first) continue;
    out.push({ from: first.period, revenue: r2(chunk.reduce((a, c) => a + c.value, 0)) });
  }
  return out;
}

/** Recorta y redondea el JSON gigante de getDashboard a un resumen apto para el modelo. */
export function summarizeDashboard(
  d: any,
  opts?: { maxTrendPoints?: number; topProducts?: number; topGroups?: number },
): Record<string, unknown> {
  const kpi = (k: any) =>
    k ? { value: r2(num(k.value)), previous: r2(num(k.previous)), delta_pct: r2(num(k.delta)) } : null;
  const share = (row: any) => ({
    id: row?.id,
    title: row?.title,
    ...(row?.handle ? { handle: row.handle } : {}),
    revenue: r2(num(row?.revenue)),
    units: num(row?.units_sold),
    revenue_share_pct: r2(num(row?.revenue_share) * 100),
  });
  const breakdown = (rows: any[]) =>
    (rows ?? []).slice(0, 5).map((row) => ({
      key: row?.key,
      revenue: r2(num(row?.revenue)),
      orders: num(row?.orders),
      revenue_share_pct: r2(num(row?.revenue_share) * 100),
    }));
  return {
    kpis: {
      revenue: kpi(d?.kpis?.revenue),
      orders: kpi(d?.kpis?.orders),
      aov: kpi(d?.kpis?.aov),
      units_sold: kpi(d?.kpis?.units_sold),
      new_customers: kpi(d?.kpis?.new_customers),
      returning_customers: kpi(d?.kpis?.returning_customers),
      refunds: kpi(d?.kpis?.refunds),
    },
    weekly_trend: groupTrend(d?.charts?.revenue_over_time ?? [], opts?.maxTrendPoints ?? 8),
    top_products: (d?.tables?.top_products ?? []).slice(0, opts?.topProducts ?? 10).map(share),
    top_categories: (d?.tables?.top_categories ?? []).slice(0, opts?.topGroups ?? 5).map(share),
    top_collections: (d?.tables?.top_collections ?? []).slice(0, opts?.topGroups ?? 5).map(share),
    breakdowns: {
      sales_channels: breakdown(d?.breakdowns?.sales_channels),
      currencies: breakdown(d?.breakdowns?.currencies),
    },
    customers: {
      repeat_purchase_rate: kpi(d?.customers?.repeat_purchase_rate),
      customers_with_orders: kpi(d?.customers?.customers_with_orders),
    },
  };
}

// ---------------------------------------------------------------------------
// Fallback vivo: escaneo de órdenes por query.graph
// ---------------------------------------------------------------------------

export type OrderRow = {
  id: string;
  total?: unknown;
  currency_code?: string | null;
  created_at?: string | Date | null;
  customer_id?: string | null;
  email?: string | null;
  items?: Array<{
    product_id?: string | null;
    title?: string | null;
    quantity?: unknown;
    total?: unknown;
  }> | null;
};

/** Agrega en JS un lote de órdenes: revenue/AOV/top productos/monedas. */
export function aggregateOrders(rows: OrderRow[]): {
  orders: number;
  revenue: number;
  aov: number;
  top_products: Array<{ id: string; title: string; revenue: number; units: number }>;
  currencies: Array<{ key: string; revenue: number; orders: number }>;
} {
  let revenue = 0;
  const products = new Map<string, { id: string; title: string; revenue: number; units: number }>();
  const currencies = new Map<string, { key: string; revenue: number; orders: number }>();
  for (const o of rows ?? []) {
    const total = num(o.total);
    revenue += total;
    const cur = (o.currency_code ?? 'sin dato').toLowerCase();
    const c = currencies.get(cur) ?? { key: cur, revenue: 0, orders: 0 };
    c.revenue += total;
    c.orders += 1;
    currencies.set(cur, c);
    for (const it of o.items ?? []) {
      const pid = it?.product_id ?? null;
      if (!pid) continue;
      const p = products.get(pid) ?? { id: pid, title: it?.title ?? pid, revenue: 0, units: 0 };
      p.revenue += num(it?.total);
      p.units += num(it?.quantity);
      products.set(pid, p);
    }
  }
  const orders = (rows ?? []).length;
  return {
    orders,
    revenue: r2(revenue),
    aov: orders > 0 ? r2(revenue / orders) : 0,
    top_products: [...products.values()]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)
      .map((p) => ({ ...p, revenue: r2(p.revenue) })),
    currencies: [...currencies.values()]
      .sort((a, b) => b.revenue - a.revenue)
      .map((c) => ({ ...c, revenue: r2(c.revenue) })),
  };
}

const orderDate = (o: OrderRow): number => {
  const v = o.created_at instanceof Date ? o.created_at.toISOString() : String(o.created_at ?? '');
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : 0;
};

/** Órdenes recientes (cap `take`, más nuevas primero), con items para agregación. */
async function fetchRecentOrders(container: MedusaContainer, take = 1000): Promise<OrderRow[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const { data } = (await query.graph({
    entity: 'order',
    fields: [
      'id',
      'total',
      'currency_code',
      'created_at',
      'customer_id',
      'email',
      'items.product_id',
      'items.title',
      'items.quantity',
      'items.total',
    ],
    pagination: { take, skip: 0, order: { created_at: 'DESC' } },
  })) as { data: OrderRow[] };
  return data ?? [];
}

function splitByRange(rows: OrderRow[], range: DateRange): { current: OrderRow[]; previous: OrderRow[] } {
  const fromMs = new Date(`${range.from}T00:00:00Z`).getTime();
  const prev = previousRange(range);
  const prevFromMs = new Date(`${prev.from}T00:00:00Z`).getTime();
  const current: OrderRow[] = [];
  const previous: OrderRow[] = [];
  for (const o of rows) {
    const t = orderDate(o);
    if (t >= fromMs) current.push(o);
    else if (t >= prevFromMs) previous.push(o);
  }
  return { current, previous };
}

function deltaPct(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return r2(((current - previous) / previous) * 100);
}

// ---------------------------------------------------------------------------
// Colectores (reutilizables por el motor de propuestas, sin LLM)
// ---------------------------------------------------------------------------

export async function collectSalesSnapshot(
  container: MedusaContainer,
  opts?: { days?: number; salesChannelId?: string; currencyCode?: string },
): Promise<Record<string, unknown>> {
  const range = computeRange(opts?.days ?? 30);
  const svc = resolveDashboard(container);
  if (svc) {
    await ensureFreshMetrics(container, svc, range);
    try {
      const dashboard = await svc.getDashboard({
        from: range.from,
        to: range.to,
        sales_channel_id: opts?.salesChannelId ?? null,
        currency_code: opts?.currencyCode ?? null,
      });
      const hasData =
        num(dashboard?.kpis?.orders?.value) > 0 || num(dashboard?.kpis?.orders?.previous) > 0;
      if (hasData) {
        const last = await svc.getLastAggregatedAt({ from: range.from, to: range.to }).catch(() => null);
        return {
          period: { from: range.from, to: range.to, days: range.days },
          data_source: 'snapshot',
          last_aggregated_at: last,
          ...summarizeDashboard(dashboard),
        };
      }
    } catch {
      // cae al escaneo vivo
    }
  }
  // Fallback vivo: sin módulo dashboard o sin filas en el rango.
  const rows = await fetchRecentOrders(container);
  const { current, previous } = splitByRange(rows, range);
  const cur = aggregateOrders(current);
  const prev = aggregateOrders(previous);
  return {
    period: { from: range.from, to: range.to, days: range.days },
    data_source: 'live',
    scan_cap_note: rows.length >= 1000 ? 'muestra acotada a las últimas 1000 órdenes' : undefined,
    kpis: {
      revenue: { value: cur.revenue, previous: prev.revenue, delta_pct: deltaPct(cur.revenue, prev.revenue) },
      orders: { value: cur.orders, previous: prev.orders, delta_pct: deltaPct(cur.orders, prev.orders) },
      aov: { value: cur.aov, previous: prev.aov, delta_pct: deltaPct(cur.aov, prev.aov) },
    },
    top_products: cur.top_products,
    breakdowns: { currencies: cur.currencies },
  };
}

type VariantStockRow = {
  id: string;
  sku?: string | null;
  title?: string | null;
  product?: { id?: string; title?: string } | null;
  inventory_items?: Array<{
    inventory?: {
      id?: string;
      location_levels?: Array<{
        location_id?: string;
        stocked_quantity?: unknown;
        reserved_quantity?: unknown;
      }> | null;
    } | null;
  }> | null;
};

export async function collectProductSignals(
  container: MedusaContainer,
  opts?: { days?: number; limit?: number; lowStockThreshold?: number },
): Promise<Record<string, unknown>> {
  const range = computeRange(opts?.days ?? 30);
  const limit = Math.min(Math.max(Math.trunc(num(opts?.limit)) || 10, 1), 25);
  const threshold = Math.max(Math.trunc(num(opts?.lowStockThreshold)) || 5, 1);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  // 1) Ventas por producto: métricas precomputadas; fallback = escaneo vivo.
  const svc = resolveDashboard(container);
  const salesByProduct = new Map<string, { id: string; title: string; revenue: number; units: number }>();
  let dataSource: 'snapshot' | 'live' = 'live';
  if (svc?.listProductMetricsDailies) {
    await ensureFreshMetrics(container, svc, range);
    try {
      const metricRows = await svc.listProductMetricsDailies(
        {
          bucket: 'daily',
          period_start: {
            $gte: new Date(`${range.from}T00:00:00Z`),
            $lte: new Date(`${range.to}T23:59:59Z`),
          },
        },
        { take: 5000 },
      );
      for (const row of metricRows ?? []) {
        const pid = row?.product_id;
        if (!pid) continue;
        const p =
          salesByProduct.get(pid) ??
          ({ id: pid, title: row?.product_title ?? pid, revenue: 0, units: 0 } as const as {
            id: string;
            title: string;
            revenue: number;
            units: number;
          });
        p.revenue += num(row?.revenue);
        p.units += num(row?.units_sold);
        salesByProduct.set(pid, p);
      }
      if (salesByProduct.size > 0) dataSource = 'snapshot';
    } catch {
      // cae al escaneo vivo
    }
  }
  if (salesByProduct.size === 0) {
    const rows = await fetchRecentOrders(container);
    const { current } = splitByRange(rows, range);
    for (const p of aggregateOrders(current).top_products) salesByProduct.set(p.id, { ...p });
    dataSource = 'live';
  }
  const sold = [...salesByProduct.values()].map((p) => ({ ...p, revenue: r2(p.revenue) }));
  const topProducts = [...sold].sort((a, b) => b.revenue - a.revenue).slice(0, limit);
  const slowMovers = sold
    .filter((p) => p.revenue > 0)
    .sort((a, b) => a.revenue - b.revenue)
    .slice(0, limit);

  // 2) Publicados SIN ventas en el rango (+ higiene: sin categoría).
  const { data: products } = (await query.graph({
    entity: 'product',
    fields: ['id', 'title', 'handle', 'status', 'collection_id', 'categories.id'],
    filters: { status: 'published' },
    pagination: { take: 300, skip: 0 },
  })) as { data: Array<Record<string, any>> };
  const noSales = (products ?? [])
    .filter((p) => !salesByProduct.has(p.id))
    .slice(0, 20)
    .map((p) => ({
      id: p.id,
      title: p.title,
      handle: p.handle,
      sin_categoria: !(Array.isArray(p.categories) && p.categories.length > 0),
      sin_coleccion: !p.collection_id,
    }));

  // 3) Stock: bajo / quiebre, con los IDs REALES para una reposición ejecutable.
  const { data: variants } = (await query.graph({
    entity: 'product_variant',
    fields: [
      'id',
      'sku',
      'title',
      'product.id',
      'product.title',
      'inventory_items.inventory.id',
      'inventory_items.inventory.location_levels.location_id',
      'inventory_items.inventory.location_levels.stocked_quantity',
      'inventory_items.inventory.location_levels.reserved_quantity',
    ],
    pagination: { take: 500, skip: 0 },
  })) as { data: VariantStockRow[] };

  const lowStock: Array<Record<string, unknown>> = [];
  const outOfStock: Array<Record<string, unknown>> = [];
  for (const v of variants ?? []) {
    const inv = v.inventory_items?.[0]?.inventory;
    const levels = inv?.location_levels ?? [];
    if (!inv?.id || !levels.length) continue;
    let available = 0;
    for (const lvl of levels) available += num(lvl?.stocked_quantity) - num(lvl?.reserved_quantity);
    if (available > threshold) continue;
    const productId = v.product?.id ?? null;
    const entry = {
      variant_id: v.id,
      sku: v.sku ?? null,
      product_id: productId,
      product_title: v.product?.title ?? null,
      variant_title: v.title ?? null,
      available,
      inventory_item_id: inv.id,
      location_id: levels[0]?.location_id ?? null,
      vende: productId ? salesByProduct.has(productId) : false,
    };
    (available <= 0 ? outOfStock : lowStock).push(entry);
  }
  // Priorizar lo que vende (una reposición de algo sin rotación no es urgente).
  const byRelevance = (a: any, b: any) => Number(b.vende) - Number(a.vende);
  lowStock.sort(byRelevance);
  outOfStock.sort(byRelevance);

  return {
    period: { from: range.from, to: range.to, days: range.days },
    data_source: dataSource,
    top_products: topProducts,
    slow_movers: slowMovers,
    no_sales: noSales,
    low_stock: lowStock.slice(0, 15),
    out_of_stock: outOfStock.slice(0, 15),
    low_stock_threshold: threshold,
  };
}

export async function collectCustomerSignals(
  container: MedusaContainer,
  opts?: { days?: number; limit?: number },
): Promise<Record<string, unknown>> {
  const range = computeRange(opts?.days ?? 90);
  const limit = Math.min(Math.max(Math.trunc(num(opts?.limit)) || 10, 1), 25);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  // 1) Resumen agregado new/returning/repeat con delta (métricas precomputadas).
  let summary: Record<string, unknown> | null = null;
  const svc = resolveDashboard(container);
  if (svc?.listCustomerMetricsDailies) {
    await ensureFreshMetrics(container, svc, range);
    const sumRows = (rows: any[]) => {
      const acc = { new_customers: 0, returning_customers: 0, customers_with_orders: 0, repeat_customers: 0 };
      for (const row of rows ?? []) {
        acc.new_customers += num(row?.new_customers);
        acc.returning_customers += num(row?.returning_customers);
        acc.customers_with_orders += num(row?.customers_with_orders);
        acc.repeat_customers += num(row?.repeat_customers);
      }
      return acc;
    };
    const rangeFilter = (r: DateRange) => ({
      bucket: 'daily',
      period_start: { $gte: new Date(`${r.from}T00:00:00Z`), $lte: new Date(`${r.to}T23:59:59Z`) },
    });
    try {
      const prev = previousRange(range);
      const [curRows, prevRows] = await Promise.all([
        svc.listCustomerMetricsDailies(rangeFilter(range), { take: 5000 }),
        svc.listCustomerMetricsDailies(rangeFilter(prev), { take: 5000 }),
      ]);
      const cur = sumRows(curRows);
      const before = sumRows(prevRows);
      const rate = (a: typeof cur) =>
        a.customers_with_orders > 0 ? r2(a.repeat_customers / a.customers_with_orders) : 0;
      summary = {
        new_customers: { value: cur.new_customers, previous: before.new_customers, delta_pct: deltaPct(cur.new_customers, before.new_customers) },
        returning_customers: { value: cur.returning_customers, previous: before.returning_customers, delta_pct: deltaPct(cur.returning_customers, before.returning_customers) },
        repeat_purchase_rate: { value: rate(cur), previous: rate(before), delta_pct: deltaPct(rate(cur), rate(before)) },
      };
    } catch {
      summary = null;
    }
  }

  // 2) Top clientes y clientes EN RIESGO (última compra hace 60-180 días) sobre
  //    el último año de órdenes (muestra acotada, más nuevas primero).
  const rows = await fetchRecentOrders(container);
  const byCustomer = new Map<
    string,
    { customer_id: string | null; email: string | null; total: number; orders: number; last_order_at: number }
  >();
  for (const o of rows) {
    const key = o.customer_id ?? o.email ?? null;
    if (!key) continue;
    const c =
      byCustomer.get(key) ??
      ({ customer_id: o.customer_id ?? null, email: o.email ?? null, total: 0, orders: 0, last_order_at: 0 } as {
        customer_id: string | null;
        email: string | null;
        total: number;
        orders: number;
        last_order_at: number;
      });
    c.total += num(o.total);
    c.orders += 1;
    c.last_order_at = Math.max(c.last_order_at, orderDate(o));
    byCustomer.set(key, c);
  }
  const now = Date.now();
  const daysSince = (t: number) => Math.floor((now - t) / (24 * 3600 * 1000));
  const all = [...byCustomer.values()].map((c) => ({
    customer_id: c.customer_id,
    email: c.email,
    total_spend: r2(c.total),
    orders: c.orders,
    days_since_last_order: daysSince(c.last_order_at),
  }));
  const topCustomers = [...all].sort((a, b) => b.total_spend - a.total_spend).slice(0, limit);
  const atRisk = all
    .filter((c) => c.days_since_last_order >= 60 && c.days_since_last_order <= 180)
    .sort((a, b) => b.total_spend - a.total_spend)
    .slice(0, 15);

  // 3) Customer groups EXISTENTES (las propuestas de segmento solo pueden apuntar acá).
  const { data: groups } = (await query.graph({
    entity: 'customer_group',
    fields: ['id', 'name'],
    pagination: { take: 50, skip: 0 },
  })) as { data: Array<{ id: string; name?: string }> };

  return {
    period: { from: range.from, to: range.to, days: range.days },
    data_source: summary ? 'snapshot' : 'live',
    summary,
    top_customers: topCustomers,
    at_risk: atRisk,
    customer_groups: (groups ?? []).map((g) => ({ id: g.id, name: g.name })),
  };
}

/**
 * Señales de PROMOCIONES: promos existentes + performance real (descuento
 * otorgado y órdenes alcanzadas, vía `items.adjustments.promotion_id` de las
 * órdenes del rango). Habilita propuestas de ciclo de vida: pausar/terminar la
 * promo que no rinde, extender/replicar la exitosa.
 */
export async function collectPromotionSignals(
  container: MedusaContainer,
  opts?: { days?: number },
): Promise<Record<string, unknown>> {
  const range = computeRange(opts?.days ?? 30);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  const { data: promos } = (await query.graph({
    entity: 'promotion',
    fields: [
      'id',
      'code',
      'status',
      'is_automatic',
      'application_method.type',
      'application_method.value',
      'application_method.target_type',
      'campaign.name',
      'campaign.starts_at',
      'campaign.ends_at',
    ],
    pagination: { take: 100, skip: 0 },
  })) as { data: Array<Record<string, any>> };

  // Uso real: descuento y órdenes por promotion_id dentro del rango.
  const { data: orders } = (await query.graph({
    entity: 'order',
    fields: ['id', 'created_at', 'items.adjustments.amount', 'items.adjustments.promotion_id'],
    pagination: { take: 1000, skip: 0, order: { created_at: 'DESC' } },
  })) as { data: Array<Record<string, any>> };
  const fromMs = new Date(`${range.from}T00:00:00Z`).getTime();
  const usage = new Map<string, { orders: Set<string>; discount: number }>();
  for (const o of orders ?? []) {
    const t = new Date(String(o.created_at ?? '')).getTime();
    if (!Number.isFinite(t) || t < fromMs) continue;
    for (const it of o.items ?? []) {
      for (const adj of it?.adjustments ?? []) {
        const pid = adj?.promotion_id;
        if (!pid) continue;
        const u = usage.get(pid) ?? { orders: new Set<string>(), discount: 0 };
        u.orders.add(o.id);
        u.discount += num(adj?.amount);
        usage.set(pid, u);
      }
    }
  }

  const rows = (promos ?? []).map((p) => {
    const u = usage.get(p.id);
    return {
      id: p.id,
      code: p.code ?? null,
      status: p.status,
      is_automatic: Boolean(p.is_automatic),
      type: p.application_method?.type ?? null,
      value: num(p.application_method?.value),
      target_type: p.application_method?.target_type ?? null,
      campaign_name: p.campaign?.name ?? null,
      starts_at: p.campaign?.starts_at ?? null,
      ends_at: p.campaign?.ends_at ?? null,
      usage: { orders: u?.orders.size ?? 0, discount_total: r2(u?.discount ?? 0) },
    };
  });
  const active = rows.filter((p) => p.status === 'active');
  return {
    period: { from: range.from, to: range.to, days: range.days },
    active_promotions: active,
    idle_active_promotions: active.filter((p) => p.usage.orders === 0),
    inactive_promotions: rows.filter((p) => p.status !== 'active').slice(0, 20),
  };
}

/** Señales de CARRITOS ABANDONADOS (módulo abandoned-cart, si está instalado). */
export async function collectCartSignals(
  container: MedusaContainer,
): Promise<Record<string, unknown> | null> {
  let svc: any;
  try {
    svc = container.resolve('abandonedCart');
  } catch {
    return null;
  }
  const rows: Array<Record<string, any>> = await svc
    .listAbandonedCarts({}, { take: 500, order: { last_activity_at: 'DESC' } })
    .catch(() => []);
  const byStatus = new Map<string, { count: number; value: number }>();
  for (const r of rows) {
    const s = r.status ?? 'pending';
    const acc = byStatus.get(s) ?? { count: 0, value: 0 };
    acc.count += 1;
    acc.value += num(r.cart_total);
    byStatus.set(s, acc);
  }
  const open = rows.filter((r) => r.status === 'pending' || r.status === 'notified');
  return {
    by_status: Object.fromEntries(
      [...byStatus.entries()].map(([k, v]) => [k, { count: v.count, value: r2(v.value) }]),
    ),
    open_count: open.length,
    open_value: r2(open.reduce((a, r) => a + num(r.cart_total), 0)),
    top_open_carts: open
      .sort((a, b) => num(b.cart_total) - num(a.cart_total))
      .slice(0, 10)
      .map((r) => ({
        cart_id: r.cart_id,
        email: r.email ?? null,
        customer_id: r.customer_id ?? null,
        cart_total: r2(num(r.cart_total)),
        currency_code: r.currency_code ?? null,
        status: r.status,
      })),
  };
}

/** Búsquedas SIN RESULTADOS del buscador (Typesense, si está instalado). */
export async function collectSearchGapSignals(
  container: MedusaContainer,
  limit = 20,
): Promise<Record<string, unknown> | null> {
  let svc: any;
  try {
    svc = container.resolve('typeSenseService');
  } catch {
    return null;
  }
  if (typeof svc?.getQueriesWithoutResults !== 'function') return null;
  const terms = await svc.getQueriesWithoutResults(limit).catch(() => []);
  if (!Array.isArray(terms) || terms.length === 0) return { no_result_searches: [] };
  return { no_result_searches: terms };
}

/** Estado del programa de FIDELIZACIÓN (módulo loyalty_engine, si está instalado). */
export async function collectLoyaltySignals(
  container: MedusaContainer,
): Promise<Record<string, unknown> | null> {
  let svc: any;
  try {
    svc = container.resolve('loyalty_engine');
  } catch {
    return null;
  }
  // `null` = el programa GLOBAL: estas señales alimentan el análisis de la
  // INSTALACIÓN y el asistente no tiene tienda activa de dónde sacar otra cosa.
  const program = await svc.getActiveProgram?.(null).catch(() => null);
  if (!program) return { active_program: null };
  const [campaigns, rewards, rules] = await Promise.all([
    svc.listCampaigns?.({ program_id: program.id }, { take: 50 }).catch(() => []),
    svc.listRewards?.({ program_id: program.id }, { take: 50 }).catch(() => []),
    svc.listEarnRules?.({ program_id: program.id }, { take: 50 }).catch(() => []),
  ]);
  const now = Date.now();
  const activeCampaigns = (campaigns ?? []).filter(
    (c: any) =>
      c.status === 'active' && (!c.ends_at || new Date(c.ends_at).getTime() >= now),
  );
  return {
    active_program: { id: program.id, name: program.name, points_name: program.points_name ?? null },
    active_campaigns: activeCampaigns.map((c: any) => ({
      id: c.id,
      name: c.name,
      multiplier: num(c.multiplier),
      starts_at: c.starts_at ?? null,
      ends_at: c.ends_at ?? null,
    })),
    rewards_count: (rewards ?? []).length,
    earn_rules: (rules ?? []).slice(0, 10).map((r: any) => ({
      id: r.id,
      name: r.name,
      event: r.event,
      status: r.status,
    })),
  };
}

// ---------------------------------------------------------------------------
// Tools (defs + runner)
// ---------------------------------------------------------------------------

export const ANALYTICS_TOOL_DEFS: NativeToolDef[] = [
  {
    name: NATIVE_TOOL.analyzeSales,
    description:
      'Resumen ejecutivo de VENTAS del período: KPIs (revenue, órdenes, ticket promedio, unidades, clientes nuevos/recurrentes) con comparación vs período anterior, tendencia, top productos/categorías/colecciones y desglose por canal y moneda. Usala PRIMERO en un análisis de negocio: reemplaza decenas de lecturas de órdenes.',
    parameters: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Días hacia atrás a analizar (default 30, máx 365).' },
        sales_channel_id: { type: 'string', description: 'Acotar a un canal de ventas (opcional).' },
        currency_code: { type: 'string', description: 'Acotar a una moneda (opcional).' },
      },
      additionalProperties: false,
    },
  },
  {
    name: NATIVE_TOOL.analyzeProducts,
    description:
      'Señales de CATÁLOGO del período: top sellers, productos que menos venden (slow movers), publicados SIN ventas (con flag de falta de categoría/colección) y stock bajo/quiebre con inventory_item_id y location_id reales (listos para proponer una reposición ejecutable).',
    parameters: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Días hacia atrás a analizar (default 30).' },
        limit: { type: 'number', description: 'Cantidad de productos por lista (default 10).' },
        low_stock_threshold: {
          type: 'number',
          description: 'Umbral de unidades disponibles para considerar stock bajo (default 5).',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: NATIVE_TOOL.analyzeCustomers,
    description:
      'Señales de CLIENTES del período: nuevos vs recurrentes y tasa de recompra (con delta), top clientes por gasto, clientes EN RIESGO (60-180 días sin comprar, ideales para win-back) y los customer groups existentes (las propuestas de segmento deben apuntar a estos grupos).',
    parameters: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Días hacia atrás a analizar (default 90).' },
        limit: { type: 'number', description: 'Cantidad de clientes por lista (default 10).' },
      },
      additionalProperties: false,
    },
  },
  {
    name: NATIVE_TOOL.analyzePromotions,
    description:
      'Señales de PROMOCIONES: promos existentes con su performance REAL del período (órdenes alcanzadas y descuento otorgado, medido sobre los ajustes de las órdenes). Detecta promos activas SIN uso (candidatas a pausar/terminar) y las exitosas (candidatas a extender/replicar).',
    parameters: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Días hacia atrás a analizar (default 30).' },
      },
      additionalProperties: false,
    },
  },
  {
    name: NATIVE_TOOL.analyzeCarts,
    description:
      'Señales de CARRITOS ABANDONADOS: cantidad y valor recuperable por estado, y los carritos abiertos de mayor valor (con cliente/email). Para proponer incentivos de recuperación.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: NATIVE_TOOL.analyzeSearchGaps,
    description:
      'BÚSQUEDAS SIN RESULTADOS del buscador de la tienda (término + cantidad de veces). Señal directa de demanda insatisfecha: productos faltantes, mal nombrados o mal tageados.',
    parameters: {
      type: 'object',
      properties: { limit: { type: 'number', description: 'Máx. términos (default 20).' } },
      additionalProperties: false,
    },
  },
  {
    name: NATIVE_TOOL.analyzeLoyalty,
    description:
      'Estado del programa de FIDELIZACIÓN: programa activo, campañas de puntos vigentes, rewards y earn rules. Para fundamentar propuestas de campañas de puntos o rewards nuevos.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
];

/** Ejecuta una tool de analytics por nombre; `undefined` si el nombre no es de este set. */
export async function runAnalyticsNativeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: NativeToolContext,
): Promise<string | undefined> {
  if (name === NATIVE_TOOL.analyzeSales) {
    const out = await collectSalesSnapshot(ctx.container, {
      days: num(args.days) || undefined,
      salesChannelId: typeof args.sales_channel_id === 'string' ? args.sales_channel_id : undefined,
      currencyCode: typeof args.currency_code === 'string' ? args.currency_code : undefined,
    });
    return `Resumen de ventas del período (comparado contra el período anterior):\n${JSON.stringify(out)}`;
  }
  if (name === NATIVE_TOOL.analyzeProducts) {
    const out = await collectProductSignals(ctx.container, {
      days: num(args.days) || undefined,
      limit: num(args.limit) || undefined,
      lowStockThreshold: num(args.low_stock_threshold) || undefined,
    });
    return `Señales de catálogo del período:\n${JSON.stringify(out)}`;
  }
  if (name === NATIVE_TOOL.analyzeCustomers) {
    const out = await collectCustomerSignals(ctx.container, {
      days: num(args.days) || undefined,
      limit: num(args.limit) || undefined,
    });
    return `Señales de clientes del período:\n${JSON.stringify(out)}`;
  }
  if (name === NATIVE_TOOL.analyzePromotions) {
    const out = await collectPromotionSignals(ctx.container, { days: num(args.days) || undefined });
    return `Señales de promociones (uso real del período):\n${JSON.stringify(out)}`;
  }
  if (name === NATIVE_TOOL.analyzeCarts) {
    const out = await collectCartSignals(ctx.container);
    if (!out) return 'La extensión de carritos abandonados no está instalada en esta tienda.';
    return `Señales de carritos abandonados:\n${JSON.stringify(out)}`;
  }
  if (name === NATIVE_TOOL.analyzeSearchGaps) {
    const out = await collectSearchGapSignals(ctx.container, num(args.limit) || 20);
    if (!out) return 'El buscador (Typesense) no está instalado en esta tienda.';
    return `Búsquedas sin resultados:\n${JSON.stringify(out)}`;
  }
  if (name === NATIVE_TOOL.analyzeLoyalty) {
    const out = await collectLoyaltySignals(ctx.container);
    if (!out) return 'El módulo de fidelización no está instalado en esta tienda.';
    return `Estado del programa de fidelización:\n${JSON.stringify(out)}`;
  }
  return undefined;
}
