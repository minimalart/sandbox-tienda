import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const BASE_URL = '/admin/abandoned-carts';

export type AbandonedCartStatus = 'pending' | 'notified' | 'recovered' | 'cancelled';

export type AbandonedCart = {
  id: string;
  cart_id: string;
  email?: string | null;
  phone?: string | null;
  customer_id?: string | null;
  sales_channel_id?: string | null;
  cart_total?: number | null;
  currency_code?: string | null;
  status: AbandonedCartStatus;
  last_step_sent: number;
  next_eligible_at?: string | null;
  last_activity_at?: string | null;
  recovered_order_id?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type AbandonedCartMetrics = {
  total: number;
  /** Trackeados con email y/o teléfono: el pipeline que se puede notificar. */
  contactable: number;
  /** Trackeados sin contacto: el techo de recuperación que hoy se pierde. */
  uncontactable: number;
  by_status: Record<string, number>;
  by_sales_channel: Record<string, number>;
  /** Montos por moneda: nunca se suman monedas distintas en un solo número. */
  recoverable_value_by_currency: Record<string, number>;
  recovered_value_by_currency: Record<string, number>;
  /** Fracción 0..1 sobre los CONTACTABLES, no sobre el total. */
  recovery_rate: number;
};

export type AbandonedCartsListResponse = {
  abandoned_carts: AbandonedCart[];
  count: number;
  offset: number;
  limit: number;
  metrics: AbandonedCartMetrics;
};

export const ABANDONED_CARTS_QUERY_KEY = ['abandoned-carts'] as const;

/**
 * Serializa un objeto plano a `URLSearchParams`, omitiendo entradas
 * `undefined`/`null` y vacías. Inline dentro del plugin porque el host provee un
 * helper equivalente que no está disponible acá.
 */
function toQueryString(params?: Record<string, unknown>): string {
  if (!params) return '';
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.append(key, String(value));
  }
  return search.toString();
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    credentials: 'include',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message?: string }).message ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export function useAbandonedCarts(params?: {
  limit?: number;
  offset?: number;
  status?: string;
  sales_channel_id?: string;
}) {
  const qs = toQueryString(params as Record<string, unknown> | undefined);
  const url = qs ? `${BASE_URL}?${qs}` : BASE_URL;
  return useQuery({
    queryKey: [...ABANDONED_CARTS_QUERY_KEY, params ?? {}],
    queryFn: () => fetchJson<AbandonedCartsListResponse>(url),
  });
}

export function useResendAbandonedCart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; step?: number }) =>
      fetchJson<{ result: unknown }>(`${BASE_URL}/${vars.id}/resend`, {
        method: 'POST',
        body: JSON.stringify(vars.step ? { step: vars.step } : {}),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ABANDONED_CARTS_QUERY_KEY }),
  });
}

export type SalesChannel = { id: string; name: string };

export type SalesChannelsListResponse = {
  sales_channels: SalesChannel[];
};

/**
 * Lista de canales de venta. Se lee directo de `/admin/sales-channels` para no
 * depender del hook homónimo del host — el plugin no puede importar de él.
 */
export function useSalesChannels() {
  return useQuery({
    queryKey: ['plugin-abandoned-cart', 'sales-channels'],
    queryFn: () =>
      fetchJson<SalesChannelsListResponse>('/admin/sales-channels?limit=100'),
  });
}
