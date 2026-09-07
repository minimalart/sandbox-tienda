import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { sdk } from '../../lib/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AndreaniFulfillmentItem = {
  id: string;
  order_id: string | null;
  order_display_id: string | null;
  tracking_number: string;
  service_type: string;
  contract: string;
  label_url: string;
  status: string;
  created_at: string;
};

export type AndreaniFulfillmentsResponse = {
  fulfillments: AndreaniFulfillmentItem[];
  count: number;
  total: number;
  limit: number;
  offset: number;
};

export type TrackingEvent = {
  timestamp: string;
  status: string;
  description: string;
  location?: string;
};

export type AndreaniTrackingResponse = {
  tracking_number: string;
  current_status: string;
  current_status_description: string;
  estimated_delivery_date?: string;
  events: TrackingEvent[];
  shipment_info?: {
    origin: string;
    destination: string;
    service_type: string;
  };
  last_updated: string;
};

export type AndreaniFulfillmentsParams = {
  search?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
};

export type AndreaniBulkLabelFilters = {
  search?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
};

// ─── Query keys ───────────────────────────────────────────────────────────────

export const ANDREANI_FULFILLMENTS_KEY = (params: AndreaniFulfillmentsParams) =>
  ['andreani-fulfillments', params] as const;

export const ANDREANI_ORDER_FULFILLMENTS_KEY = (orderId: string) =>
  ['andreani-order-fulfillments', orderId] as const;

export const ANDREANI_TRACKING_KEY = (trackingNumber: string) =>
  ['andreani-tracking', trackingNumber] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

type RawFulfillmentData = {
  tracking_number?: string;
  service_type?: string;
  contract?: string;
  label_url?: string;
  created_at?: string;
};

type RawOrderFulfillment = {
  id: string;
  provider_id?: string;
  data?: RawFulfillmentData | null;
  status?: string;
  created_at?: string;
};

function isAndreani(f: RawOrderFulfillment): boolean {
  if (f.provider_id && f.provider_id.toLowerCase().includes('andreani')) return true;
  return !!f.data?.tracking_number;
}

function normalizeOrderFulfillment(
  f: RawOrderFulfillment,
  orderId: string,
  displayId?: number
): AndreaniFulfillmentItem {
  const data = (f.data ?? {}) as RawFulfillmentData;
  return {
    id: f.id,
    order_id: orderId,
    order_display_id: displayId != null ? `#${displayId}` : null,
    tracking_number: data.tracking_number ?? '',
    service_type: data.service_type ?? '',
    contract: data.contract ?? '',
    label_url: data.label_url ?? '',
    status: f.status ?? 'pending',
    created_at: f.created_at ?? new Date().toISOString(),
  };
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Lista global de envíos Andreani (para la route /andreani).
 * Consume el endpoint admin custom vía el SDK (auth de sesión).
 */
export function useAndreaniFulfillments(params: AndreaniFulfillmentsParams = {}) {
  const { search, status, date_from, date_to, limit = 20, offset = 0 } = params;

  return useQuery({
    queryKey: ANDREANI_FULFILLMENTS_KEY(params),
    queryFn: () => {
      const query: Record<string, string | number> = { limit, offset };
      if (search) query.search = search;
      if (status) query.status = status;
      if (date_from) query.date_from = date_from;
      if (date_to) query.date_to = date_to;
      return sdk.client.fetch<AndreaniFulfillmentsResponse>(
        '/admin/andreani/fulfillments',
        { method: 'GET', query }
      );
    },
  });
}

/**
 * Envíos Andreani de UNA orden específica (para el widget de order detail).
 * No depende del prop del widget: pide la orden nativa de Medusa con sus
 * fulfillments hidratados (incluido el campo `data`) y filtra Andreani en cliente.
 */
export function useOrderAndreaniFulfillments(orderId: string | null) {
  return useQuery({
    queryKey: ANDREANI_ORDER_FULFILLMENTS_KEY(orderId ?? ''),
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

      const raw = order.fulfillments ?? [];
      return raw
        .filter(isAndreani)
        .map((f) => normalizeOrderFulfillment(f, order.id, order.display_id));
    },
  });
}

export function useAndreaniTracking(trackingNumber: string | null) {
  return useQuery({
    queryKey: ANDREANI_TRACKING_KEY(trackingNumber ?? ''),
    queryFn: () =>
      sdk.client.fetch<AndreaniTrackingResponse>(
        `/admin/andreani/tracking/${trackingNumber}`,
        { method: 'GET' }
      ),
    enabled: !!trackingNumber,
    // No refetch automático — el usuario lo dispara con "Ver seguimiento"
    staleTime: 30_000,
  });
}

// ─── Tickets on-demand ──────────────────────────────────────────────────────

export type AndreaniTicket = {
  generated_at: string;
  andreani_order_id: string;
  tracking_number: string;
  grouped_label_url: string;
  bultos: Array<{
    numero_de_bulto: string;
    numero_de_envio: string;
    label_url: string;
  }>;
  boxes_used: Array<{ name: string; count: number }>;
  boxes_summary: string;
  service_type: string;
  contract: string;
};

export type GenerateTicketResponse = {
  order_id: string;
  display_id: number;
  ticket: AndreaniTicket;
  total_tickets: number;
};

export const ANDREANI_ORDER_TICKETS_KEY = (orderId: string) =>
  ['andreani-order-tickets', orderId] as const;

/**
 * Tickets Andreani guardados en order.metadata.andreani_tickets (los generados
 * on-demand). Distinto de los fulfillments nativos.
 */
export function useOrderAndreaniTickets(orderId: string | null) {
  return useQuery({
    queryKey: ANDREANI_ORDER_TICKETS_KEY(orderId ?? ''),
    enabled: !!orderId,
    queryFn: async () => {
      const { order } = await sdk.client.fetch<{
        order: { id: string; metadata?: { andreani_tickets?: AndreaniTicket[] } };
      }>(`/admin/orders/${orderId}`, {
        method: 'GET',
        query: { fields: 'id,metadata' },
      });
      return order.metadata?.andreani_tickets ?? [];
    },
  });
}

/**
 * Indica si la orden tiene un método de envío Andreani (para mostrar el botón
 * "Generar etiqueta" aunque todavía no exista ningún ticket).
 */
export function useOrderHasAndreaniShipping(orderId: string | null) {
  return useQuery({
    queryKey: ['andreani-order-is-andreani', orderId ?? ''],
    enabled: !!orderId,
    queryFn: async () => {
      const { order } = await sdk.client.fetch<{
        order: {
          id: string;
          shipping_methods?: Array<{
            name?: string;
            data?: { provider?: string; service_type?: string } | null;
          }>;
        };
      }>(`/admin/orders/${orderId}`, {
        method: 'GET',
        query: { fields: 'id,shipping_methods.name,shipping_methods.data' },
      });
      const hint = (v?: string) =>
        !!v &&
        /andreani|domicilio|sucursal|punto|hop/i.test(v.trim().toLowerCase());
      return (order.shipping_methods ?? []).some(
        (m) =>
          hint(m?.name) ||
          hint(m?.data?.provider) ||
          Boolean(m?.data?.service_type)
      );
    },
    staleTime: 60_000,
  });
}

/** Genera una etiqueta on-demand para una orden. */
export function useGenerateAndreaniTicket(orderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      sdk.client.fetch<GenerateTicketResponse>(
        `/admin/andreani/orders/${orderId}/tickets`,
        { method: 'POST', body: {} }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ANDREANI_ORDER_TICKETS_KEY(orderId),
      });
      queryClient.invalidateQueries({
        queryKey: ANDREANI_ORDER_FULFILLMENTS_KEY(orderId),
      });
    },
  });
}

/**
 * Generación masiva: descarga un ZIP con las etiquetas de varias órdenes.
 * Usa fetch nativo (mismo origen, cookie de sesión) porque la respuesta es
 * binaria (ZIP), no JSON.
 */
export function useBulkGenerateTickets() {
  return useMutation({
    mutationFn: async (orderIds: string[]) => {
      const res = await fetch('/admin/andreani/tickets/bulk', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_ids: orderIds }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Bulk generation failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `andreani-tickets-${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    },
  });
}

/**
 * Descarga masiva DOWNLOAD-ONLY: arma un ZIP con las etiquetas EXISTENTES del
 * conjunto filtrado (NO genera envíos nuevos). Usa fetch nativo porque la
 * respuesta es binaria (ZIP).
 */
export function useBulkDownloadLabels() {
  return useMutation({
    mutationFn: async (filters: AndreaniBulkLabelFilters) => {
      const res = await fetch('/admin/andreani/labels/bulk', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filters),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Bulk download failed (${res.status})`);
      }
      const truncated = res.headers.get('X-Andreani-Truncated') === 'true';
      const totalMatched = Number(
        res.headers.get('X-Andreani-Total-Matched') ?? '0'
      );
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `andreani-labels-${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return { truncated, totalMatched };
    },
  });
}

// ─── Cajas (boxes) ──────────────────────────────────────────────────────────

export type AndreaniBox = {
  id: string;
  name: string;
  height: number;
  width: number;
  deep: number;
  max_capacity: number;
  is_active: boolean;
};

export const ANDREANI_BOXES_KEY = ['andreani-boxes'] as const;

export function useAndreaniBoxes() {
  return useQuery({
    queryKey: ANDREANI_BOXES_KEY,
    queryFn: () =>
      sdk.client.fetch<{ boxes: AndreaniBox[] }>('/admin/andreani/boxes', {
        method: 'GET',
      }),
  });
}

export function useCreateAndreaniBox() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Omit<AndreaniBox, 'id'>) =>
      sdk.client.fetch<{ box: AndreaniBox }>('/admin/andreani/boxes', {
        method: 'POST',
        body: payload,
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ANDREANI_BOXES_KEY }),
  });
}

export function useUpdateAndreaniBox() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: Partial<AndreaniBox> & { id: string }) =>
      sdk.client.fetch<{ box: AndreaniBox }>(`/admin/andreani/boxes/${id}`, {
        method: 'POST',
        body: payload,
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ANDREANI_BOXES_KEY }),
  });
}

export function useDeleteAndreaniBox() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch(`/admin/andreani/boxes/${id}`, { method: 'DELETE' }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ANDREANI_BOXES_KEY }),
  });
}
