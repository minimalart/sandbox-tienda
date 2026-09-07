import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toQueryString } from '../../lib/query-string';

const PROGRAMS_URL = '/admin/loyalty/programs';
const RULES_URL = '/admin/loyalty/rules';
const REWARDS_URL = '/admin/loyalty/rewards';
const GRANTS_URL = '/admin/loyalty/grants';
const TIERS_URL = '/admin/loyalty/tiers';
const CAMPAIGNS_URL = '/admin/loyalty/campaigns';

/**
 * The active-tenant header MUST reach the backend on every admin request; without
 * `x-site-id`, the backend's `siteFromRequest` resolves to `allSites` and every
 * loyalty filter becomes a no-op — the operator of store A would see programs,
 * rules, rewards, grants, tiers and campaigns of ALL stores mixed together, and
 * mutations would silently affect other tenants.
 *
 * Contract with the host: the active site id is written to `localStorage` under
 * the key `ms:active-site` by the host's tenant selector. The plugin READS from
 * that same slot to stay in sync without importing the host's admin lib.
 *
 * If the plugin runs under a single-tenant host that never populates the slot,
 * this reduces to a no-op (empty headers) — same behavior as the host's
 * `siteHeader()`. Mirrors `plugin-contact` v1.1.0, kept in sync intentionally
 * until a shared UI package is extracted.
 */
const ACTIVE_SITE_STORAGE_KEY = 'ms:active-site';
const SITE_ID_HEADER = 'x-site-id';

function siteHeader(): Record<string, string> {
  try {
    const raw = typeof globalThis !== 'undefined'
      ? (globalThis as { localStorage?: Storage }).localStorage?.getItem(ACTIVE_SITE_STORAGE_KEY)
      : null;
    if (!raw) return {};
    // Host stores JSON `{ id, slug, name }`; older shapes were bare id strings.
    try {
      const parsed = JSON.parse(raw);
      const id = typeof parsed?.id === 'string' ? parsed.id.trim() : '';
      return id ? { [SITE_ID_HEADER]: id } : {};
    } catch {
      const id = raw.trim();
      return id ? { [SITE_ID_HEADER]: id } : {};
    }
  } catch {
    return {};
  }
}

function activeSiteId(): string | null {
  const h = siteHeader();
  return h[SITE_ID_HEADER] ?? null;
}

export const LOYALTY_QUERY_KEY = ['loyalty'] as const;

export type LoyaltyProgram = {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  points_name: string;
  currency_code: string;
  starts_at?: string | null;
  ends_at?: string | null;
  expiration_policy?: { type?: 'none' | 'fixed_days' | 'end_of_year'; days?: number } | null;
  config?: Record<string, unknown> | null;
  created_at: string;
};

export type EarnRule = {
  id: string;
  program_id: string;
  name: string;
  status: 'active' | 'inactive';
  priority: number;
  event: 'purchase' | 'signup' | 'first_purchase' | 'order_delivered' | 'birthday' | 'referral' | 'comment';
  calc_type: 'fixed' | 'percentage' | 'multiplier';
  calc_value: number;
  conditions?: Record<string, unknown> | null;
  limits?: Record<string, unknown> | null;
  created_at: string;
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...siteHeader(),
      ...(init?.headers ?? {}),
    },
    credentials: 'include',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message?: string }).message ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

// ── Programs ────────────────────────────────────────────────────────────────
export function useLoyaltyPrograms() {
  return useQuery({
    queryKey: [...LOYALTY_QUERY_KEY, 'programs'],
    queryFn: () => fetchJson<{ programs: LoyaltyProgram[]; count: number }>(PROGRAMS_URL),
  });
}

export function useCreateProgram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<LoyaltyProgram>) =>
      fetchJson<{ program: LoyaltyProgram }>(PROGRAMS_URL, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: LOYALTY_QUERY_KEY }),
  });
}

export function useUpdateProgram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<LoyaltyProgram> & { id: string }) =>
      fetchJson<{ program: LoyaltyProgram }>(`${PROGRAMS_URL}/${id}`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: LOYALTY_QUERY_KEY }),
  });
}

// ── Rules ─────────────────────────────────────────────────────────────────
export function useEarnRules(params?: { program_id?: string; event?: string }) {
  const qs = toQueryString(params as Record<string, unknown> | undefined);
  const url = qs ? `${RULES_URL}?${qs}` : RULES_URL;
  return useQuery({
    queryKey: [...LOYALTY_QUERY_KEY, 'rules', params ?? {}],
    queryFn: () => fetchJson<{ rules: EarnRule[]; count: number }>(url),
  });
}

export function useCreateRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<EarnRule>) =>
      fetchJson<{ rule: EarnRule }>(RULES_URL, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: LOYALTY_QUERY_KEY }),
  });
}

export function useUpdateRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<EarnRule> & { id: string }) =>
      fetchJson<{ rule: EarnRule }>(`${RULES_URL}/${id}`, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: LOYALTY_QUERY_KEY }),
  });
}

export function useDeleteRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ deleted: boolean }>(`${RULES_URL}/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: LOYALTY_QUERY_KEY }),
  });
}

// ── Rewards ─────────────────────────────────────────────────────────────────
export type RewardType =
  | 'fixed_discount'
  | 'percent_discount'
  | 'free_shipping'
  | 'free_product'
  | 'store_credit'
  | 'custom';

export type Reward = {
  id: string;
  program_id: string;
  name: string;
  description?: string | null;
  image_url?: string | null;
  cost_points: number;
  type: RewardType;
  config?: { value?: number; currency_code?: string; product_id?: string } | null;
  stock?: number | null;
  valid_from?: string | null;
  valid_to?: string | null;
  status: 'active' | 'inactive';
  created_at: string;
};

export function useRewards(params?: { program_id?: string }) {
  const qs = toQueryString(params as Record<string, unknown> | undefined);
  const url = qs ? `${REWARDS_URL}?${qs}` : REWARDS_URL;
  return useQuery({
    queryKey: [...LOYALTY_QUERY_KEY, 'rewards', params ?? {}],
    queryFn: () => fetchJson<{ rewards: Reward[]; count: number }>(url),
  });
}

export function useCreateReward() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Reward>) =>
      fetchJson<{ reward: Reward }>(REWARDS_URL, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: LOYALTY_QUERY_KEY }),
  });
}

export function useUpdateReward() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<Reward> & { id: string }) =>
      fetchJson<{ reward: Reward }>(`${REWARDS_URL}/${id}`, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: LOYALTY_QUERY_KEY }),
  });
}

export function useDeleteReward() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ deleted: boolean }>(`${REWARDS_URL}/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: LOYALTY_QUERY_KEY }),
  });
}

// ── Grants (canjes) ───────────────────────────────────────────────────────
export type RewardGrant = {
  id: string;
  customer_id: string;
  status: 'pending' | 'available' | 'used' | 'expired' | 'cancelled';
  benefit_type?: 'promotion' | 'store_credit' | null;
  benefit_ref?: string | null;
  points_spent: number;
  created_at: string;
  reward?: { name?: string } | null;
};

export function useGrants(params?: { status?: string; customer_id?: string }) {
  const qs = toQueryString(params as Record<string, unknown> | undefined);
  const url = qs ? `${GRANTS_URL}?${qs}` : GRANTS_URL;
  return useQuery({
    queryKey: [...LOYALTY_QUERY_KEY, 'grants', params ?? {}],
    queryFn: () => fetchJson<{ grants: RewardGrant[]; count: number }>(url),
  });
}

// ── Tiers ─────────────────────────────────────────────────────────────────
export type Tier = {
  id: string;
  program_id: string;
  name: string;
  condition_type: 'spend' | 'points' | 'orders';
  threshold: number;
  multiplier: number;
  created_at: string;
};

export function useTiers(params?: { program_id?: string }) {
  const qs = toQueryString(params as Record<string, unknown> | undefined);
  const url = qs ? `${TIERS_URL}?${qs}` : TIERS_URL;
  return useQuery({
    queryKey: [...LOYALTY_QUERY_KEY, 'tiers', params ?? {}],
    queryFn: () => fetchJson<{ tiers: Tier[]; count: number }>(url),
  });
}
export function useCreateTier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Tier>) =>
      fetchJson<{ tier: Tier }>(TIERS_URL, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: LOYALTY_QUERY_KEY }),
  });
}
export function useUpdateTier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<Tier> & { id: string }) =>
      fetchJson<{ tier: Tier }>(`${TIERS_URL}/${id}`, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: LOYALTY_QUERY_KEY }),
  });
}
export function useDeleteTier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fetchJson<{ deleted: boolean }>(`${TIERS_URL}/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: LOYALTY_QUERY_KEY }),
  });
}

// ── Campaigns ───────────────────────────────────────────────────────────────
export type Campaign = {
  id: string;
  program_id: string;
  name: string;
  status: 'active' | 'inactive';
  starts_at?: string | null;
  ends_at?: string | null;
  multiplier: number;
  priority: number;
  created_at: string;
};

export function useCampaigns(params?: { program_id?: string }) {
  const qs = toQueryString(params as Record<string, unknown> | undefined);
  const url = qs ? `${CAMPAIGNS_URL}?${qs}` : CAMPAIGNS_URL;
  return useQuery({
    queryKey: [...LOYALTY_QUERY_KEY, 'campaigns', params ?? {}],
    queryFn: () => fetchJson<{ campaigns: Campaign[]; count: number }>(url),
  });
}
export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Campaign>) =>
      fetchJson<{ campaign: Campaign }>(CAMPAIGNS_URL, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: LOYALTY_QUERY_KEY }),
  });
}
export function useUpdateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<Campaign> & { id: string }) =>
      fetchJson<{ campaign: Campaign }>(`${CAMPAIGNS_URL}/${id}`, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: LOYALTY_QUERY_KEY }),
  });
}
export function useDeleteCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fetchJson<{ deleted: boolean }>(`${CAMPAIGNS_URL}/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: LOYALTY_QUERY_KEY }),
  });
}

// ── Dashboard / movements / customer summary ─────────────────────────────────
export type LoyaltyDashboard = {
  issued: number;
  redeemed: number;
  expired: number;
  active_customers: number;
  avg_balance: number;
  pending_redemptions: number;
  total_redemptions: number;
  top_rewards: { name: string; count: number }[];
};

export function useLoyaltyDashboard() {
  return useQuery({
    queryKey: [...LOYALTY_QUERY_KEY, 'dashboard'],
    queryFn: () => fetchJson<LoyaltyDashboard>('/admin/loyalty/dashboard'),
  });
}

export type Movement = {
  id: string;
  amount: number;
  type: string;
  status: string;
  reference?: string | null;
  reference_id?: string | null;
  created_at: string;
};

export function useMovements(params?: { limit?: number; offset?: number }) {
  const qs = toQueryString(params as Record<string, unknown> | undefined);
  const url = qs ? `/admin/loyalty/movements?${qs}` : '/admin/loyalty/movements';
  return useQuery({
    queryKey: [...LOYALTY_QUERY_KEY, 'movements', params ?? {}],
    queryFn: () => fetchJson<{ movements: Movement[]; count: number }>(url),
  });
}

export type CustomerLoyalty = {
  balance: number;
  tier: { name?: string } | null;
  progress: { next: { name?: string } | null; toNext: number } | null;
  transactions: Movement[];
  grants: Array<{ id: string; status: string; benefit_type?: string | null; benefit_ref?: string | null; reward?: { name?: string } | null }>;
};

export function useCustomerLoyalty(customerId?: string) {
  return useQuery({
    enabled: Boolean(customerId),
    queryKey: [...LOYALTY_QUERY_KEY, 'customer', customerId],
    queryFn: () => fetchJson<CustomerLoyalty>(`/admin/loyalty/customers/${customerId}`),
  });
}
