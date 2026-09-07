import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
/*
  `fetchJson` compartido, NO una copia local. Pega a `admin/companies/[id]/credit` y
  `.../credit/transactions`, ambas declaradas `scoped`, pero la copia local mandaba
  sólo `Content-Type`: sin `x-site-id`, `siteFromRequest` resolvía `allSites` y el
  filtro quedaba en no-op. Lo que se ve acá es la cuenta corriente de una empresa:
  el POST de ajuste mueve saldo real, así que un filtro que no filtra es un
  movimiento de crédito imputado con la tienda equivocada, no una fila de más.
*/
import { fetchJson } from '../../lib/http';

const BASE_URL = '/admin/companies';

export type CreditAccountStatus = 'active' | 'suspended' | 'blocked';

export type CreditAccount = {
  id: string;
  company_id: string;
  status: CreditAccountStatus;
  currency_code: string;
  credit_limit: number;
  current_balance: number;
  payment_terms_days: number | null;
  notes: string | null;
};

export type CreditTransaction = {
  id: string;
  company_id: string;
  type: 'compra' | 'pago' | 'nota_credito' | 'nota_debito' | 'ajuste';
  amount: number;
  balance_before: number;
  balance_after: number;
  currency_code: string;
  order_id: string | null;
  created_by: string | null;
  notes: string | null;
  created_at: string;
};

export type CreditSummary = {
  account: CreditAccount | null;
  available_credit: number | null;
  transactions: CreditTransaction[];
};

export const creditQK = (companyId: string) => ['company-credit', companyId] as const;
export const creditTxQK = (companyId: string, params?: Record<string, string>) =>
  ['company-credit', companyId, 'transactions', params ?? {}] as const;

/** Solo agrega claves con valor: evita `?q=undefined` que rompe listados. */
function toQueryString(params: Record<string, string | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') qs.set(k, v);
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export function useCompanyCredit(companyId: string, enabled = true) {
  return useQuery({
    queryKey: creditQK(companyId),
    queryFn: () => fetchJson<CreditSummary>(`${BASE_URL}/${companyId}/credit`),
    enabled: enabled && !!companyId,
  });
}

export type CreateCreditAccountInput = {
  credit_limit: number;
  currency_code?: string;
  status?: CreditAccountStatus;
  payment_terms_days?: number | null;
  notes?: string | null;
};

export function useCreateCreditAccount(companyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCreditAccountInput) =>
      fetchJson(`${BASE_URL}/${companyId}/credit`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: creditQK(companyId) }),
  });
}

export type UpdateCreditConditionsInput = {
  credit_limit?: number;
  status?: CreditAccountStatus;
  payment_terms_days?: number | null;
  notes?: string | null;
};

export function useUpdateCreditConditions(companyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateCreditConditionsInput) =>
      fetchJson(`${BASE_URL}/${companyId}/credit/conditions`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: creditQK(companyId) });
      qc.invalidateQueries({ queryKey: ['company-credit', companyId, 'transactions'] });
    },
  });
}

export type CreateCreditTransactionInput = {
  type: 'pago' | 'nota_credito' | 'nota_debito' | 'ajuste';
  amount: number;
  notes?: string | null;
};

export function useCreateCreditTransaction(companyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCreditTransactionInput) =>
      fetchJson(`${BASE_URL}/${companyId}/credit/transactions`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: creditQK(companyId) });
      qc.invalidateQueries({ queryKey: ['company-credit', companyId, 'transactions'] });
    },
  });
}

export function useCompanyCreditTransactions(
  companyId: string,
  params?: { type?: string; from?: string; to?: string; limit?: string; offset?: string },
) {
  return useQuery({
    queryKey: creditTxQK(companyId, params as Record<string, string> | undefined),
    queryFn: () =>
      fetchJson<{ transactions: CreditTransaction[]; count: number }>(
        `${BASE_URL}/${companyId}/credit/transactions${toQueryString({ ...params })}`,
      ),
    enabled: !!companyId,
  });
}
