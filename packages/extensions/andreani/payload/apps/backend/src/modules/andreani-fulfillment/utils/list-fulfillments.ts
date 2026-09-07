/**
 * Helper compartido para listar/filtrar fulfillments Andreani.
 *
 * Centraliza la detección de fulfillments Andreani, la normalización y el
 * filtrado en memoria (search, status, rango de fechas) para que tanto el
 * endpoint de lista (GET /admin/andreani/fulfillments) como el de descarga
 * masiva (POST /admin/andreani/labels/bulk) compartan EXACTAMENTE la misma
 * lógica y no haya drift entre lo que se ve en la tabla y lo que se descarga.
 *
 * IMPORTANTE: NO genera envíos ni corre workflows. Solo lee fulfillments
 * nativos de Medusa vía el Query module.
 */

export interface FulfillmentDataField {
  tracking_number?: string;
  service_type?: string;
  contract?: string;
  label_url?: string;
  created_at?: string;
  fulfillment_id?: string;
  /**
   * Identidad del carrier, estampada por `validateFulfillmentData()`. Andreani
   * NO la escribe (es anterior al registry de carriers); Correo Argentino sí.
   * Se lee acá solo para descartar fulfillments de otros carriers.
   */
  carrier?: string;
}

export interface FulfillmentRecord {
  id: string;
  provider_id?: string;
  data?: FulfillmentDataField | null;
  status?: string;
  created_at?: string;
  updated_at?: string;
  order?: {
    id: string;
    display_id?: number;
      sales_channel_id?: string | null;
  } | null;
  order_id?: string;
}

export interface NormalizedFulfillment {
  id: string;
  order_id: string | null;
  order_display_id: string | null;
  tracking_number: string;
  service_type: string;
  contract: string;
  label_url: string;
  status: string;
  created_at: string;
  /** El canal de la ORDEN. El fulfillment no tiene uno propio. */
  sales_channel_id: string | null;
}

export interface AndreaniFulfillmentFilters {
  search?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
  /**
   * Canales de la tienda activa. `undefined` = sin filtrar (comportamiento de antes).
   *
   * El fulfillment no tiene canal propio: lo hereda de su orden. Por eso el filtro
   * llega como lista de canales y no como `site_id` — es lo que la orden guarda.
   */
  site_channel_ids?: string[];
}

/**
 * Tipo mínimo del Query module que necesitamos (evita acoplar a tipos internos).
 */
type QueryGraph = {
  graph: (args: {
    entity: string;
    fields: string[];
  }) => Promise<{ data: unknown[] }>;
};

export function isAndreaniFulfillment(f: FulfillmentRecord): boolean {
  // Criterio primario: provider_id contiene 'andreani'
  if (f.provider_id && f.provider_id.toLowerCase().includes('andreani')) {
    return true;
  }

  const data = f.data as FulfillmentDataField | null | undefined;

  // ⚠️ Guarda anti-contaminación entre carriers. El criterio secundario de acá
  // abajo ("cualquier fulfillment con tracking_number") era inofensivo mientras
  // Andreani era el único carrier; con Correo Argentino en el mismo sistema,
  // sin esta línea el listado y la descarga masiva de Andreani se llevarían
  // envíos de Correo por delante. Un `carrier` explícito y ajeno descalifica.
  if (data?.carrier && data.carrier !== 'andreani') {
    return false;
  }

  // Criterio secundario: data tiene tracking_number (lo que persiste createFulfillment)
  if (
    data &&
    typeof data.tracking_number === 'string' &&
    data.tracking_number.length > 0
  ) {
    return true;
  }
  return false;
}

export function normalizeFulfillment(
  f: FulfillmentRecord
): NormalizedFulfillment {
  const data = (f.data ?? {}) as FulfillmentDataField;
  return {
    id: f.id,
    order_id: f.order?.id ?? f.order_id ?? null,
    order_display_id: f.order?.display_id != null ? `#${f.order.display_id}` : null,
    tracking_number: data.tracking_number ?? '',
    service_type: data.service_type ?? '',
    contract: data.contract ?? '',
    label_url: data.label_url ?? '',
    status: f.status ?? 'pending',
    created_at: f.created_at ?? new Date().toISOString(),
    sales_channel_id: f.order?.sales_channel_id ?? null,
  };
}

/**
 * Devuelve el inicio del día (00:00:00.000) para una fecha YYYY-MM-DD.
 * Devuelve null si no parsea.
 */
function startOfDay(isoDate: string | undefined): number | null {
  const v = (isoDate ?? '').trim();
  if (!v) return null;
  const d = new Date(`${v.slice(0, 10)}T00:00:00.000`);
  const t = d.getTime();
  return Number.isNaN(t) ? null : t;
}

/**
 * Devuelve el fin del día (23:59:59.999) para una fecha YYYY-MM-DD.
 * Devuelve null si no parsea.
 */
function endOfDay(isoDate: string | undefined): number | null {
  const v = (isoDate ?? '').trim();
  if (!v) return null;
  const d = new Date(`${v.slice(0, 10)}T23:59:59.999`);
  const t = d.getTime();
  return Number.isNaN(t) ? null : t;
}

/**
 * Aplica los filtros (search, status, rango de fechas) sobre una lista ya
 * normalizada. No ordena ni pagina.
 */
export function applyAndreaniFilters(
  items: NormalizedFulfillment[],
  filters: AndreaniFulfillmentFilters
): NormalizedFulfillment[] {
  let result = items;

  // Primero la tienda: acota antes que cualquier filtro de texto, y sobre todo evita
  // que un `search` por tracking encuentre el envío de otra tienda.
  if (filters.site_channel_ids?.length) {
    const allowed = new Set(filters.site_channel_ids);
    result = result.filter((f) => !f.sales_channel_id || allowed.has(f.sales_channel_id));
  }

  const search = (filters.search ?? '').trim().toLowerCase();
  if (search) {
    result = result.filter(
      (f) =>
        f.tracking_number.toLowerCase().includes(search) ||
        (f.order_display_id &&
          f.order_display_id.toLowerCase().includes(search)) ||
        (f.order_id && f.order_id.toLowerCase().includes(search))
    );
  }

  const status = (filters.status ?? '').trim().toLowerCase();
  if (status) {
    result = result.filter((f) => f.status.toLowerCase() === status);
  }

  const fromTs = startOfDay(filters.date_from);
  if (fromTs != null) {
    result = result.filter((f) => {
      const t = new Date(f.created_at).getTime();
      return !Number.isNaN(t) && t >= fromTs;
    });
  }

  const toTs = endOfDay(filters.date_to);
  if (toTs != null) {
    result = result.filter((f) => {
      const t = new Date(f.created_at).getTime();
      return !Number.isNaN(t) && t <= toTs;
    });
  }

  return result;
}

/**
 * Lee todos los fulfillments Andreani vía el Query module, los normaliza,
 * aplica filtros y ordena por created_at desc. NO pagina (eso queda a cargo
 * del caller, que sabe si quiere una página o el conjunto completo).
 */
export async function listAndreaniFulfillments(
  query: QueryGraph,
  filters: AndreaniFulfillmentFilters = {}
): Promise<NormalizedFulfillment[]> {
  const { data: fulfillments } = await query.graph({
    entity: 'fulfillment',
    fields: [
      'id',
      'provider_id',
      'data',
      'status',
      'created_at',
      'updated_at',
      'order_id',
      'order.id',
      'order.display_id',
      // La tienda del envío: el fulfillment no la tiene, la orden sí.
      'order.sales_channel_id',
    ],
  });

  const normalized = (fulfillments as FulfillmentRecord[])
    .filter(isAndreaniFulfillment)
    .map(normalizeFulfillment);

  const filtered = applyAndreaniFilters(normalized, filters);

  filtered.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return filtered;
}
