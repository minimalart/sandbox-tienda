import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/**
 * Hooks React Query de la extensión ERP (config, sync logs, outbox).
 * Mismo patrón que banners.tsx: fetchJson + invalidación por query key.
 */

const BASE_URL = '/admin/erp';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ErpProviderEntry = { id: string; label: string; available: boolean };
export type ErpCountryEntry = { id: string; label: string };
export type ErpCapabilities = {
  stock_pull: boolean;
  sale_notify: boolean;
  stock_batch_size: number;
  catalog_pull?: boolean;
  catalog_prices_include_tax?: boolean;
  categories_pull?: boolean;
  /** Cotiza entonados tintométricos: habilita la sección del sistema tintométrico. */
  tinting_price?: boolean;
  /** Recupera el comprobante que el ERP emitió: habilita el PDF en la orden. */
  invoice_fetch?: boolean;
};

export type ErpContabiliumSettings = {
  base_url?: string;
  deposito_id?: number | null;
  sale_mode?: 'orden_venta' | 'factura_cobrada';
  punto_venta_id?: number | null;
  tipo_fc?: string;
  condicion_venta?: string;
  default_client_id?: number | null;
  shipping_concept_sku?: string | null;
  prices_include_tax?: boolean;
  tax_rate?: number;
};

export type ErpBsaleSettings = {
  base_url?: string;
  office_id?: number | null;
  document_type_id?: number | null;
  price_list_id?: number | null;
  payment_type_id?: number | null;
  tax_ids?: number[];
  declare_sii?: boolean;
  dispatch_stock?: boolean;
  send_email?: boolean;
  prices_include_tax?: boolean;
  tax_rate?: number;
};

export type ErpZeusSettings = {
  base_url?: string;
  ecommerce_id?: string | null;
  sucursal?: number | null;
  deposito_id?: number | null;
  pto_vta?: number | null;
  cod_lista?: number | null;
  cond_venta?: string | null;
  tipo_comp?: string | null;
  codigo_de_vendedor?: string | null;
  default_client_code?: string | null;
  create_clients?: boolean;
  default_codigo_iva?: number | null;
  shipping_item_code?: string | null;
  send_payments?: boolean;
  tipo_pago?: string | null;
  tarjeta_code?: string | null;
  eshop_only?: boolean;
  subtract_committed?: boolean;
  prices_include_tax?: boolean;
  tax_rate?: number;
};

export type ErpOdooSettings = {
  base_url: string;
  db: string;
  uid: number;
  allowed_company_ids?: number[];
  timeout_ms?: number;
  shipping_item_code?: string;
  auto_confirm?: boolean;
  only_published?: boolean;
};

export type ErpProductField =
  | 'title'
  | 'description'
  | 'weight'
  | 'length'
  | 'height'
  | 'width'
  | 'barcode'
  | 'category'
  | 'brand'
  | 'family';

export type ErpPriceListMapping = {
  zeus_index: number;
  title: string;
  customer_group_id?: string | null;
  enabled?: boolean;
};

export type ErpCatalogSyncSettings = {
  currency_code?: string;
  base_list_index?: number;
  price_lists?: ErpPriceListMapping[];
  only_published?: boolean;
  create_products?: boolean;
  /** Estado con el que nacen los artículos que crea el sync. Default `draft`. */
  created_product_status?: 'draft' | 'published';
  /**
   * Canales de venta de los productos creados. Sin al menos uno el producto NO se
   * ve en la tienda, ni siquiera `published`.
   */
  sales_channel_ids?: string[];
  /** Espejar el estado de publicación del ERP sobre productos que ya existen. */
  status_sync?: boolean;
  /** Además despublicar los que no vinieron en un barrido completo. */
  status_sync_unpublish_missing?: boolean;
  /** Tope de despublicaciones por corrida, en % de lo que trajo el ERP. */
  max_unpublish_pct?: number;
  /** Bajar las imágenes del ERP y dejarlas como `images` + `thumbnail`. */
  images?: { enabled?: boolean; backfill_pending?: boolean };
  product_fields?: ErpProductField[];
  /** Normalización del título recibido del ERP (reglas R01–R26). */
  title_rules?: {
    enabled?: boolean;
    strip_brand?: boolean;
    dictionary?: Record<string, string>;
    promo_legends?: string[];
  };
  /** Escribir la presentación en el valor de la opción de variante. */
  presentation_option?: { enabled?: boolean; backfill_pending?: boolean };
  /** Escribir el color del titulo como opcion Color de variante. */
  color_option?: { enabled?: boolean; backfill_pending?: boolean };
  categories_sync?: boolean;
  categories_sync_rank?: boolean;
  categories_backfill_pending?: boolean;
  brands_sync?: boolean;
  brands_replace_existing?: boolean;
  /** @deprecated override manual; lo reemplaza `categories_sync`. */
  category_map?: Record<string, string>;
  shipping_profile_id?: string | null;
  overlap_minutes?: number;
  full_sweep_hour?: number | null;
  /** Qué hace el barrido completo: imágenes (default false), price lists (default true). */
  full_sweep?: { images?: boolean; price_lists?: boolean };
  max_change_pct?: number;
  /** Lo escribe el motor: cuándo terminó el último barrido completo. */
  last_full_sweep_at?: string | null;
  write_chunk_size?: number;
  last_synced_at?: string | null;
};

export type ErpSettings = {
  stock_location_id?: string | null;
  stock_sync?: {
    page_size?: number;
    update_chunk_size?: number;
    deposito_map?: Array<{ deposito: string; stock_location_id: string; enabled?: boolean }>;
    sales_channel_ids?: string[];
  };
  catalog_sync?: ErpCatalogSyncSettings;
  outbox?: {
    max_attempts?: number;
    base_delay_s?: number;
    max_delay_s?: number;
    /** Presupuesto propio del poll de comprobante: el ERP factura por lote. */
    invoice_fetch?: { max_attempts?: number; base_delay_s?: number; max_delay_s?: number };
  };
  /** Cuándo se notifica la venta y desde qué depósito se factura. */
  sales_notify?: {
    trigger?: 'payment_captured' | 'fulfillment_created';
    billing_deposito?: string | null;
  };
  contabilium?: ErpContabiliumSettings;
  bsale?: ErpBsaleSettings;
  zeus?: ErpZeusSettings;
  odoo?: ErpOdooSettings;
  tinting?: { enabled?: boolean; default_collection?: string | null };
};

export type ErpConfig = {
  id: string;
  provider: string;
  country_code: string;
  enabled: boolean;
  stock_sync_enabled: boolean;
  catalog_sync_enabled: boolean;
  sales_notify_enabled: boolean;
  settings: ErpSettings;
  credentials_set: boolean;
  credential_keys: string[];
  last_validated_at: string | null;
  last_validation_ok: boolean | null;
  last_validation_error: string | null;
};

export type ErpConfigResponse = {
  config: ErpConfig | null;
  providers: ErpProviderEntry[];
  countries: ErpCountryEntry[];
  capabilities: ErpCapabilities | null;
};

export type ErpConfigUpdateInput = {
  provider?: string;
  country_code?: string;
  enabled?: boolean;
  stock_sync_enabled?: boolean;
  catalog_sync_enabled?: boolean;
  sales_notify_enabled?: boolean;
  credentials?: Record<string, string>;
  settings?: ErpSettings;
};

export type ErpSyncSummary = {
  total_skus?: number;
  processed?: number;
  updated?: number;
  not_found?: number;
  duplicate_sku?: number;
  invalid_quantity?: number;
  skipped_unchanged?: number;
  skipped_other?: number;
  failed?: number;
  duration_ms?: number;
  location_id?: string;
  location_warning?: string;
  // Solo en corridas `catalog_sync`
  total_erp_rows?: number;
  skipped?: number;
  created?: number;
  price_unchanged?: number;
  no_price_set?: number;
  variant_not_found?: number;
  not_published?: number;
  products_created?: number;
  since?: string | null;
  full_sweep?: boolean;
  dry_run?: boolean;
  watermark?: string | null;
  currency_code?: string;
  base_list_index?: number;
  price_lists?: Array<{ zeus_index: number; title: string; price_list_id: string }>;
  reindexed_products?: number;
  create_products?: boolean;
  product_fields?: string[];
  /** Estado de publicación espejado del ERP (`status_sync`). */
  status_sync?: {
    enabled?: boolean;
    unpublish_missing?: boolean;
    max_unpublish_pct?: number;
    /** Productos que pasaron a `published`. */
    published?: number;
    /** Productos que volvieron a `draft`. */
    unpublished?: number;
    unchanged?: number;
    skipped_not_owned?: number;
    skipped_manual_state?: number;
    /** Despublicaciones que el guard de volumen bloqueó. */
    skipped_by_guard?: number;
    planned_published?: number;
    planned_unpublished?: number;
  };
  /** Normalización de títulos de la corrida (reglas R01–R26). */
  titles?: {
    enabled?: boolean;
    /** `title` está en la allowlist: se corrigen también los productos existentes. */
    rewrites_existing?: boolean;
    /** Títulos efectivamente reescritos. */
    normalized?: number;
    /** Artículos con unidad desconocida o fracción sin regla. */
    warnings?: number;
  };
  /** Etiqueta de presentación en la opción de variante (lo que pinta la card). */
  presentation?: {
    enabled?: boolean;
    backfill?: boolean;
    /** Valores de opción renombrados (`Único` → `1 L`). */
    renamed?: number;
    titles_updated?: number;
    unchanged?: number;
    /** Solo en dry-run: cuántos renombraría. */
    planned?: number;
    skipped?: Record<string, number>;
  };
  /** Opción de color derivada del título (vocabulario cerrado). */
  color?: {
    enabled?: boolean;
    backfill?: boolean;
    /** Opciones `Color` creadas. */
    created?: number;
    /** Solo en dry-run: cuántas crearía. */
    planned?: number;
    /** La fase se cortó por fallos consecutivos y quedó trabajo sin intentar. */
    aborted?: boolean;
    skipped?: Record<string, number>;
  };
  /** Códigos de barras del ERP (vienen de un campo de notas, así que se validan). */
  barcodes?: {
    /** `barcode` está en la allowlist: además de validarse, se escribe. */
    writes?: boolean;
    /** Artículos con un GTIN válido. */
    valid?: number;
    /** Artículos que traían algo pero no era un GTIN. */
    rejected?: number;
    /**
     * Artículos cuyo GTIN es válido pero está cargado en más de un artículo del
     * ERP: no se escribe en ninguno (Medusa exige `barcode` único).
     */
    duplicated?: number;
  };
  change_pct?: number;
  matchable?: number;
  warnings?: string[];
};

export type ErpSyncLog = {
  id: string;
  type: string;
  provider: string;
  trigger: 'cron' | 'manual';
  status: 'running' | 'completed' | 'completed_with_errors' | 'failed';
  started_at: string;
  finished_at: string | null;
  summary: ErpSyncSummary | null;
  error: { message?: string } | null;
  created_by: string | null;
};

export type ErpSyncLogItem = {
  id: string;
  sync_log_id: string;
  entity_type: string;
  entity_id: string;
  status:
    | 'updated'
    | 'not_found'
    | 'duplicate_sku'
    | 'invalid_quantity'
    | 'skipped'
    | 'failed'
    | 'created'
    | 'price_unchanged'
    | 'no_price_set'
    | 'variant_not_found'
    | 'not_published';
  request_payload: Record<string, unknown> | null;
  response_payload: Record<string, unknown> | null;
  error: string | null;
};

export type ErpOutboxEvent = {
  id: string;
  event_type: string;
  event_key: string;
  aggregate_type: string;
  aggregate_id: string;
  provider: string;
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'dead_letter' | 'skipped' | 'duplicate';
  attempts: number;
  next_retry_at: string | null;
  sent_at: string | null;
  external_ref: string | null;
  last_error: string | null;
  created_at: string;
};

export type ErpOutboxCounts = Partial<Record<ErpOutboxEvent['status'], number>>;

export type StockLocationOption = { id: string; name: string };

// ─── Query keys ───────────────────────────────────────────────────────────────

export const ERP_CONFIG_QUERY_KEY = ['erp', 'config'] as const;
export const ERP_SYNC_LOGS_QUERY_KEY = ['erp', 'sync-logs'] as const;
export const ERP_OUTBOX_QUERY_KEY = ['erp', 'outbox-events'] as const;

// ─── Fetch helper ─────────────────────────────────────────────────────────────

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message?: string }).message ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

type QueryOpts = { refetchInterval?: number | false; enabled?: boolean };

// ─── Config ───────────────────────────────────────────────────────────────────

export function useErpConfig(opts?: QueryOpts) {
  return useQuery({
    queryKey: ERP_CONFIG_QUERY_KEY,
    queryFn: () => fetchJson<ErpConfigResponse>(`${BASE_URL}/config`),
    ...opts,
  });
}

export function useUpdateErpConfig(callbacks?: {
  onSuccess?: (data: ErpConfigResponse) => void;
  onError?: (error: Error) => void;
}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ErpConfigUpdateInput) =>
      fetchJson<ErpConfigResponse>(`${BASE_URL}/config`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ERP_CONFIG_QUERY_KEY });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => callbacks?.onError?.(error),
  });
}

// ─── Facturación por orden ────────────────────────────────────────────────────

export type ErpOrderBillingOption = {
  deposito: string;
  stock_location_id: string;
  stock_location_name: string | null;
};

export type ErpOrderBilling = {
  resolved: boolean;
  reason: 'not_configured' | 'not_mapped' | null;
  deposito: string | null;
  stock_location_id: string | null;
  stock_location_name: string | null;
  source: 'order' | 'config' | null;
  override: string | null;
  confirmation: {
    deposito: string;
    stock_location_id: string;
    confirmed_at: string;
    confirmed_by?: string | null;
  } | null;
  options: ErpOrderBillingOption[];
};

export type ErpOrderInvoice = {
  id: string;
  numero_comp: number | null;
  tipo_comp: string | null;
  letra: string | null;
  punto_de_venta: number | null;
  sucursal: number | null;
  fecha: string | null;
  total: number | null;
  has_pdf: boolean;
};

export type ErpOrderEvent = {
  id: string;
  status: ErpOutboxEvent['status'];
  attempts: number;
  external_ref?: string | null;
  last_error: string | null;
  next_retry_at: string | null;
  sent_at?: string | null;
};

export type ErpOrderStatus = {
  enabled: boolean;
  provider?: string;
  trigger: 'payment_captured' | 'fulfillment_created' | null;
  capabilities: { invoice_fetch: boolean } | null;
  billing: ErpOrderBilling | null;
  sale_event: ErpOrderEvent | null;
  invoice_event: ErpOrderEvent | null;
  invoice: ErpOrderInvoice | null;
};

export const erpOrderQueryKey = (orderId: string) => ['erp', 'order', orderId] as const;

export function useErpOrderStatus(orderId: string, opts?: QueryOpts) {
  return useQuery({
    queryKey: erpOrderQueryKey(orderId),
    queryFn: () => fetchJson<ErpOrderStatus>(`${BASE_URL}/orders/${orderId}`),
    ...opts,
  });
}

export function useSetErpOrderBillingDeposito(
  orderId: string,
  callbacks?: { onSuccess?: () => void; onError?: (error: Error) => void }
) {
  const qc = useQueryClient();
  return useMutation({
    // `null` = volver al default de la config, no "no tocar".
    mutationFn: (deposito: string | null) =>
      fetchJson<{ order_id: string; deposito: string | null }>(
        `${BASE_URL}/orders/${orderId}/billing-deposito`,
        { method: 'POST', body: JSON.stringify({ deposito }) }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: erpOrderQueryKey(orderId) });
      callbacks?.onSuccess?.();
    },
    onError: (error: Error) => callbacks?.onError?.(error),
  });
}

export type ValidateConnectionResult = {
  ok: boolean;
  message: string | null;
  persisted: boolean;
  validated_at: string;
};

export function useValidateErpConnection(callbacks?: {
  onSuccess?: (data: ValidateConnectionResult) => void;
  onError?: (error: Error) => void;
}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { provider?: string; credentials?: Record<string, string> }) =>
      fetchJson<ValidateConnectionResult>(`${BASE_URL}/validate-connection`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ERP_CONFIG_QUERY_KEY });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => callbacks?.onError?.(error),
  });
}

// ─── Stock sync ───────────────────────────────────────────────────────────────

export function useRunStockSync(callbacks?: {
  onSuccess?: (data: { sync_log_id: string }) => void;
  onError?: (error: Error) => void;
}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      fetchJson<{ sync_log_id: string }>(`${BASE_URL}/stock-sync/run`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ERP_SYNC_LOGS_QUERY_KEY });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => callbacks?.onError?.(error),
  });
}

// ─── Catalog sync ─────────────────────────────────────────────────────────────

export function useRunCatalogSync(callbacks?: {
  onSuccess?: (data: { sync_log_id: string; dry_run: boolean; full_sweep: boolean }) => void;
  onError?: (error: Error) => void;
}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars?: { dryRun?: boolean; fullSweep?: boolean }) => {
      const qs = new URLSearchParams();
      if (vars?.dryRun) qs.set('dry_run', 'true');
      if (vars?.fullSweep) qs.set('full_sweep', 'true');
      const suffix = qs.toString() ? `?${qs.toString()}` : '';
      return fetchJson<{ sync_log_id: string; dry_run: boolean; full_sweep: boolean }>(
        `${BASE_URL}/catalog-sync/run${suffix}`,
        { method: 'POST', body: JSON.stringify({}) }
      );
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ERP_SYNC_LOGS_QUERY_KEY });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => callbacks?.onError?.(error),
  });
}

/** Price lists, customer groups y shipping profiles para armar el mapeo de listas. */
export function useErpPriceListOptions() {
  return useQuery({
    queryKey: ['erp', 'price-lists'],
    queryFn: () =>
      fetchJson<{
        price_lists: Array<{ id: string; title: string; status: string; type: string }>;
        customer_groups: Array<{ id: string; name: string }>;
        shipping_profiles: Array<{ id: string; name: string }>;
        sales_channels: Array<{ id: string; name: string; is_disabled: boolean }>;
      }>(`${BASE_URL}/price-lists`),
  });
}

export function useErpSyncLogs(
  params?: { type?: string; status?: string; limit?: number; offset?: number },
  opts?: QueryOpts
) {
  const qs = new URLSearchParams();
  if (params?.type) qs.set('type', params.type);
  if (params?.status) qs.set('status', params.status);
  if (params?.limit != null) qs.set('limit', String(params.limit));
  if (params?.offset != null) qs.set('offset', String(params.offset));
  return useQuery({
    queryKey: [...ERP_SYNC_LOGS_QUERY_KEY, params ?? {}],
    queryFn: () =>
      fetchJson<{ sync_logs: ErpSyncLog[]; count: number }>(`${BASE_URL}/sync-logs?${qs.toString()}`),
    ...opts,
  });
}

export function useErpSyncLog(id: string | undefined, opts?: QueryOpts) {
  return useQuery({
    queryKey: [...ERP_SYNC_LOGS_QUERY_KEY, id],
    queryFn: () => fetchJson<{ sync_log: ErpSyncLog }>(`${BASE_URL}/sync-logs/${id}`),
    enabled: Boolean(id) && (opts?.enabled ?? true),
    refetchInterval: opts?.refetchInterval,
  });
}

export function useErpSyncLogItems(
  id: string | undefined,
  params?: { status?: string; entity_id?: string; limit?: number; offset?: number },
  opts?: QueryOpts
) {
  const qs = new URLSearchParams();
  if (params?.status) qs.set('status', params.status);
  if (params?.entity_id) qs.set('entity_id', params.entity_id);
  if (params?.limit != null) qs.set('limit', String(params.limit));
  if (params?.offset != null) qs.set('offset', String(params.offset));
  return useQuery({
    queryKey: [...ERP_SYNC_LOGS_QUERY_KEY, id, 'items', params ?? {}],
    queryFn: () =>
      fetchJson<{ items: ErpSyncLogItem[]; count: number }>(
        `${BASE_URL}/sync-logs/${id}/items?${qs.toString()}`
      ),
    enabled: Boolean(id) && (opts?.enabled ?? true),
    refetchInterval: opts?.refetchInterval,
  });
}

// ─── Outbox ───────────────────────────────────────────────────────────────────

export function useErpOutboxEvents(
  params?: { status?: string; aggregate_id?: string; limit?: number; offset?: number },
  opts?: QueryOpts
) {
  const qs = new URLSearchParams();
  if (params?.status) qs.set('status', params.status);
  if (params?.aggregate_id) qs.set('aggregate_id', params.aggregate_id);
  if (params?.limit != null) qs.set('limit', String(params.limit));
  if (params?.offset != null) qs.set('offset', String(params.offset));
  return useQuery({
    queryKey: [...ERP_OUTBOX_QUERY_KEY, params ?? {}],
    queryFn: () =>
      fetchJson<{ outbox_events: ErpOutboxEvent[]; count: number; counts: ErpOutboxCounts }>(
        `${BASE_URL}/outbox-events?${qs.toString()}`
      ),
    ...opts,
  });
}

export function useRetryOutboxEvent(callbacks?: {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ outbox_event: ErpOutboxEvent }>(`${BASE_URL}/outbox-events/${id}/retry`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ERP_OUTBOX_QUERY_KEY });
      callbacks?.onSuccess?.();
    },
    onError: (error: Error) => callbacks?.onError?.(error),
  });
}

// ─── Stock locations (API nativa, para el select de la config) ───────────────

export function useStockLocationOptions() {
  return useQuery({
    queryKey: ['erp', 'stock-locations'],
    queryFn: () =>
      fetchJson<{ stock_locations: StockLocationOption[] }>(
        '/admin/stock-locations?limit=100&fields=id,name'
      ),
  });
}
