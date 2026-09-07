import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
/*
  `fetchJson` compartido, NO una copia local. Este archivo es el caso que se
  verificó punta a punta: `api/admin/companies/route.ts` hace
  `siteFilter(req.scope, await siteFromRequest(req), COMPANY_SITE_SCOPE)` — el
  backend filtra bien— pero la copia local mandaba sólo `Content-Type`, así que
  `siteFromRequest` resolvía `allSites`, `siteOf(req)` devolvía `null` y el filtro
  quedaba en no-op. Media migración: la pantalla decía "esta tienda" y listaba las
  tres.

  `customer-groups` y `sales-channels` (los combos del formulario) NO están en el
  registro de scoping y siguen devolviendo todo. Van por el mismo helper igual: el
  header de más es inofensivo, y partir el archivo en dos transportes es cómo se
  cuela la próxima copia sin `x-site-id`.
*/
import { fetchJson } from '../../lib/http';

const BASE_URL = '/admin/companies';

export type Company = {
  id: string;
  name: string;
  slug: string;
  legal_name?: string | null;
  tax_id?: string | null;
  status: string;
  sales_channel_id?: string | null;
  customer_group_id?: string | null;
  metadata?: Record<string, unknown> | null;
  members_count?: number;
  created_at?: string;
};

export type CompanyMember = {
  id: string;
  customer_id: string;
  role: string;
  status: string;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

export const COMPANIES_QK = ['companies'] as const;
export const companyQK = (id: string) => ['companies', id] as const;

export function useCompanies(params?: {
  status?: string;
  q?: string;
  limit?: number;
  offset?: number;
}) {
  const qs = new URLSearchParams();
  if (params?.status) qs.set('status', params.status);
  if (params?.q) qs.set('q', params.q);
  qs.set('limit', String(params?.limit ?? 100));
  if (params?.offset != null) qs.set('offset', String(params.offset));
  return useQuery({
    queryKey: [...COMPANIES_QK, params ?? {}],
    queryFn: () => fetchJson<{ companies: Company[]; count: number }>(`${BASE_URL}?${qs}`),
  });
}

export function useCompany(id: string, enabled = true) {
  return useQuery({
    queryKey: companyQK(id),
    queryFn: () =>
      fetchJson<{ company: Company & { members: CompanyMember[] } }>(`${BASE_URL}/${id}`),
    enabled: enabled && !!id,
  });
}

export type CreateCompanyInput = {
  name: string;
  legal_name?: string | null;
  tax_id?: string | null;
  owner_customer_id?: string;
};

export function useCreateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCompanyInput) =>
      fetchJson<{ company: Company }>(BASE_URL, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: COMPANIES_QK }),
  });
}

export function useUpdateCompany(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Company>) =>
      fetchJson(`${BASE_URL}/${id}`, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: COMPANIES_QK });
      qc.invalidateQueries({ queryKey: companyQK(id) });
    },
  });
}

export function useDeleteCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ deleted: boolean }>(`${BASE_URL}/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: COMPANIES_QK }),
  });
}

export type CompanyRole = 'owner' | 'admin' | 'buyer' | 'viewer';
export type MemberStatus = 'invited' | 'active' | 'disabled';

export type AddCompanyMemberInput = {
  customer_id?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  password?: string;
  role?: CompanyRole;
  status?: MemberStatus;
};

export function useAddCompanyMember(companyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AddCompanyMemberInput) =>
      fetchJson(`${BASE_URL}/${companyId}/members`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: companyQK(companyId) }),
  });
}

export function useUpdateCompanyMember(companyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { memberId: string; role?: CompanyRole; status?: MemberStatus }) =>
      fetchJson(`${BASE_URL}/${companyId}/members/${args.memberId}`, {
        method: 'POST',
        body: JSON.stringify({ role: args.role, status: args.status }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: companyQK(companyId) }),
  });
}

export function useDeleteCompanyMember(companyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) =>
      fetchJson(`${BASE_URL}/${companyId}/members/${memberId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: companyQK(companyId) }),
  });
}

export function useCompanyCustomerGroup(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { action: 'link' | 'unlink'; customer_group_id?: string }) =>
      fetchJson(`${BASE_URL}/${id}/customer-group`, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: companyQK(id) });
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

export type SalesChannel = { id: string; name: string };

/** Lista los sales channels existentes (endpoint core de Medusa). */
export function useSalesChannels() {
  return useQuery({
    queryKey: ['sales-channels'],
    queryFn: () =>
      fetchJson<{ sales_channels: SalesChannel[] }>(
        '/admin/sales-channels?limit=200&fields=id,name',
      ),
  });
}
