/**
 * Hooks del admin de Correo Argentino.
 *
 * Espeja `andreani.tsx`, con tres diferencias que vienen del contrato de Correo:
 *
 *  1. **`POST /labels` es bulk nativo**: la descarga masiva es UNA llamada, no N.
 *  2. **Las fallas parciales llegan con HTTP 200** y `result: "ERROR: ..."` por
 *     ítem, así que todo lo que toca rótulos devuelve el estado POR ÍTEM y nunca
 *     un booleano global (`fetchCorreoLabelBatch`).
 *  3. **La detección de "esta orden es de Correo" es estructurada**, no un regex
 *     laxo sobre el nombre (ver `isCorreoShippingMethodLike` en `lib/correo.ts`).
 *
 * Todo lo binario (PDF, ZIP) usa `fetch` nativo con `credentials: 'include'`: el
 * `sdk.client.fetch` parsea JSON y las URLs de rótulo necesitan la sesión del
 * admin para que el backend adjunte la API-Key de Correo.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sdk } from '../../lib/client';
import {
  base64ToBytes,
  isCorreoShippingMethodLike,
  summarizeCorreoLabels,
  CORREO_MISSING_LABEL_MESSAGE,
  type CorreoLabelOutcome,
  type CorreoLabelSummary,
} from '../../lib/correo';

// ─── Tipos ────────────────────────────────────────────────────────────────────

/**
 * Envío de Correo normalizado por el backend.
 * Espeja `NormalizedCorreoFulfillment` de
 * `src/modules/correo-argentino-fulfillment/utils/list-fulfillments.ts`.
 */
export type CorreoFulfillmentItem = {
  id: string;
  order_id: string | null;
  order_display_id: string | null;
  /** Vacío hasta que el workflow de tickets crea el envío en Correo. */
  tracking_number: string;
  delivery_type: string;
  service_type: string;
  agency_id: string;
  agreement: string;
  label_url: string;
  status: string;
  created_at: string;
};

export type CorreoFulfillmentsResponse = {
  fulfillments: CorreoFulfillmentItem[];
  count: number;
  total: number;
  /** Cuántos del conjunto filtrado esperan que alguien genere el rótulo. */
  pending_ticket: number;
  limit: number;
  offset: number;
};

export type CorreoFulfillmentsParams = {
  search?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
  ticketed_only?: boolean;
  limit?: number;
  offset?: number;
};

export type CorreoBulkLabelFilters = {
  search?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
};

/** Bucket del normalizador de tracking (`normalizers/tracking-status.ts`). */
export type CorreoTrackingBucket =
  | 'pre_shipment'
  | 'admitted'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'returned'
  | 'canceled'
  | 'failed'
  | 'unknown';

export type CorreoTrackingEvent = {
  bucket: CorreoTrackingBucket;
  status: string | null;
  code: string | null;
  raw_status_id: string | null;
  raw_status: string | null;
  occurred_at: string | null;
  facility: string | null;
  facility_code: string | null;
  sign: string | null;
};

/**
 * Respuesta de `GET /admin/correo-argentino/tracking/:tn`.
 *
 * `has_history: false` NO es un error: significa que el envío existe pero Correo
 * todavía no registró movimientos. `unmapped_events` son los códigos que el
 * normalizador no supo mapear — la tabla de `statusId` de Correo no está
 * publicada y este campo es cómo se cosecha.
 */
export type CorreoTrackingResponse = {
  tracking_number: string;
  has_history: boolean;
  status: string | null;
  product_type: string | null;
  latest: CorreoTrackingEvent | null;
  events: CorreoTrackingEvent[];
  unmapped_events: Array<{
    raw_status_id: string | null;
    raw_status: string | null;
    occurred_at: string | null;
  }>;
  raw: unknown;
  last_updated: string;
};

/** Bulto declarado. Espeja `CorreoTicketParcel` del workflow. */
export type CorreoTicketParcel = {
  height: number;
  width: number;
  depth: number;
  product_weight_g: number;
  volumetric_weight_g: number;
  /** max(real, volumétrico): el que Correo factura. */
  billed_weight_g: number;
  declared_value: number;
  item_count: number;
};

/**
 * Ticket tal como queda en `order.metadata.correo_tickets[]`.
 * Espeja `CorreoTicketMetadataEntry` de `src/workflows/correo-generate-tickets.ts`.
 */
export type CorreoTicket = {
  generated_at: string;
  tracking_number: string;
  tracking_url: string;
  seller_id: string;
  agreement: string;
  service_type: string;
  delivery_type: string;
  agency_id?: string;
  parcel: CorreoTicketParcel;
  self_generated_tracking_number: boolean;
  sequence: number;
  /** `true` = el alta adoptó un envío que ya existía en Correo (TN duplicado). */
  recovered_from_duplicate?: boolean;
};

/** Respuesta de `POST /admin/correo-argentino/orders/:id/tickets`. */
export type CorreoGenerateTicketResponse = {
  order_id: string;
  display_id: number;
  ticket: CorreoTicket;
  /** `false` = idempotencia: no se creó nada, el ticket es el que ya existía. */
  created: boolean;
  total_tickets: number;
};

/** Summary de `POST /admin/correo-argentino/tickets/bulk` con `Accept: application/json`. */
export type CorreoBulkTicketsSummary = {
  generated_at: string;
  requested: number;
  processed: number;
  truncated: boolean;
  cap: number;
  force: boolean;
  succeeded_count: number;
  failed_count: number;
  succeeded: Array<{
    order_id: string;
    display_id: number | null;
    tracking_number: string;
    created: boolean;
  }>;
  failed: Array<{ order_id: string; code: string; error: string }>;
};

/** Rótulo listo para abrir/descargar en el browser. */
export type CorreoLabelFile = {
  tracking_number: string;
  ok: boolean;
  file_name: string;
  error: string | null;
  bytes: Uint8Array | null;
};

export type CorreoLabelBatch = {
  files: CorreoLabelFile[];
  summary: CorreoLabelSummary;
  /** Cuántos TNs distintos se pidieron antes del cap del backend. */
  requested: number;
  /** `true` = el backend cortó por el cap de 200. */
  truncated: boolean;
};

// ─── Query keys ───────────────────────────────────────────────────────────────

export const CORREO_FULFILLMENTS_KEY = (params: CorreoFulfillmentsParams) =>
  ['correo-fulfillments', params] as const;

export const CORREO_ORDER_FULFILLMENTS_KEY = (orderId: string) =>
  ['correo-order-fulfillments', orderId] as const;

export const CORREO_ORDER_TICKETS_KEY = (orderId: string) =>
  ['correo-order-tickets', orderId] as const;

export const CORREO_ORDER_IS_CORREO_KEY = (orderId: string) =>
  ['correo-order-is-correo', orderId] as const;

export const CORREO_TRACKING_KEY = (trackingNumber: string) =>
  ['correo-tracking', trackingNumber] as const;

export const CORREO_PROVIDER_STATUS_KEY = ['correo-provider-status'] as const;

export const CORREO_SHIPPING_OPTIONS_KEY = ['correo-shipping-options'] as const;

// ─── Listado global ───────────────────────────────────────────────────────────

/** Lista global de envíos de Correo (route `/correo-argentino/envios`). */
export function useCorreoFulfillments(params: CorreoFulfillmentsParams = {}) {
  const {
    search,
    status,
    date_from,
    date_to,
    ticketed_only,
    limit = 20,
    offset = 0,
  } = params;

  return useQuery({
    queryKey: CORREO_FULFILLMENTS_KEY(params),
    queryFn: () => {
      const query: Record<string, string | number> = { limit, offset };
      if (search) query.search = search;
      if (status) query.status = status;
      if (date_from) query.date_from = date_from;
      if (date_to) query.date_to = date_to;
      // Solo se manda cuando es `true`: el backend trata "ausente" y "false"
      // igual (mostrame todo) y mandar `false` explícito no aporta nada.
      if (ticketed_only) query.ticketed_only = 'true';
      return sdk.client.fetch<CorreoFulfillmentsResponse>(
        '/admin/correo-argentino/fulfillments',
        { method: 'GET', query }
      );
    },
  });
}

// ─── Tracking ─────────────────────────────────────────────────────────────────

/**
 * Seguimiento de un envío. `staleTime` 30 s y SIN refetch automático: cada
 * lookup pega contra `GET /tracking` de Correo, así que lo dispara el operador
 * abriendo el modal, no un intervalo.
 */
export function useCorreoTracking(trackingNumber: string | null) {
  return useQuery({
    queryKey: CORREO_TRACKING_KEY(trackingNumber ?? ''),
    enabled: !!trackingNumber,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    queryFn: () =>
      sdk.client.fetch<CorreoTrackingResponse>(
        `/admin/correo-argentino/tracking/${encodeURIComponent(trackingNumber ?? '')}`,
        { method: 'GET' }
      ),
  });
}

// ─── Orden individual ─────────────────────────────────────────────────────────

type RawCorreoFulfillmentData = {
  tracking_number?: string | null;
  carrier?: string;
  provider?: string;
  delivery_type?: string;
  service_type?: string;
  agency_id?: string | null;
  agreement?: string;
  label_url?: string;
};

type RawOrderFulfillment = {
  id: string;
  provider_id?: string;
  data?: RawCorreoFulfillmentData | null;
  status?: string;
  created_at?: string;
};

function normalizeOrderFulfillment(
  f: RawOrderFulfillment,
  orderId: string,
  displayId?: number
): CorreoFulfillmentItem {
  const data = f.data ?? {};
  return {
    id: f.id,
    order_id: orderId,
    order_display_id: displayId != null ? `#${displayId}` : null,
    tracking_number: data.tracking_number ?? '',
    delivery_type: data.delivery_type ?? '',
    service_type: data.service_type ?? '',
    agency_id: data.agency_id ?? '',
    agreement: data.agreement ?? '',
    label_url: data.label_url ?? '',
    status: f.status ?? 'pending',
    created_at: f.created_at ?? new Date().toISOString(),
  };
}

/**
 * Envíos de Correo de UNA orden (para el widget de order detail).
 *
 * Hace su propio fetch de la orden nativa en vez de confiar en el prop del
 * widget: Medusa no garantiza los `fulfillments` hidratados en
 * `DetailWidgetProps.data` (ver el comentario de `order-andreani-widget.tsx`).
 *
 * El filtro es ESTRICTO (`provider_id` o `data.carrier`), no "cualquier
 * fulfillment con tracking_number": con dos carriers, ese criterio laxo haría que
 * el widget de Correo mostrara los envíos de Andreani.
 */
export function useOrderCorreoFulfillments(orderId: string | null) {
  return useQuery({
    queryKey: CORREO_ORDER_FULFILLMENTS_KEY(orderId ?? ''),
    enabled: !!orderId,
    queryFn: async () => {
      const { order } = await sdk.client.fetch<{
        order: {
          id: string;
          display_id?: number;
          fulfillments?: RawOrderFulfillment[];
        };
      }>(`/admin/orders/${orderId}`, {
        method: 'GET',
        query: {
          fields:
            'id,display_id,fulfillments.id,fulfillments.provider_id,fulfillments.data,fulfillments.status,fulfillments.created_at',
        },
      });

      return (order.fulfillments ?? [])
        .filter(
          (f) =>
            f.provider_id?.toLowerCase().includes('correo_argentino') ||
            f.data?.carrier?.toLowerCase() === 'correo_argentino'
        )
        .map((f) => normalizeOrderFulfillment(f, order.id, order.display_id));
    },
  });
}

/** Tickets guardados en `order.metadata.correo_tickets`. */
export function useOrderCorreoTickets(orderId: string | null) {
  return useQuery({
    queryKey: CORREO_ORDER_TICKETS_KEY(orderId ?? ''),
    enabled: !!orderId,
    queryFn: async () => {
      const { order } = await sdk.client.fetch<{
        order: { id: string; metadata?: { correo_tickets?: CorreoTicket[] } };
      }>(`/admin/orders/${orderId}`, {
        method: 'GET',
        query: { fields: 'id,metadata' },
      });
      const tickets = order.metadata?.correo_tickets;
      return Array.isArray(tickets) ? tickets : [];
    },
  });
}

/**
 * ¿La orden tiene un método de envío de Correo? (para mostrar "Generar envío"
 * cuando todavía no hay ningún ticket).
 *
 * Usa la señal ESTRUCTURADA de `isCorreoShippingMethodLike`, réplica de
 * `isCorreoShippingMethod()` del workflow. Deliberadamente NO se copia el regex
 * de Andreani (`/andreani|domicilio|sucursal|punto|hop/i`): esos términos son de
 * otros carriers y "correo" es una palabra corriente en castellano, así que el
 * match por nombre exige el token completo y va último.
 */
export function useOrderHasCorreoShipping(orderId: string | null) {
  return useQuery({
    queryKey: CORREO_ORDER_IS_CORREO_KEY(orderId ?? ''),
    enabled: !!orderId,
    staleTime: 60_000,
    queryFn: async () => {
      const { order } = await sdk.client.fetch<{
        order: {
          id: string;
          shipping_methods?: Array<{
            name?: string;
            data?: Record<string, unknown> | null;
          }>;
        };
      }>(`/admin/orders/${orderId}`, {
        method: 'GET',
        query: {
          fields: 'id,shipping_methods.name,shipping_methods.data',
        },
      });

      return (order.shipping_methods ?? []).some(isCorreoShippingMethodLike);
    },
  });
}

// ─── Rótulos ──────────────────────────────────────────────────────────────────

function fileNameFromDisposition(
  header: string | null,
  fallback: string
): string {
  if (!header) return fallback;
  const match = /filename="?([^";]+)"?/i.exec(header);
  return match?.[1]?.trim() || fallback;
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: { message?: string } } | null;
    return body?.error?.message || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

/**
 * Baja rótulos de Correo y devuelve el estado POR ÍTEM.
 *
 * ⚠️ Dos formas de respuesta, las dos manejadas acá porque la ruta las decide por
 * cantidad:
 *   - 1 TN  → `application/pdf` directo (atajo de la ruta para abrir/imprimir)
 *   - 2+ TN → JSON con `labels[]`, cada uno con su `ok` / `error`
 *
 * Y ⚠️ las fallas parciales de Correo llegan con **HTTP 200**: `res.ok` NO
 * significa "salieron todos". El único resumen honesto es el que sale de
 * `summarizeCorreoLabels`.
 *
 * Cuando la llamada entera falla (503, red), TODOS los TNs se devuelven como
 * fallidos con el mismo motivo, en vez de una lista vacía: así el operador ve
 * cuáles quedaron sin rótulo y por qué.
 */
export async function fetchCorreoLabelBatch(
  trackingNumbers: string[],
  labelFormat?: string
): Promise<CorreoLabelBatch> {
  const unique = Array.from(
    new Set(trackingNumbers.map((tn) => tn.trim()).filter(Boolean))
  );

  if (unique.length === 0) {
    return {
      files: [],
      summary: summarizeCorreoLabels([]),
      requested: 0,
      truncated: false,
    };
  }

  const allFailed = (message: string): CorreoLabelBatch => {
    const failures = unique.map((tn) => ({
      tracking_number: tn,
      ok: false,
      error: message,
    }));
    return {
      files: failures.map((f) => ({
        ...f,
        file_name: `correo-${f.tracking_number}.pdf`,
        bytes: null,
      })),
      summary: summarizeCorreoLabels(failures),
      requested: unique.length,
      truncated: false,
    };
  };

  let res: Response;
  try {
    res = await fetch('/admin/correo-argentino/labels', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tracking_numbers: unique,
        ...(labelFormat ? { label_format: labelFormat } : {}),
      }),
    });
  } catch (error) {
    return allFailed((error as Error).message);
  }

  if (!res.ok) {
    return allFailed(await readErrorMessage(res));
  }

  const contentType = res.headers.get('content-type') ?? '';

  // Atajo de un solo rótulo: PDF directo, sin base64.
  if (contentType.includes('application/pdf')) {
    const trackingNumber = unique[0] ?? '';
    const bytes = new Uint8Array(await res.arrayBuffer());
    const file: CorreoLabelFile = {
      tracking_number: trackingNumber,
      ok: bytes.length > 0,
      file_name: fileNameFromDisposition(
        res.headers.get('content-disposition'),
        `correo-${trackingNumber}.pdf`
      ),
      // Un 200 `application/pdf` con cuerpo vacío es la falla más traicionera:
      // "salió bien" y el archivo no existe. Se reporta como falla explícita.
      error: bytes.length > 0 ? null : CORREO_MISSING_LABEL_MESSAGE,
      bytes: bytes.length > 0 ? bytes : null,
    };
    return {
      files: [file],
      summary: summarizeCorreoLabels([
        { tracking_number: trackingNumber, ok: file.ok, error: null, bytes },
      ]),
      requested: 1,
      truncated: false,
    };
  }

  const body = (await res.json()) as {
    labels?: CorreoLabelOutcome[];
    requested?: number;
    truncated?: boolean;
  };
  const labels = Array.isArray(body.labels) ? body.labels : [];

  return {
    files: labels.map((label) => {
      const bytes = label.base64 ? base64ToBytes(label.base64) : null;
      return {
        tracking_number: label.tracking_number,
        ok: label.ok && (bytes?.length ?? 0) > 0,
        file_name: label.file_name || `correo-${label.tracking_number}.pdf`,
        error: label.error,
        bytes: bytes && bytes.length > 0 ? bytes : null,
      };
    }),
    summary: summarizeCorreoLabels(labels),
    requested: body.requested ?? unique.length,
    truncated: body.truncated === true,
  };
}

/** Abre un rótulo (bytes → blob → pestaña nueva). */
export function openCorreoLabel(file: CorreoLabelFile): void {
  if (!file.bytes || file.bytes.length === 0) return;
  const blob = new Blob([file.bytes as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  // 60 s alcanza para que el visor del browser lo tome; después se libera.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Descarga un rótulo al disco con su nombre de archivo. */
export function downloadCorreoLabel(file: CorreoLabelFile): void {
  if (!file.bytes || file.bytes.length === 0) return;
  const blob = new Blob([file.bytes as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.file_name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Pide rótulos para N tracking numbers en UNA llamada (`/labels` es bulk nativo).
 * Devuelve el detalle por ítem — la UI muestra CUÁLES fallaron, no un total.
 */
export function useCorreoLabelBatch() {
  return useMutation({
    mutationFn: (input: { tracking_numbers: string[]; label_format?: string }) =>
      fetchCorreoLabelBatch(input.tracking_numbers, input.label_format),
  });
}

/**
 * Descarga masiva SOLO-DESCARGA: ZIP con los rótulos de los envíos que YA
 * existen y matchean los filtros. NO crea envíos.
 *
 * El detalle por ítem viaja en el `summary.json` de adentro del ZIP (el backend
 * lo arma así), y las cabeceras dicen si se truncó por el cap.
 */
export function useCorreoBulkDownloadLabels() {
  return useMutation({
    mutationFn: async (filters: CorreoBulkLabelFilters) => {
      const res = await fetch('/admin/correo-argentino/labels/bulk', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filters),
      });
      if (!res.ok) {
        throw new Error(await readErrorMessage(res));
      }

      const truncated = res.headers.get('X-Correo-Truncated') === 'true';
      const totalMatched = Number(
        res.headers.get('X-Correo-Total-Matched') ?? '0'
      );

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `correo-labels-${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      return { truncated, totalMatched };
    },
  });
}

// ─── Generación de envíos ─────────────────────────────────────────────────────

/**
 * Crea el envío de UNA orden en Correo.
 *
 * Idempotente por default: si la orden ya tiene ticket, el workflow devuelve el
 * existente con `created: false`. `force: true` crea uno NUEVO y facturable, así
 * que va explícito.
 */
export function useGenerateCorreoTicket(orderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input?: { force?: boolean }) =>
      sdk.client.fetch<CorreoGenerateTicketResponse>(
        `/admin/correo-argentino/orders/${orderId}/tickets`,
        { method: 'POST', body: input?.force ? { force: true } : {} }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: CORREO_ORDER_TICKETS_KEY(orderId),
      });
      queryClient.invalidateQueries({
        queryKey: CORREO_ORDER_FULFILLMENTS_KEY(orderId),
      });
      // El listado global también cambia (aparece el tracking number).
      queryClient.invalidateQueries({ queryKey: ['correo-fulfillments'] });
    },
  });
}

/**
 * Generación masiva de envíos.
 *
 * Pide `Accept: application/json` A PROPÓSITO: el default de la ruta es un ZIP
 * con los rótulos, pero entonces el resultado POR ORDEN queda enterrado en el
 * `summary.json` de adentro del ZIP. Con JSON la UI puede mostrar exactamente
 * qué órdenes salieron y qué órdenes fallaron, con su código de error. Los
 * rótulos se bajan después, en una segunda llamada, con los TNs que salieron.
 */
export function useCorreoBulkGenerateTickets() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { order_ids: string[]; force?: boolean }) => {
      const res = await fetch('/admin/correo-argentino/tickets/bulk', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          order_ids: input.order_ids,
          ...(input.force ? { force: true } : {}),
        }),
      });
      if (!res.ok) {
        throw new Error(await readErrorMessage(res));
      }
      return (await res.json()) as CorreoBulkTicketsSummary;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['correo-fulfillments'] });
    },
  });
}

// ─── Estado de configuración ──────────────────────────────────────────────────

/**
 * ¿Está registrado el provider de Correo?
 *
 * Es un proxy REAL de la env var de registro: `medusa-config.ts` solo registra el
 * módulo cuando `CORREO_ARGENTINO_API_KEY` está presente, así que si el provider
 * aparece en `/admin/fulfillment-providers`, la API-Key está configurada. Si no
 * aparece, no lo está (o la extensión no está instalada).
 *
 * No hay endpoint admin que liste las env vars de Correo, así que esto es lo
 * único que se puede afirmar sin inventar.
 */
export function useCorreoProviderStatus() {
  return useQuery({
    queryKey: CORREO_PROVIDER_STATUS_KEY,
    staleTime: 60_000,
    queryFn: async () => {
      const { fulfillment_providers } = await sdk.client.fetch<{
        fulfillment_providers: Array<{ id: string; is_enabled?: boolean }>;
      }>('/admin/fulfillment-providers', {
        method: 'GET',
        query: { limit: 100 },
      });

      const provider = (fulfillment_providers ?? []).find((p) =>
        p.id?.toLowerCase().includes('correo_argentino')
      );

      return {
        registered: !!provider,
        provider_id: provider?.id ?? null,
        is_enabled: provider?.is_enabled ?? false,
      };
    },
  });
}

// ─── Health check ─────────────────────────────────────────────────────────────

/**
 * De qué capa sale el valor efectivo. Espeja `CorreoSettingSource` del backend.
 *
 * `credential` es `site_credential` — la pantalla de credenciales por tienda—, que
 * pisa a todo lo demás. `off` es el fail-closed de una tienda secundaria que no
 * declaró lo suyo: NO es lo mismo que `unset`, y por eso son dos.
 */
export type CorreoSettingSource =
  | 'site'
  | 'global'
  | 'credential'
  | 'env'
  | 'default'
  | 'off'
  | 'unset';

/** Espeja `CorreoSettingStatus` de `api/admin/correo-argentino/health/_env-report.ts`. */
export type CorreoSettingStatus = {
  /** El NOMBRE de la clave. El backend nunca devuelve el valor. */
  name: string;
  source: CorreoSettingSource;
  /**
   * ¿Hay valor efectivo? Reemplazó al viejo `present`, que medía si existía la env
   * var — una pregunta que dejó de tener relación con la verdad desde que la
   * configuración vive en la base.
   */
  configured: boolean;
  /** ¿El normalizador del módulo lo acepta? Ver `correoEnvVarState`. */
  usable: boolean;
  requirement:
    | 'requerida'
    | 'requerida_para_cotizar'
    | 'requerida_para_operar'
    | 'opcional';
  group: string;
};

export type CorreoHealthStatusValue =
  | 'no_probado'
  | 'sin_credenciales'
  | 'ok'
  | 'credenciales_invalidas'
  | 'gateway_inalcanzable'
  | 'error_desconocido'
  | 'cuenta_no_activada'
  | 'sin_tarifas';

export type CorreoProbeOutcome = {
  status: CorreoHealthStatusValue;
  http_status: number | null;
  message: string | null;
  /** `true` = reintentar la sonda puede dar otro resultado. */
  retryable: boolean;
};

/** Clasificador de ambiente. Nunca el hostname configurado. */
export type CorreoTargetValue = 'test' | 'prod' | 'custom';

/** Respuesta de `GET /admin/correo-argentino/health`. */
export type CorreoHealthResponse = {
  checked_at: string;
  probe_requested: boolean;
  /** La capa que se está mirando. `null` = la configuración de la instancia. */
  site_id: string | null;
  /**
   * El bloque se llama `config` y ya no `env` porque dejó de reportar variables de
   * entorno: reporta el ESTADO EFECTIVO de cada clave y de qué capa sale.
   */
  config: {
    settings: CorreoSettingStatus[];
    missing_required: string[];
    missing_quoting: string[];
    missing_operating: string[];
    paqar_ready: boolean;
    micorreo_ready: boolean;
    /**
     * Target de **paqar**. `custom` = el host configurado no es ninguno de los dos
     * conocidos (su valor no se expone).
     */
    target: CorreoTargetValue;
    /**
     * Target por API: MiCorreo puede apuntar a otro host que paqar
     * (`CORREO_ARGENTINO_MICORREO_HOSTNAME`).
     */
    targets: { paqar: CorreoTargetValue; micorreo: CorreoTargetValue };
  };
  /**
   * La tienda tiene credenciales propias y su blob no se puede descifrar (rotó la
   * clave de cifrado). El resto del reporte está incompleto a sabiendas.
   */
  credentials_unreadable: boolean;
  paqar: CorreoProbeOutcome;
  micorreo: CorreoProbeOutcome & {
    probe_destination_postal_code: string;
    probe_used_configured_origin: boolean;
  };
};

export const CORREO_HEALTH_KEY = ['correo-health'] as const;
export const CORREO_HEALTH_PROBE_KEY = ['correo-health', 'probe'] as const;

/**
 * Estado de configuración de Correo para la tienda activa. **SIN** `?probe=true`,
 * así que esta llamada NO sale a la red contra Correo: el backend sólo resuelve la
 * precedencia de sus propias claves, y por eso puede correr al montar.
 */
export function useCorreoEnvStatus() {
  return useQuery({
    queryKey: CORREO_HEALTH_KEY,
    staleTime: 60_000,
    queryFn: () =>
      sdk.client.fetch<CorreoHealthResponse>(
        '/admin/correo-argentino/health',
        { method: 'GET' }
      ),
  });
}

/**
 * Sonda real contra las dos APIs de Correo (`?probe=true`).
 *
 * ⚠️ **`enabled: false` a propósito: esto NO corre al montar.** Cada ejecución
 * pega contra el gateway de Correo (un `GET /auth` de paqar + un `POST /token` y
 * un `POST /rates` de MiCorreo), y la página de configuración se monta cada vez
 * que alguien navega ahí. La dispara una persona con el botón, vía `refetch()`.
 *
 * `retry: false` por lo mismo: un reintento automático de react-query
 * multiplicaría las llamadas al carrier justo cuando algo ya está fallando.
 */
export function useCorreoConnectionProbe() {
  return useQuery({
    queryKey: CORREO_HEALTH_PROBE_KEY,
    enabled: false,
    retry: false,
    gcTime: 0,
    queryFn: () =>
      sdk.client.fetch<CorreoHealthResponse>('/admin/correo-argentino/health', {
        method: 'GET',
        query: { probe: 'true' },
      }),
  });
}

export type CorreoShippingOption = {
  id: string;
  name: string;
  price_type: string;
  provider_id: string;
  data: Record<string, unknown> | null;
  service_zone?: { id: string; name?: string } | null;
};

/**
 * Opciones de envío sembradas para Correo.
 *
 * Se filtra por `provider_id` en el server y además por `data.id` en cliente: si
 * el seed corrió mal y la opción quedó sin `data.id`, verla en la lista con el
 * dato faltante es más útil que no verla.
 */
export function useCorreoShippingOptions() {
  return useQuery({
    queryKey: CORREO_SHIPPING_OPTIONS_KEY,
    staleTime: 60_000,
    queryFn: async () => {
      const { shipping_options } = await sdk.client.fetch<{
        shipping_options: CorreoShippingOption[];
      }>('/admin/shipping-options', {
        method: 'GET',
        // SIN `fields` a propósito: los defaults de la ruta admin
        // (`defaultAdminShippingOptionFields`) ya traen `data`, `provider_id` y
        // `*service_zone`, que es todo lo que esta pantalla necesita. Un `fields`
        // a mano acá solo agrega una forma de romperse si cambia el shape.
        query: { limit: 100 },
      });

      return (shipping_options ?? []).filter((option) =>
        isCorreoShippingMethodLike({
          provider_id: option.provider_id,
          name: option.name,
          data: option.data,
        })
      );
    },
  });
}
