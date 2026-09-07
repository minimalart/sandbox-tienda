import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
/*
  `fetchJson` compartido, NO una copia local. `admin/corporates` y sus cuatro
  subrutas (`[id]`, `/activity`, `/members`, `/rules`) están declaradas `scoped`,
  pero la copia local mandaba sólo `Content-Type`: sin `x-site-id`,
  `siteFromRequest` resolvía `allSites` y el filtro quedaba en no-op. Las `rules`
  son las reglas de compra de una corporativa —quién puede comprar qué y por cuánto—
  y se editan por id sobre la lista que devolvió el GET: sin el header, tocar la
  regla de la corporativa de otra tienda no daba ningún error.
*/
import { fetchJson } from '../../lib/http';

const BASE_URL = '/admin/corporates';

export type CorporateStatus = 'pending' | 'active' | 'suspended' | 'archived';
export type CorporateRole = 'owner' | 'admin' | 'buyer' | 'viewer';
export type MemberStatus = 'invited' | 'active' | 'disabled';

export type Corporate = {
  id: string;
  name: string;
  slug: string;
  legal_name?: string | null;
  tax_id?: string | null;
  email_domain?: string | null;
  status: CorporateStatus;
  customer_group_id?: string | null;
  metadata?: Record<string, unknown> | null;
  members_count?: number;
  created_at?: string;
  updated_at?: string;
};

export type CorporateMember = {
  id: string;
  corporate_id: string;
  customer_id: string;
  role: CorporateRole;
  status: MemberStatus;
  invited_by?: string | null;
  joined_at?: string | null;
  created_at?: string;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

export type CorporateRule = {
  id: string;
  corporate_id: string;
  type: string;
  config: Record<string, unknown>;
  enabled: boolean;
};

export type CorporateInvitation = {
  id: string;
  email: string;
  role: CorporateRole;
  status: string;
  expires_at?: string | null;
  accepted_at?: string | null;
  created_at?: string;
};

export const CORPORATES_QK = ['corporates'] as const;
export const corporateQK = (id: string) => ['corporates', id] as const;

export type CorporateInput = {
  name: string;
  slug?: string;
  legal_name?: string | null;
  tax_id?: string | null;
  email_domain?: string | null;
  status?: CorporateStatus;
  owner_customer_id?: string;
};

export function useCorporates(params?: {
  limit?: number;
  offset?: number;
  status?: string;
  q?: string;
}) {
  const qs = new URLSearchParams();
  if (params?.limit != null) qs.set('limit', String(params.limit));
  if (params?.offset != null) qs.set('offset', String(params.offset));
  if (params?.status) qs.set('status', params.status);
  if (params?.q) qs.set('q', params.q);
  const url = qs.toString() ? `${BASE_URL}?${qs}` : BASE_URL;
  return useQuery({
    queryKey: [...CORPORATES_QK, params ?? {}],
    queryFn: () => fetchJson<{ corporates: Corporate[]; count: number }>(url),
  });
}

export function useCorporate(id: string, enabled = true) {
  return useQuery({
    queryKey: corporateQK(id),
    queryFn: () =>
      fetchJson<{
        corporate: Corporate & { members: CorporateMember[]; rules: CorporateRule[] };
      }>(`${BASE_URL}/${id}`),
    enabled: enabled && !!id,
  });
}

export function useCreateCorporate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CorporateInput) =>
      fetchJson<{ corporate: Corporate }>(BASE_URL, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: CORPORATES_QK }),
  });
}

export function useUpdateCorporate(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<CorporateInput>) =>
      fetchJson<{ corporate: Corporate }>(`${BASE_URL}/${id}`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CORPORATES_QK });
      qc.invalidateQueries({ queryKey: corporateQK(id) });
    },
  });
}

export function useDeleteCorporate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ deleted: boolean }>(`${BASE_URL}/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: CORPORATES_QK }),
  });
}

export function useSetCorporateStatus(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (status: CorporateStatus) =>
      fetchJson(`${BASE_URL}/${id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CORPORATES_QK });
      qc.invalidateQueries({ queryKey: corporateQK(id) });
    },
  });
}

export type AddCorporateMemberInput = {
  customer_id?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  password?: string;
  role?: CorporateRole;
  status?: MemberStatus;
};

export function useAddMember(corporateId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AddCorporateMemberInput) =>
      fetchJson(`${BASE_URL}/${corporateId}/members`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: corporateQK(corporateId) }),
  });
}

export function useUpdateMember(corporateId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { memberId: string; role?: CorporateRole; status?: MemberStatus }) =>
      fetchJson(`${BASE_URL}/${corporateId}/members/${args.memberId}`, {
        method: 'POST',
        body: JSON.stringify({ role: args.role, status: args.status }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: corporateQK(corporateId) }),
  });
}

export function useDeleteMember(corporateId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) =>
      fetchJson(`${BASE_URL}/${corporateId}/members/${memberId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: corporateQK(corporateId) }),
  });
}

export function useCreateRule(corporateId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { type: string; config: Record<string, unknown>; enabled?: boolean }) =>
      fetchJson(`${BASE_URL}/${corporateId}/rules`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: corporateQK(corporateId) }),
  });
}

export function useUpdateRule(corporateId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: {
      ruleId: string;
      type?: string;
      config?: Record<string, unknown>;
      enabled?: boolean;
    }) =>
      fetchJson(`${BASE_URL}/${corporateId}/rules/${args.ruleId}`, {
        method: 'POST',
        body: JSON.stringify({ type: args.type, config: args.config, enabled: args.enabled }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: corporateQK(corporateId) }),
  });
}

export function useDeleteRule(corporateId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ruleId: string) =>
      fetchJson(`${BASE_URL}/${corporateId}/rules/${ruleId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: corporateQK(corporateId) }),
  });
}

export function useCustomerGroupLink(corporateId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { action: 'link' | 'unlink'; customer_group_id?: string }) =>
      fetchJson(`${BASE_URL}/${corporateId}/customer-group`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: corporateQK(corporateId) });
      // El "crear y vincular grupo nuevo" genera un customer group: refrescamos la lista
      // para que aparezca con su nombre (no solo el id).
      qc.invalidateQueries({ queryKey: ['customer-groups'] });
    },
  });
}

export type CustomerGroup = { id: string; name: string };

/** Lista los customer groups existentes (endpoint core de Medusa). */
export function useCustomerGroups() {
  return useQuery({
    queryKey: ['customer-groups'],
    queryFn: () =>
      fetchJson<{ customer_groups: CustomerGroup[] }>(
        '/admin/customer-groups?limit=200&fields=id,name',
      ),
  });
}

export function useCorporateActivity(id: string, enabled = true) {
  return useQuery({
    queryKey: [...corporateQK(id), 'activity'],
    queryFn: () =>
      fetchJson<{ invitations: CorporateInvitation[]; members: CorporateMember[] }>(
        `${BASE_URL}/${id}/activity`,
      ),
    enabled: enabled && !!id,
  });
}
