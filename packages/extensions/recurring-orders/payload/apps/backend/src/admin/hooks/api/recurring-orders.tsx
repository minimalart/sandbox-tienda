import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toQueryString } from '../../lib/query-string';
/*
  `fetchJson` compartido, NO una copia local. Las seis rutas de acá
  (`admin/recurring-orders`, `[id]`, `/analytics`, `/cycles`, `/offers`,
  `/settings`) están declaradas `scoped`, pero la copia local mandaba sólo
  `Content-Type`: sin `x-site-id`, `siteFromRequest` resolvía `allSites` y el filtro
  quedaba en no-op. Igual que `payment-benefits`, la lista principal YA monta
  `<SiteScopeBar screen="recurring-orders" />`: el badge prometía aislamiento que el
  transporte no daba.

  `/settings` es el peor de los seis por la misma razón que `comments/settings`:
  no es una lista que muestra de más, es una fila de config que se lee y se escribe.
  Sin el header se editaba la de la tienda equivocada, y "Guardar" no avisa nada.

  Los combos del formulario (`sales-channels`, `product-categories`,
  `product-tags`, `products`) NO están en el registro de scoping y siguen listando
  todo; van por el mismo helper porque el header de más es inofensivo y tener dos
  transportes en un archivo es cómo se cuela la próxima copia sin `x-site-id`.
*/
import { fetchJson, siteHeaders } from '../../lib/http';

const BASE_URL = '/admin/recurring-orders';

export type RecurringOrderStatus =
  | 'active'
  | 'paused'
  | 'pending_payment'
  | 'failed'
  | 'cancelled'
  | 'completed';

export type RecurringOrderItem = {
  id: string;
  product_id: string;
  variant_id: string;
  quantity: number;
  product_snapshot?: {
    title?: string | null;
    variant_title?: string | null;
    sku?: string | null;
    thumbnail?: string | null;
  } | null;
  pricing_snapshot?: {
    unit_price?: number | null;
    currency_code?: string | null;
  } | null;
};

export type RenewalAttempt = {
  id: string;
  started_at: string;
  finished_at?: string | null;
  result: string;
  error?: string | null;
};

export type RenewalCycle = {
  id: string;
  scheduled_at: string;
  processed_at?: string | null;
  status:
    | 'scheduled'
    | 'forecasted'
    | 'quoted'
    | 'inventory_reserved'
    | 'awaiting_authorization'
    | 'awaiting_charge'
    | 'paid'
    | 'order_created'
    | 'retrying_stock'
    | 'past_due'
    | 'refunded'
    | 'canceled'
    | 'processing'
    | 'pending_payment'
    | 'success'
    | 'failed'
    | 'skipped';
  cart_id?: string | null;
  generated_order_id?: string | null;
  payment_status?: string | null;
  confirmation_url?: string | null;
  expires_at?: string | null;
  attempt_count: number;
  last_error?: string | null;
  metadata?: { totals?: { total?: number; currency_code?: string } } | null;
  attempts?: RenewalAttempt[];
};

export type RecurringLogRow = {
  id: string;
  event: string;
  actor_type: 'customer' | 'admin' | 'system';
  actor_id: string | null;
  data: Record<string, unknown> | null;
  created_at: string;
};

export type CancellationCaseRow = {
  id: string;
  status: 'requested' | 'retained' | 'paused' | 'skipped' | 'cancelled';
  reason: string | null;
  reason_note: string | null;
  retention_offer: { percentage: number; cycles: number } | null;
  decided_at: string | null;
  created_at: string;
};

export type RecurringOrder = {
  id: string;
  customer_id: string;
  email?: string | null;
  phone?: string | null;
  sales_channel_id: string;
  currency_code?: string | null;
  status: RecurringOrderStatus;
  payment_mode: string;
  frequency_interval: 'day' | 'week' | 'month';
  frequency_count: number;
  next_execution_at?: string | null;
  last_execution_at?: string | null;
  skip_next_cycle: boolean;
  consecutive_failures: number;
  shipping_address?: {
    first_name?: string | null;
    last_name?: string | null;
    address_1?: string | null;
    city?: string | null;
  } | null;
  created_at: string;
  items?: RecurringOrderItem[];
  cycles?: RenewalCycle[];
  logs?: RecurringLogRow[];
  cancellation_cases?: CancellationCaseRow[];
};

export type RecurringOrderMetrics = {
  total: number;
  by_status: Record<string, number>;
  due_next_7d: number;
  pending_payment_count: number;
  pending_payment_value: number;
  failed_cycles_30d: number;
};

export type RecurringOrdersListResponse = {
  recurring_orders: RecurringOrder[];
  count: number;
  offset: number;
  limit: number;
  metrics: RecurringOrderMetrics;
};

export const RECURRING_ORDERS_QUERY_KEY = ['recurring-orders'] as const;

export function useRecurringOrders(params?: {
  limit?: number;
  offset?: number;
  status?: string;
  q?: string;
}) {
  const qs = toQueryString(params as Record<string, unknown> | undefined);
  const url = qs ? `${BASE_URL}?${qs}` : BASE_URL;
  return useQuery({
    queryKey: [...RECURRING_ORDERS_QUERY_KEY, params ?? {}],
    queryFn: () => fetchJson<RecurringOrdersListResponse>(url),
  });
}

export function useRecurringOrder(id: string | undefined) {
  return useQuery({
    enabled: Boolean(id),
    queryKey: [...RECURRING_ORDERS_QUERY_KEY, 'detail', id],
    queryFn: () =>
      fetchJson<{ recurring_order: RecurringOrder }>(`${BASE_URL}/${id}`),
  });
}

function useRecurringOrderAction(path: 'pause' | 'resume' | 'cancel') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; reason?: string }) =>
      fetchJson<{ recurring_order: RecurringOrder }>(
        `${BASE_URL}/${vars.id}/${path}`,
        {
          method: 'POST',
          body: JSON.stringify(vars.reason ? { reason: vars.reason } : {}),
        },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: RECURRING_ORDERS_QUERY_KEY }),
  });
}

export function usePauseRecurringOrder() {
  return useRecurringOrderAction('pause');
}

export function useResumeRecurringOrder() {
  return useRecurringOrderAction('resume');
}

export function useCancelRecurringOrder() {
  return useRecurringOrderAction('cancel');
}

// ── Configuración de elegibilidad (scope all/selected por canal) ─────────────

export type RecurringScope = 'all' | 'selected';

export type FrequencyDiscount = {
  interval: 'day' | 'week' | 'month';
  count: number;
  percentage: number;
};

export type RetentionDiscount = { percentage: number; cycles: number };

export type RecurringSetting = {
  scope: RecurringScope;
  category_ids: string[];
  tag_values: string[];
  product_ids: string[];
  frequency_discounts: FrequencyDiscount[];
  retention_discount: RetentionDiscount | null;
  reminder_hours: number | null;
  expiration_hours: number | null;
  max_attempts: number | null;
  retry_hours: number | null;
  max_consecutive_failures: number | null;
  stock_policy: 'skip_unavailable' | 'fail_cycle' | null;
  price_change_policy: 'always_current' | 'warn_over_threshold' | null;
  price_change_threshold_pct: number | null;
  exists?: boolean;
};

export type RecurringPolicies = Pick<
  RecurringSetting,
  | 'reminder_hours'
  | 'expiration_hours'
  | 'max_attempts'
  | 'retry_hours'
  | 'max_consecutive_failures'
  | 'stock_policy'
  | 'price_change_policy'
  | 'price_change_threshold_pct'
>;

export type RecurringSettingsResponse = {
  setting: RecurringSetting | null;
  global_setting: RecurringSetting | null;
};

export const RECURRING_SETTINGS_QUERY_KEY = ['recurring-orders', 'settings'] as const;

export function useRecurringSettings(salesChannelId: string | null) {
  const qs = toQueryString(
    salesChannelId ? { sales_channel_id: salesChannelId } : undefined,
  );
  const url = qs ? `${BASE_URL}/settings?${qs}` : `${BASE_URL}/settings`;
  return useQuery({
    queryKey: [...RECURRING_SETTINGS_QUERY_KEY, salesChannelId ?? 'global'],
    queryFn: () => fetchJson<RecurringSettingsResponse>(url),
  });
}

export function useSaveRecurringSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      sales_channel_id: string | null;
      scope: RecurringScope;
      category_ids: string[];
      tag_values: string[];
      product_ids: string[];
      frequency_discounts: FrequencyDiscount[];
      retention_discount: RetentionDiscount | null;
    } & Partial<RecurringPolicies>) =>
      fetchJson<{ setting: RecurringSetting }>(`${BASE_URL}/settings`, {
        method: 'POST',
        body: JSON.stringify(vars),
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: RECURRING_SETTINGS_QUERY_KEY }),
  });
}

// ── Ofertas por producto (overrides de descuento) ────────────────────────────

export type RecurringOfferRow = {
  id: string;
  sales_channel_id: string | null;
  product_id: string;
  product_title: string | null;
  product_thumbnail: string | null;
  discounts: FrequencyDiscount[];
  enabled: boolean;
};

export const RECURRING_OFFERS_QUERY_KEY = ['recurring-orders', 'offers'] as const;

export function useRecurringOffers(salesChannelId: string | null) {
  const qs = toQueryString(
    salesChannelId ? { sales_channel_id: salesChannelId } : undefined,
  );
  const url = qs ? `${BASE_URL}/offers?${qs}` : `${BASE_URL}/offers`;
  return useQuery({
    queryKey: [...RECURRING_OFFERS_QUERY_KEY, salesChannelId ?? 'global'],
    queryFn: () => fetchJson<{ offers: RecurringOfferRow[] }>(url),
  });
}

export function useSaveRecurringOffer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      sales_channel_id: string | null;
      product_id: string;
      discounts: FrequencyDiscount[];
      enabled: boolean;
    }) =>
      fetchJson<{ offer: RecurringOfferRow }>(`${BASE_URL}/offers`, {
        method: 'POST',
        body: JSON.stringify(vars),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: RECURRING_OFFERS_QUERY_KEY }),
  });
}

export function useDeleteRecurringOffer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string }) =>
      fetchJson<{ id: string; deleted: boolean }>(`${BASE_URL}/offers/${vars.id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: RECURRING_OFFERS_QUERY_KEY }),
  });
}

/** Catálogos core para los pickers del drawer de configuración. */
export function useSalesChannelsList() {
  return useQuery({
    queryKey: ['recurring-orders', 'sales-channels'],
    queryFn: () =>
      fetchJson<{ sales_channels: { id: string; name: string }[] }>(
        '/admin/sales-channels?limit=200&fields=id,name',
      ),
  });
}

export function useProductCategoriesList() {
  return useQuery({
    queryKey: ['recurring-orders', 'product-categories'],
    queryFn: () =>
      fetchJson<{ product_categories: { id: string; name: string }[] }>(
        '/admin/product-categories?limit=500&fields=id,name',
      ),
  });
}

export function useProductTagsList() {
  return useQuery({
    queryKey: ['recurring-orders', 'product-tags'],
    queryFn: () =>
      fetchJson<{ product_tags: { id: string; value: string }[] }>(
        '/admin/product-tags?limit=500&fields=id,value',
      ),
  });
}

export function useProductSearch(q: string) {
  return useQuery({
    enabled: q.trim().length >= 2,
    queryKey: ['recurring-orders', 'product-search', q],
    queryFn: () =>
      fetchJson<{ products: { id: string; title: string }[] }>(
        `/admin/products?${toQueryString({ q: q.trim(), limit: 10, fields: 'id,title' })}`,
      ),
  });
}

export function useProductsByIds(ids: string[]) {
  return useQuery({
    enabled: ids.length > 0,
    queryKey: ['recurring-orders', 'products-by-ids', ids],
    queryFn: () =>
      fetchJson<{ products: { id: string; title: string }[] }>(
        `/admin/products?${ids.map((i) => `id[]=${encodeURIComponent(i)}`).join('&')}&limit=${ids.length}&fields=id,title`,
      ),
  });
}

// ── Cola global de renovaciones ──────────────────────────────────────────────

export type RenewalQueueRow = {
  id: string;
  recurring_order_id: string;
  scheduled_at: string;
  processed_at: string | null;
  status: RenewalCycle['status'];
  attempt_count: number;
  last_error: string | null;
  generated_order_id: string | null;
  confirmation_url: string | null;
  expires_at: string | null;
  totals: { total?: number; currency_code?: string } | null;
  subscription: {
    email: string | null;
    status: string;
    frequency_interval: 'day' | 'week' | 'month';
    frequency_count: number;
  } | null;
};

export const RENEWAL_CYCLES_QUERY_KEY = ['recurring-orders', 'cycles'] as const;

export function useRenewalCyclesQueue(params?: {
  limit?: number;
  offset?: number;
  status?: string;
  from?: string;
  to?: string;
}) {
  const qs = toQueryString(params as Record<string, unknown> | undefined);
  const url = qs ? `${BASE_URL}/cycles?${qs}` : `${BASE_URL}/cycles`;
  return useQuery({
    queryKey: [...RENEWAL_CYCLES_QUERY_KEY, params ?? {}],
    queryFn: () =>
      fetchJson<{ cycles: RenewalQueueRow[]; count: number; limit: number; offset: number }>(
        url,
      ),
  });
}

// ── Analytics (snapshots diarios) ────────────────────────────────────────────

export type RecurringMetricsPoint = {
  date: string;
  active_count: number;
  paused_count: number;
  pending_payment_count: number;
  failed_count: number;
  cancelled_count: number;
  new_count: number;
  cancelled_today: number;
  renewals_success: number;
  renewals_failed: number;
  renewals_skipped: number;
  pending_value: number;
  mrr_estimate: number;
  currency_code: string | null;
  top_products: { product_id: string; title: string | null; subscriptions: number }[];
};

export type RecurringAnalyticsResponse = {
  from: string;
  to: string;
  series: RecurringMetricsPoint[];
  summary: {
    active_count: number;
    mrr_estimate: number;
    pending_value: number;
    currency_code: string | null;
    new_in_range: number;
    cancelled_in_range: number;
    renewals_success: number;
    renewals_failed: number;
    renewals_skipped: number;
    gmv_recurring: number;
    failed_payments: number;
    recovered_payments: number;
    recovered_revenue: number;
    ltv_average: number;
    renewal_success_rate: number | null;
    churn_rate: number | null;
    top_products: RecurringMetricsPoint['top_products'];
  } | null;
};

export const RECURRING_ANALYTICS_QUERY_KEY = ['recurring-orders', 'analytics'] as const;

export function useRecurringAnalytics(params: {
  from?: string;
  to?: string;
  sales_channel_id?: string | null;
}) {
  const qs = toQueryString({
    ...(params.from ? { from: params.from } : {}),
    ...(params.to ? { to: params.to } : {}),
    ...(params.sales_channel_id ? { sales_channel_id: params.sales_channel_id } : {}),
  });
  const url = qs ? `${BASE_URL}/analytics?${qs}` : `${BASE_URL}/analytics`;
  return useQuery({
    queryKey: [...RECURRING_ANALYTICS_QUERY_KEY, params],
    queryFn: () => fetchJson<RecurringAnalyticsResponse>(url),
  });
}

export function useRebuildRecurringAnalytics() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { from?: string; to?: string }) => {
      const qs = toQueryString(vars as Record<string, unknown>);
      return fetchJson<{ days: number; rows: number }>(
        qs ? `${BASE_URL}/analytics/rebuild?${qs}` : `${BASE_URL}/analytics/rebuild`,
        { method: 'POST', body: '{}' },
      );
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: RECURRING_ANALYTICS_QUERY_KEY }),
  });
}

export function useForceRenewalCycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; cycleId: string }) =>
      fetchJson<{ result: { outcome: string; reason?: string | null } }>(
        `${BASE_URL}/${vars.id}/cycles/${vars.cycleId}/force`,
        { method: 'POST', body: '{}' },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: RECURRING_ORDERS_QUERY_KEY }),
  });
}

// ── Suscripciones V2: planes, demanda e incidentes ──────────────────────────

export type SubscriptionPlanOffer = {
  id: string;
  label: string | null;
  frequency_interval: 'day' | 'week' | 'month';
  frequency_count: number;
  discount_type: 'none' | 'percentage' | 'fixed_amount' | 'fixed_price';
  discount_value: number;
  currency_code: string | null;
};

export type SubscriptionPlanTarget = {
  id: string;
  target_type: 'product' | 'variant' | 'category' | 'tag';
  target_id: string;
};

export type SubscriptionPlanBundle = {
  plan: {
    id: string;
    name: string;
    handle: string;
    status: 'draft' | 'active' | 'archived';
    version: number;
    sales_channel_id: string | null;
    price_policy: 'dynamic' | 'fixed';
    promotion_policy: 'best_benefit' | 'subscription_only' | 'stack';
    allow_stacking: boolean;
    currency_code: string | null;
    minimum_cycles: number;
    preflight_hours: number;
    reservation_hours: number;
    stock_retry_hours: number;
    stock_retry_interval_hours: number;
    payment_retry_hours: number;
    payment_retry_interval_hours: number;
    trial_days: number;
    legacy: boolean;
    updated_at: string;
  };
  offers: SubscriptionPlanOffer[];
  targets: SubscriptionPlanTarget[];
  impacted_subscriptions?: number;
};

export type SubscriptionPlanInput = {
  sales_channel_id?: string | null;
  name: string;
  purchase_mode: 'one_time_and_subscription' | 'subscription_only';
  price_policy: 'dynamic' | 'fixed';
  promotion_policy: 'best_benefit' | 'subscription_only' | 'stack';
  allow_stacking: boolean;
  currency_code?: string | null;
  preflight_hours: number;
  reservation_hours: number;
  stock_retry_hours: number;
  stock_retry_interval_hours: number;
  payment_retry_hours: number;
  payment_retry_interval_hours: number;
  forecast_windows: number[];
  trial_days: number;
  minimum_cycles: number;
  offers: Array<{
    label?: string | null;
    frequency_interval: 'day' | 'week' | 'month';
    frequency_count: number;
    discount_type: 'none' | 'percentage' | 'fixed_amount' | 'fixed_price';
    discount_value: number;
    fixed_unit_prices?: Record<string, number> | null;
  }>;
  targets: Array<{
    target_type: 'product' | 'variant' | 'category' | 'tag';
    target_id: string;
  }>;
};

export const SUBSCRIPTION_PLANS_QUERY_KEY = ['recurring-orders', 'plans'] as const;

export function useSubscriptionPlans(params?: { limit?: number; offset?: number; status?: string }) {
  const qs = toQueryString(params as Record<string, unknown> | undefined);
  return useQuery({
    queryKey: [...SUBSCRIPTION_PLANS_QUERY_KEY, params ?? {}],
    queryFn: () => fetchJson<{
      plans: SubscriptionPlanBundle[];
      count: number;
      limit: number;
      offset: number;
    }>(`${BASE_URL}/plans${qs ? `?${qs}` : ''}`),
  });
}

export function useCreateSubscriptionPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SubscriptionPlanInput) =>
      fetchJson<SubscriptionPlanBundle>(`${BASE_URL}/plans`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: SUBSCRIPTION_PLANS_QUERY_KEY }),
  });
}

export function useUpdateSubscriptionPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; input: SubscriptionPlanInput }) =>
      fetchJson<SubscriptionPlanBundle>(`${BASE_URL}/plans/${vars.id}`, {
        method: 'POST',
        body: JSON.stringify(vars.input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: SUBSCRIPTION_PLANS_QUERY_KEY }),
  });
}

export function usePublishSubscriptionPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<SubscriptionPlanBundle>(`${BASE_URL}/plans/${id}/publish`, {
        method: 'POST',
        body: '{}',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: SUBSCRIPTION_PLANS_QUERY_KEY }),
  });
}

export function useArchiveSubscriptionPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ id: string; archived: boolean; impacted_subscriptions: number }>(
        `${BASE_URL}/plans/${id}`,
        { method: 'DELETE' },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: SUBSCRIPTION_PLANS_QUERY_KEY }),
  });
}

export function useDuplicateSubscriptionPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<SubscriptionPlanBundle>(`${BASE_URL}/plans/${id}/duplicate`, {
        method: 'POST',
        body: '{}',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: SUBSCRIPTION_PLANS_QUERY_KEY }),
  });
}

export type SubscriptionForecastRow = {
  variant_id: string;
  sales_channel_id: string;
  location_id: string | null;
  location_name: string | null;
  required_14d: number;
  required_30d: number;
  available: number;
  deficit_14d: number;
  deficit_30d: number;
  recurring_order_ids: string[];
  next_due_at: string | null;
};

export function useSubscriptionForecast() {
  return useQuery({
    queryKey: ['recurring-orders', 'forecast'],
    queryFn: () => fetchJson<{ forecast: SubscriptionForecastRow[]; generated_at: string }>(
      `${BASE_URL}/forecast`,
    ),
  });
}

export type SubscriptionAlert = {
  id: string;
  type: string;
  severity: 'warning' | 'critical';
  status: 'open' | 'resolved';
  title: string;
  message: string | null;
  variant_id: string | null;
  recurring_order_id: string | null;
  renewal_cycle_id: string | null;
  detected_at: string;
};

export function useSubscriptionAlerts(params?: { status?: string; type?: string }) {
  const qs = toQueryString(params as Record<string, unknown> | undefined);
  return useQuery({
    queryKey: ['recurring-orders', 'alerts', params ?? {}],
    queryFn: () => fetchJson<{ alerts: SubscriptionAlert[]; count: number }>(
      `${BASE_URL}/alerts${qs ? `?${qs}` : ''}`,
    ),
  });
}

export function useResolveSubscriptionAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fetchJson(
      `${BASE_URL}/alerts/${id}/resolve`,
      { method: 'POST', body: '{}' },
    ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recurring-orders', 'alerts'] }),
  });
}

// ── Motivos de cancelación ──────────────────────────────────────────────────

export type SubscriptionCancellationReason = {
  id: string;
  sales_channel_id: string | null;
  code: string;
  label: string;
  enabled: boolean;
  sort_order: number;
};

export function useSubscriptionCancellationReasons() {
  return useQuery({
    queryKey: [...RECURRING_ORDERS_QUERY_KEY, 'cancellation-reasons'],
    queryFn: () => fetchJson<{ cancellation_reasons: SubscriptionCancellationReason[] }>(
      `${BASE_URL}/cancellation-reasons`,
    ),
  });
}

export function useCreateSubscriptionCancellationReason() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<SubscriptionCancellationReason, 'id' | 'sales_channel_id'>) =>
      fetchJson(`${BASE_URL}/cancellation-reasons`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: RECURRING_ORDERS_QUERY_KEY }),
  });
}

export function useUpdateSubscriptionCancellationReason() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<SubscriptionCancellationReason> & { id: string }) =>
      fetchJson(`${BASE_URL}/cancellation-reasons/${id}`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: RECURRING_ORDERS_QUERY_KEY }),
  });
}

export function useDeleteSubscriptionCancellationReason() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fetch(`${BASE_URL}/cancellation-reasons/${id}`, {
      method: 'DELETE', credentials: 'include', headers: siteHeaders(),
    }).then((response) => {
      if (!response.ok) throw new Error('No se pudo eliminar el motivo.');
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: RECURRING_ORDERS_QUERY_KEY }),
  });
}
