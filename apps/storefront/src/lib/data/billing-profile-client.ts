/**
 * Wrappers de cliente para los perfiles de facturación (Factura A).
 *
 * POR QUÉ existe este archivo: las funciones de `./billing-profile` son código
 * server-only (usan cookies() + el SDK con el JWT). Antes se exponían como
 * Server Actions ("use server") e se invocaban directamente desde componentes
 * cliente. Eso rompía: un Server Action invocado desde el cliente hace POST a la
 * URL de la página (/checkout, /account/...), el middleware reescribe esa URL
 * limpia a /<countryCode>/... y el header `x-middleware-rewrite` en la respuesta
 * hace que `fetchServerAction` (Next) la rechace con
 * "An unexpected response was received from the server.".
 *
 * La solución: el cliente le pega a route handlers bajo /api (que el matcher del
 * middleware EXCLUYE, así que no hay rewrite), y esos handlers llaman a las
 * funciones server-only. Mismo patrón que el resto del checkout.
 */
import type {
  BillingFields,
  BillingProfile,
  CartBillingPayload,
} from "./billing-profile";

export type {
  BillingFields,
  BillingProfile,
  CartBillingPayload,
  TaxCondition,
} from "./billing-profile";

type Result<T = unknown> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function postJson<T>(url: string, body: unknown): Promise<Result<T>> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return (await res.json()) as Result<T>;
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

/** Perfiles del customer autenticado (vacío si guest o ante error). */
export async function listBillingProfiles(): Promise<BillingProfile[]> {
  try {
    const res = await fetch("/api/store/billing-profiles");
    if (!res.ok) return [];
    const data = await res.json();
    return data.billing_profiles ?? [];
  } catch {
    return [];
  }
}

export async function createBillingProfile(
  data: BillingFields & { is_default?: boolean },
): Promise<Result<BillingProfile>> {
  return postJson("/api/store/billing-profiles", data);
}

export async function updateBillingProfile(
  id: string,
  data: Partial<BillingFields> & { is_default?: boolean },
): Promise<Result<BillingProfile>> {
  return postJson(`/api/store/billing-profiles/${id}`, data);
}

export async function deleteBillingProfile(id: string): Promise<Result> {
  try {
    const res = await fetch(`/api/store/billing-profiles/${id}`, {
      method: "DELETE",
    });
    return (await res.json()) as Result;
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function setDefaultBillingProfile(id: string): Promise<Result> {
  return postJson(`/api/store/billing-profiles/${id}/default`, {});
}

/**
 * Asocia datos de facturación al cart. El `cartId` se mantiene en la firma para
 * compatibilidad con los call sites, pero el server lo resuelve desde la cookie.
 */
export async function associateCartBillingProfile(
  _cartId: string,
  payload: CartBillingPayload,
): Promise<Result> {
  return postJson("/api/store/cart/billing-profile", payload);
}
