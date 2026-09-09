import "server-only";

import { sdk } from "@lib/config";
import { getAuthHeaders } from "./cookies";

export type TaxCondition =
  | "responsable_inscripto"
  | "monotributo"
  | "exento"
  | "consumidor_final";

export type BillingProfile = {
  id: string;
  label: string;
  invoice_type: string;
  tax_condition: TaxCondition;
  document_type: string;
  document_number: string;
  legal_name: string;
  billing_email: string;
  billing_phone?: string | null;
  address_line_1: string;
  address_line_2?: string | null;
  city: string;
  province: string;
  postal_code: string;
  country_code: string;
  is_default: boolean;
};

export type BillingFields = {
  label?: string;
  tax_condition: TaxCondition;
  document_type?: "CUIT";
  document_number: string;
  legal_name: string;
  billing_email: string;
  billing_phone?: string | null;
  address_line_1: string;
  address_line_2?: string | null;
  city: string;
  province: string;
  postal_code: string;
  country_code?: string;
  /** Verificación "Buscar en ARCA" (informativa, por compra; ver backend). */
  arca_verified?: boolean;
  arca_verified_at?: string | null;
  arca_lookup_cuit?: string | null;
};

type Result<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Perfiles del customer autenticado (vacío si guest). */
export async function listBillingProfiles(): Promise<BillingProfile[]> {
  const authHeaders = await getAuthHeaders();
  if (!authHeaders || !authHeaders.authorization) return [];
  try {
    const { billing_profiles } = await sdk.client.fetch<{
      billing_profiles: BillingProfile[];
    }>("/store/billing-profiles", {
      method: "GET",
      headers: { ...authHeaders },
      cache: "no-store",
    });
    return billing_profiles ?? [];
  } catch {
    return [];
  }
}

export async function createBillingProfile(
  data: BillingFields & { is_default?: boolean },
): Promise<Result<BillingProfile>> {
  try {
    const headers = { ...(await getAuthHeaders()) };
    const { billing_profile } = await sdk.client.fetch<{
      billing_profile: BillingProfile;
    }>("/store/billing-profiles", { method: "POST", headers, body: data });
    return { ok: true, data: billing_profile };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function updateBillingProfile(
  id: string,
  data: Partial<BillingFields> & { is_default?: boolean },
): Promise<Result<BillingProfile>> {
  try {
    const headers = { ...(await getAuthHeaders()) };
    const { billing_profile } = await sdk.client.fetch<{
      billing_profile: BillingProfile;
    }>(`/store/billing-profiles/${id}`, { method: "POST", headers, body: data });
    return { ok: true, data: billing_profile };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function deleteBillingProfile(id: string): Promise<Result> {
  try {
    const headers = { ...(await getAuthHeaders()) };
    await sdk.client.fetch(`/store/billing-profiles/${id}`, {
      method: "DELETE",
      headers,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function setDefaultBillingProfile(id: string): Promise<Result> {
  try {
    const headers = { ...(await getAuthHeaders()) };
    await sdk.client.fetch(`/store/billing-profiles/${id}/default`, {
      method: "POST",
      headers,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export type CartBillingPayload =
  | { billing_profile_id: string }
  | { invoice_type: "invoice_a"; billing_data: BillingFields }
  | { invoice_type: "final_consumer" };

/** Asocia datos de facturación al cart (snapshot resuelto server-side). */
export async function associateCartBillingProfile(
  cartId: string,
  payload: CartBillingPayload,
): Promise<Result> {
  try {
    const headers = { ...(await getAuthHeaders()) };
    await sdk.client.fetch(`/store/carts/${cartId}/billing-profile`, {
      method: "POST",
      headers,
      body: payload,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
