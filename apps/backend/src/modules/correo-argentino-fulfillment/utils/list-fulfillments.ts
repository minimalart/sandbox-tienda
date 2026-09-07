/**
 * Helper compartido para listar/filtrar fulfillments de Correo Argentino.
 *
 * Mismo rol que `andreani-fulfillment/utils/list-fulfillments.ts`: centraliza la
 * detección, la normalización y el filtrado en memoria para que el listado del
 * admin y la descarga masiva de rótulos usen EXACTAMENTE el mismo criterio y no
 * haya drift entre lo que se ve en la tabla y lo que se descarga.
 *
 * NO genera envíos ni corre workflows: solo lee fulfillments nativos de Medusa.
 *
 * ⚠️ La detección es ESTRICTA (`provider_id` o `data.carrier`), a diferencia de
 * la de Andreani, que además acepta "cualquier fulfillment con
 * `data.tracking_number`". Ese criterio laxo era inofensivo mientras Andreani
 * era el único carrier; con dos, copiarlo haría que cada helper se robara los
 * envíos del otro.
 */

import { CORREO_CARRIER_ID } from '../service';

export interface CorreoFulfillmentDataField {
  tracking_number?: string | null;
  carrier?: string;
  provider?: string;
  delivery_type?: string;
  service_type?: string;
  agency_id?: string | null;
  agreement?: string;
  label_url?: string;
  status?: string;
  created_at?: string;
  fulfillment_id?: string | null;
}

export interface CorreoFulfillmentRecord {
  id: string;
  provider_id?: string;
  data?: CorreoFulfillmentDataField | null;
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

export interface NormalizedCorreoFulfillment {
  id: string;
  order_id: string | null;
  order_display_id: string | null;
  /** Vacío hasta que el workflow de tickets crea el envío. */
  tracking_number: string;
  delivery_type: string;
  service_type: string;
  agency_id: string;
  agreement: string;
  label_url: string;
  status: string;
  created_at: string;
  /** El canal de la ORDEN. El fulfillment no tiene uno propio. */
  sales_channel_id: string | null;
}

export interface CorreoFulfillmentFilters {
  search?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
  /** `true` → solo los que ya tienen envío creado en Correo. */
  ticketed_only?: boolean;
  /**
   * Canales de la tienda activa. `undefined` = sin filtrar (comportamiento de antes).
   *
   * El fulfillment no tiene canal propio: lo hereda de su orden. Por eso el filtro
   * llega como lista de canales y no como `site_id`.
   */
  site_channel_ids?: string[];
}

/** Tipo mínimo del Query module (evita acoplar a tipos internos de Medusa). */
type QueryGraph = {
  graph: (args: {
    entity: string;
    fields: string[];
  }) => Promise<{ data: unknown[] }>;
};

export function isCorreoFulfillment(f: CorreoFulfillmentRecord): boolean {
  if (f.provider_id?.toLowerCase().includes('correo_argentino')) {
    return true;
  }
  // `carrier` lo estampa `validateFulfillmentData()` y sobrevive en
  // `fulfillment.data`: es la identidad explícita, no una inferencia.
  return f.data?.carrier === CORREO_CARRIER_ID;
}

export function normalizeCorreoFulfillment(
  f: CorreoFulfillmentRecord
): NormalizedCorreoFulfillment {
  const data = f.data ?? {};
  return {
    id: f.id,
    order_id: f.order?.id ?? f.order_id ?? null,
    order_display_id:
      f.order?.display_id != null ? `#${f.order.display_id}` : null,
    // `null` es el estado normal antes de generar el ticket (el provider NO
    // inventa placeholders `PENDING-*` como Andreani).
    tracking_number: data.tracking_number ?? '',
    delivery_type: data.delivery_type ?? '',
    service_type: data.service_type ?? '',
    agency_id: data.agency_id ?? '',
    agreement: data.agreement ?? '',
    label_url: data.label_url ?? '',
    status: f.status ?? 'pending',
    created_at: f.created_at ?? new Date().toISOString(),
    sales_channel_id: f.order?.sales_channel_id ?? null,
  };
}

function startOfDay(isoDate: string | undefined): number | null {
  const v = (isoDate ?? '').trim();
  if (!v) return null;
  const t = new Date(`${v.slice(0, 10)}T00:00:00.000`).getTime();
  return Number.isNaN(t) ? null : t;
}

function endOfDay(isoDate: string | undefined): number | null {
  const v = (isoDate ?? '').trim();
  if (!v) return null;
  const t = new Date(`${v.slice(0, 10)}T23:59:59.999`).getTime();
  return Number.isNaN(t) ? null : t;
}

export function applyCorreoFilters(
  items: NormalizedCorreoFulfillment[],
  filters: CorreoFulfillmentFilters
): NormalizedCorreoFulfillment[] {
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
        f.agency_id.toLowerCase().includes(search) ||
        (f.order_display_id?.toLowerCase().includes(search) ?? false) ||
        (f.order_id?.toLowerCase().includes(search) ?? false)
    );
  }

  const status = (filters.status ?? '').trim().toLowerCase();
  if (status) {
    result = result.filter((f) => f.status.toLowerCase() === status);
  }

  if (filters.ticketed_only) {
    result = result.filter((f) => f.tracking_number.length > 0);
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
 * Lee los fulfillments de Correo, normaliza, filtra y ordena por `created_at`
 * desc. NO pagina: eso queda a cargo del caller.
 */
export async function listCorreoFulfillments(
  query: QueryGraph,
  filters: CorreoFulfillmentFilters = {}
): Promise<NormalizedCorreoFulfillment[]> {
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

  const normalized = (fulfillments as CorreoFulfillmentRecord[])
    .filter(isCorreoFulfillment)
    .map(normalizeCorreoFulfillment);

  return applyCorreoFilters(normalized, filters).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}
