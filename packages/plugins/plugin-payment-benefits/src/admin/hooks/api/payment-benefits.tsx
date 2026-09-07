import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/*
  Copia LOCAL de `fetchJson` — el host reemplaza esto por el fetchJson compartido
  (`admin/lib/http.ts`) que añade automáticamente el header `x-site-id` de la tienda
  activa. Cuando exista `@minimalart/mercatto-plugin-runtime`, el plugin va a
  importar `fetchJson` de ahí y esta copia se borra.

  TODO: Fase B - integrate shared fetchJson via runtime contract
  (import { fetchJson } from '@minimalart/mercatto-plugin-runtime/admin')
*/
async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message?: string }).message ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

const BASE_URL = '/admin/payment-benefits';

export type BenefitType =
  | 'installments'
  | 'percentage_discount'
  | 'fixed_discount'
  | 'refund'
  | 'cashback'
  | 'custom';

export type BenefitStatus =
  | 'draft'
  | 'scheduled'
  | 'active'
  | 'expired'
  | 'disabled'
  | 'sync_error';

export type PaymentBenefit = {
  id: string;
  provider_code: string;
  external_id: string | null;
  title: string;
  description: string | null;
  benefit_type: BenefitType;
  discount_type: string | null;
  discount_value: number | null;
  max_installments: number | null;
  interest_rate: number | null;
  max_refund: number | null;
  minimum_amount: number | null;
  maximum_amount: number | null;
  source: string;
  read_only: boolean;
  status: BenefitStatus;
  priority: number;
  valid_from: string | null;
  valid_to: string | null;
  eligibility: { scope: string; ids: string[] } | null;
  conditions: Record<string, string | null> | null;
  sales_channel_ids: string[] | null;
  admin_notes: string | null;
  hidden: boolean;
  last_synced_at: string | null;
};

export type PaymentMethodCatalog = {
  id: string;
  provider_code: string;
  external_id: string;
  name: string;
  payment_type_id: string | null;
  status: string | null;
  thumbnail_url: string | null;
  max_interest_free_installments: number | null;
  last_synced_at: string | null;
};

export type Dashboard = {
  total: number;
  active: number;
  expiring_soon: number;
  sync_errors: number;
  last_sync: { provider_code: string; status: string; finished_at: string | null } | null;
  providers: Array<{ code: string; supports_sync: boolean }>;
};

export type SyncResult = {
  provider_code: string;
  status: 'ok' | 'error';
  items_synced: number;
  message?: string | null;
};

/** Solo agrega claves con valor: evita `?q=undefined` que rompe listados. */
function toQueryString(params: Record<string, string | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') qs.set(k, v);
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const benefitsQK = (params?: Record<string, string | undefined>) =>
  ['payment-benefits', params ?? {}] as const;
export const benefitQK = (id: string) => ['payment-benefits', id] as const;
export const dashboardQK = () => ['payment-benefits', 'dashboard'] as const;
export const catalogQK = () => ['payment-benefits', 'catalog'] as const;

export function usePaymentBenefits(params?: {
  provider_code?: string;
  status?: string;
  benefit_type?: string;
  source?: string;
  limit?: string;
  offset?: string;
}) {
  return useQuery({
    queryKey: benefitsQK(params),
    queryFn: () =>
      fetchJson<{ payment_benefits: PaymentBenefit[]; count: number }>(
        `${BASE_URL}${toQueryString({ ...params })}`,
      ),
  });
}

export function usePaymentBenefit(id: string) {
  return useQuery({
    queryKey: benefitQK(id),
    queryFn: () => fetchJson<{ payment_benefit: PaymentBenefit }>(`${BASE_URL}/${id}`),
    enabled: !!id,
  });
}

export function usePaymentBenefitsDashboard() {
  return useQuery({
    queryKey: dashboardQK(),
    queryFn: () => fetchJson<Dashboard>(`${BASE_URL}/dashboard`),
  });
}

export function usePaymentMethodCatalog() {
  return useQuery({
    queryKey: catalogQK(),
    queryFn: () =>
      fetchJson<{ payment_methods: PaymentMethodCatalog[] }>(`${BASE_URL}/catalog`),
  });
}

export function useCreatePaymentBenefit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<PaymentBenefit>) =>
      fetchJson<{ payment_benefit: PaymentBenefit }>(BASE_URL, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payment-benefits'] });
    },
  });
}

export function useUpdatePaymentBenefit(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<PaymentBenefit>) =>
      fetchJson<{ payment_benefit: PaymentBenefit }>(`${BASE_URL}/${id}`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payment-benefits'] });
    },
  });
}

export function useDeletePaymentBenefit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fetchJson(`${BASE_URL}/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payment-benefits'] });
    },
  });
}

export function useSyncProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (provider: string) =>
      fetchJson<{ result: SyncResult }>(`${BASE_URL}/sync/${provider}`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payment-benefits'] });
    },
  });
}
