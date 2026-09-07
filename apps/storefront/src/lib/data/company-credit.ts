"use server";

import { sdk } from "@lib/config";
import { getAuthHeaders } from "./cookies";

export type CreditAccountStatus = "active" | "suspended" | "blocked";

export type CreditTransactionType =
  | "compra"
  | "pago"
  | "nota_credito"
  | "nota_debito"
  | "ajuste";

export type CreditAccountSummary = {
  status: CreditAccountStatus;
  currency_code: string;
  credit_limit: number;
  current_balance: number;
  available_credit: number;
  payment_terms_days: number | null;
};

export type MyCredit = {
  account: CreditAccountSummary | null;
  can_use?: boolean;
};

export type CreditTransaction = {
  id: string;
  type: CreditTransactionType;
  amount: number;
  balance_before: number;
  balance_after: number;
  currency_code: string;
  order_id: string | null;
  notes: string | null;
  created_at: string;
};

/**
 * provider_id completo del medio "Cuenta Corriente" (ver backend constants).
 * NOTA: este archivo es `"use server"`, donde solo se pueden exportar funciones
 * async. Por eso este id NO se exporta desde acá; quien lo necesite lo define
 * localmente (ej. la ruta de payment-providers del B2C).
 */
const CUENTA_CORRIENTE_PROVIDER_ID = "pp_cuenta_corriente_cuenta_corriente";

async function authed() {
  const h = await getAuthHeaders();
  return Object.keys(h).length ? h : null;
}

/**
 * Filtra el medio "Cuenta Corriente" de la lista de métodos de pago salvo que la
 * empresa del cliente tenga cuenta ACTIVA y crédito suficiente para `amount`.
 * Los demás métodos se dejan intactos. Best-effort: ante error, oculta el medio.
 */
export async function filterCreditPaymentMethod<T extends { id: string }>(
  methods: T[],
  amount?: number,
): Promise<T[]> {
  const hasCredit = methods.some((m) => m.id === CUENTA_CORRIENTE_PROVIDER_ID);
  if (!hasCredit) return methods;
  let canUse = false;
  try {
    const credit = await getMyCredit(amount);
    canUse = !!credit.can_use && !!credit.account;
  } catch {
    canUse = false;
  }
  return canUse ? methods : methods.filter((m) => m.id !== CUENTA_CORRIENTE_PROVIDER_ID);
}

/**
 * Resumen de la cuenta corriente de la empresa del cliente logueado.
 * `amount` opcional (total del carrito) → `can_use` refleja si alcanza el crédito.
 */
export async function getMyCredit(amount?: number): Promise<MyCredit> {
  const headers = await authed();
  if (!headers) return { account: null };
  try {
    return await sdk.client.fetch<MyCredit>("/store/companies/me/credit", {
      method: "GET",
      query: amount != null ? { amount } : undefined,
      headers,
      cache: "no-store",
    });
  } catch {
    return { account: null };
  }
}

/** Historial de movimientos (estado de cuenta) con filtros de fecha y tipo. */
export async function listMyCreditTransactions(filters?: {
  type?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}): Promise<{ transactions: CreditTransaction[]; count: number }> {
  const headers = await authed();
  if (!headers) return { transactions: [], count: 0 };
  try {
    return await sdk.client.fetch("/store/companies/me/credit/transactions", {
      method: "GET",
      query: {
        ...(filters?.type ? { type: filters.type } : {}),
        ...(filters?.from ? { from: filters.from } : {}),
        ...(filters?.to ? { to: filters.to } : {}),
        ...(filters?.limit ? { limit: filters.limit } : {}),
        ...(filters?.offset ? { offset: filters.offset } : {}),
      },
      headers,
      cache: "no-store",
    });
  } catch {
    return { transactions: [], count: 0 };
  }
}
