import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const BASE_URL = '/admin/checkout-links';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CheckoutLinkItem = {
  variant_id: string;
  quantity: number;
};

export type CheckoutLinkAddress = {
  first_name?: string;
  last_name?: string;
  address_1?: string;
  address_2?: string;
  company?: string;
  postal_code?: string;
  city?: string;
  country_code?: string;
  province?: string;
  phone?: string;
} | null;

export type CheckoutLink = {
  id: string;
  token: string;
  internal_name?: string | null;
  items: CheckoutLinkItem[];
  country_code: string;
  region_id?: string | null;
  sales_channel_id?: string | null;
  email?: string | null;
  customer_id?: string | null;
  shipping_address?: CheckoutLinkAddress;
  promo_codes?: string[] | null;
  status: string;
  single_use: boolean;
  used_count: number;
  expires_at?: string | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
  /** Full public storefront URL, built by the backend from STOREFRONT_URL. */
  public_url?: string;
};

export type CheckoutLinkCreateInput = {
  internal_name?: string;
  items: CheckoutLinkItem[];
  country_code: string;
  region_id?: string;
  sales_channel_id?: string;
  email?: string;
  customer_id?: string;
  shipping_address?: CheckoutLinkAddress;
  promo_codes?: string[];
  single_use?: boolean;
  expires_at?: string | null;
};

export type CheckoutLinkUpdateInput = Partial<
  CheckoutLinkCreateInput & { status: string }
>;

// ─── Query keys ───────────────────────────────────────────────────────────────

export const CHECKOUT_LINKS_QUERY_KEY = ['checkout-links'] as const;
export const checkoutLinkQueryKey = (id: string) =>
  ['checkout-links', id] as const;

// ─── Fetch helper ───────────────────────────────────────────────────────────

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

export type CheckoutLinksListResponse = {
  checkout_links: CheckoutLink[];
  count: number;
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useCheckoutLinks(params?: { limit?: number; offset?: number }) {
  const qs = new URLSearchParams();
  if (params?.limit != null) qs.set('limit', String(params.limit));
  if (params?.offset != null) qs.set('offset', String(params.offset));
  const url = qs.toString() ? `${BASE_URL}?${qs.toString()}` : BASE_URL;

  return useQuery({
    queryKey: [...CHECKOUT_LINKS_QUERY_KEY, params ?? {}],
    queryFn: () => fetchJson<CheckoutLinksListResponse>(url),
  });
}

export function useCheckoutLink(id: string) {
  return useQuery({
    queryKey: checkoutLinkQueryKey(id),
    queryFn: () =>
      fetchJson<{ checkout_link: CheckoutLink }>(`${BASE_URL}/${id}`).then(
        (d) => d.checkout_link,
      ),
    enabled: !!id,
  });
}

export function useCreateCheckoutLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CheckoutLinkCreateInput) =>
      fetchJson<{ checkout_link: CheckoutLink }>(BASE_URL, {
        method: 'POST',
        body: JSON.stringify(data),
      }).then((d) => d.checkout_link),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: CHECKOUT_LINKS_QUERY_KEY }),
  });
}

export function useUpdateCheckoutLink(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CheckoutLinkUpdateInput) =>
      fetchJson<{ checkout_link: CheckoutLink }>(`${BASE_URL}/${id}`, {
        method: 'POST',
        body: JSON.stringify(data),
      }).then((d) => d.checkout_link),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CHECKOUT_LINKS_QUERY_KEY });
      qc.invalidateQueries({ queryKey: checkoutLinkQueryKey(id) });
    },
  });
}

export function useDeleteCheckoutLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ deleted: boolean }>(`${BASE_URL}/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: CHECKOUT_LINKS_QUERY_KEY }),
  });
}
