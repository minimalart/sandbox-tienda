"use server";

import { sdk } from "@lib/config";
import { getTenant } from "@lib/site-config/resolver";
import { revalidateTag } from "next/cache";
import { getAuthHeaders, getCacheTag, setAuthToken } from "./cookies";

export type CompanyRole = "owner" | "admin" | "buyer" | "viewer";

export type CompanyMember = {
  id: string;
  customer_id: string;
  role: CompanyRole;
  status: "invited" | "active" | "disabled";
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

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
};

export type CompanyBilling = {
  /** Espejo de company.legal_name: se escribe al guardar, no se pide dos veces. */
  legal_name?: string;
  /** Espejo de company.tax_id (misma razón que legal_name). */
  tax_id?: string;
  tax_condition?: string;
  billing_email?: string;
  billing_phone?: string;
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  province?: string;
  postal_code?: string;
  /** Punto del mapa del domicilio fiscal (mismo formato que CompanyAddress). */
  lat?: string;
  lng?: string;
};

export type CompanyAddress = {
  id: string;
  label: string;
  address_line_1: string;
  address_line_2?: string;
  city: string;
  province: string;
  postal_code: string;
  phone?: string;
  contact_name?: string;
  lat?: string;
  lng?: string;
};

export type MyCompany = {
  company: Company | null;
  membership: { id: string; role: CompanyRole; status: string } | null;
  role?: CompanyRole;
  members?: CompanyMember[];
};

export type ResolvedLine = {
  variant_id: string;
  sku: string | null;
  title: string;
  quantity: number;
  available: number;
  unit_price: number | null;
};

export type ResolveResult = {
  resolved: ResolvedLine[];
  out_of_stock: Array<{ sku: string | null; variant_id: string; available: number; quantity: number }>;
  not_found: string[];
};

type Result<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function authed() {
  const h = await getAuthHeaders();
  return Object.keys(h).length ? h : null;
}

export async function getMyCompany(): Promise<MyCompany> {
  const headers = await authed();
  if (!headers) return { company: null, membership: null };
  try {
    return await sdk.client.fetch<MyCompany>("/store/companies/me", {
      method: "GET",
      headers,
      cache: "no-store",
    });
  } catch {
    return { company: null, membership: null };
  }
}

/**
 * Registra una empresa mayorista: crea el customer dueño (patrón signup) y
 * luego la empresa (módulo Company). Flujo reanudable si el email ya existe.
 */
export async function registerCompany(input: {
  email: string;
  password: string;
  contact_name: string;
  company_name: string;
  legal_name?: string;
  tax_id?: string;
  tax_condition?: string;
}): Promise<{ ok: true } | { error: string }> {
  try {
    const tenant = await getTenant();
    const [first_name, ...rest] = input.contact_name.trim().split(" ");
    const last_name = rest.join(" ") || first_name;

    // Alta o login: si la identidad ya existe (intento previo), logueamos.
    let registered = false;
    try {
      await sdk.auth.register("customer", "emailpass", {
        email: input.email,
        password: input.password,
      });
      registered = true;
    } catch {
      // ya existe → seguimos por login abajo
    }

    let loginToken: string;
    try {
      loginToken = (await sdk.auth.login("customer", "emailpass", {
        email: input.email,
        password: input.password,
      })) as string;
    } catch {
      return {
        error:
          "Ese email ya tiene una cuenta. Iniciá sesión (o usá otro email) y registrá la empresa desde el portal.",
      };
    }
    await setAuthToken(loginToken);
    const headers = { ...(await getAuthHeaders()) };

    // Crear el customer si todavía no existe.
    try {
      await sdk.store.customer.create(
        {
          email: input.email,
          first_name: first_name || input.contact_name,
          last_name,
          metadata: { tenant_id: tenant.id },
        },
        {},
        headers,
      );
    } catch {
      if (registered) throw new Error("No se pudo crear el cliente.");
      // si no es nuevo, probablemente el customer ya existía → seguimos
    }

    try {
      await sdk.client.fetch("/store/companies/register", {
        method: "POST",
        headers,
        body: {
          name: input.company_name,
          legal_name: input.legal_name || null,
          tax_id: input.tax_id || null,
          // Condición IVA (de ARCA o elegida a mano) en metadata: el modelo
          // company no tiene columna propia y así no requiere migración.
          metadata: input.tax_condition
            ? { tax_condition: input.tax_condition }
            : null,
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/pertenece a una empresa|already/i.test(msg)) {
        return {
          error: "Ya tenés una empresa registrada. Entrá al portal mayorista.",
        };
      }
      throw e;
    }

    const tag = await getCacheTag("customers");
    if (tag) revalidateTag(tag, "max");
    return { ok: true };
  } catch (error: unknown) {
    return { error: errMsg(error) };
  }
}

export type B2BPriceInfo = { unit_price: number | null; currency_code?: string; price_tax_included?: boolean; available: number; commercial?: import("@lib/util/catalog-commercial").CatalogCommercial };

/** Precios mayoristas + stock para un set de productos (los que devuelve Typesense). */
export async function b2bPrices(
  productIds: string[],
): Promise<Record<string, B2BPriceInfo>> {
  if (!productIds.length) return {};
  const headers = await authed();
  if (!headers) return {};
  try {
    const r = await sdk.client.fetch<{ prices: Record<string, B2BPriceInfo> }>(
      `/store/b2b/prices`,
      { method: "POST", headers, body: { product_ids: productIds }, cache: "no-store" },
    );
    return r.prices ?? {};
  } catch {
    return {};
  }
}

export async function quickOrder(
  lines: Array<{ sku?: string; variant_id?: string; quantity: number }>,
): Promise<ResolveResult> {
  const headers = await authed();
  if (!headers) return { resolved: [], out_of_stock: [], not_found: [] };
  return sdk.client.fetch(`/store/b2b/quick-order`, { method: "POST", headers, body: { lines } });
}

export async function importOrder(
  lines: Array<{ sku: string; quantity: number }>,
): Promise<ResolveResult> {
  const headers = await authed();
  if (!headers) return { resolved: [], out_of_stock: [], not_found: [] };
  return sdk.client.fetch(`/store/b2b/import-order`, { method: "POST", headers, body: { lines } });
}

export async function reorder(orderId: string): Promise<ResolveResult> {
  const headers = await authed();
  if (!headers) return { resolved: [], out_of_stock: [], not_found: [] };
  return sdk.client.fetch(`/store/b2b/reorder`, {
    method: "POST",
    headers,
    body: { order_id: orderId },
  });
}

export async function inviteCompanyMember(
  email: string,
  role: CompanyRole,
): Promise<Result> {
  try {
    const headers = { ...(await getAuthHeaders()) };
    await sdk.client.fetch(`/store/companies/me/invitations`, {
      method: "POST",
      headers,
      body: { email, role },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function updateCompanyMember(
  memberId: string,
  body: { role?: CompanyRole; status?: "active" | "disabled" },
): Promise<Result> {
  try {
    const headers = { ...(await getAuthHeaders()) };
    await sdk.client.fetch(`/store/companies/members/${memberId}`, { method: "POST", headers, body });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function removeCompanyMember(memberId: string): Promise<Result> {
  try {
    const headers = { ...(await getAuthHeaders()) };
    await sdk.client.fetch(`/store/companies/members/${memberId}`, { method: "DELETE", headers });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

/** Sube el logo de la empresa (base64) — solo owner/admin. Devuelve la URL. */
export async function uploadCompanyLogo(
  filename: string,
  mimeType: string,
  content: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  try {
    const headers = { ...(await getAuthHeaders()) };
    const r = await sdk.client.fetch<{ url: string }>("/store/companies/me/logo", {
      method: "POST",
      headers,
      body: { filename, mimeType, content },
    });
    return { ok: true, url: r.url };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

/** Actualiza datos de la empresa (solo owner/admin; gateado en el backend). */
export async function updateMyCompany(body: {
  name?: string;
  legal_name?: string | null;
  tax_id?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<Result> {
  try {
    const headers = { ...(await getAuthHeaders()) };
    await sdk.client.fetch(`/store/companies/me`, { method: "POST", headers, body });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

/**
 * Agrega una dirección a la empresa (metadata.addresses), mergeando sobre el
 * metadata actual para no pisar facturación/logo. Best-effort y idempotente por
 * domicilio+CP: si ya existe una equivalente, no la duplica. Requiere rol
 * owner/admin (gateado en el backend); para buyers devuelve el error tal cual.
 *
 * La usa el checkout B2B para que la dirección tipeada en el mapa quede guardada
 * como dirección de la empresa (antes solo se mandaba al carrito y se perdía).
 */
export async function addCompanyAddress(
  addr: Omit<CompanyAddress, "id">,
): Promise<Result> {
  try {
    if (!addr.address_line_1?.trim()) return { ok: false, error: "Domicilio requerido." };
    const { company } = await getMyCompany();
    if (!company) return { ok: false, error: "Sin empresa." };
    const metadata = (company.metadata ?? {}) as Record<string, unknown>;
    const addresses = (metadata.addresses as CompanyAddress[] | undefined) ?? [];
    const norm = (s?: string) => (s ?? "").trim().toLowerCase();
    const dup = addresses.some(
      (a) =>
        norm(a.address_line_1) === norm(addr.address_line_1) &&
        norm(a.postal_code) === norm(addr.postal_code),
    );
    if (dup) return { ok: true };
    const id = `addr_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const next = [...addresses, { ...addr, id }];
    return await updateMyCompany({ metadata: { ...metadata, addresses: next } });
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function getCompanyInvitation(token: string): Promise<{
  email: string;
  role: CompanyRole;
  status: string;
  company_name: string | null;
  valid: boolean;
} | null> {
  try {
    const { invitation } = await sdk.client.fetch<{ invitation: any }>(
      `/store/company-invitations/${encodeURIComponent(token)}`,
      { method: "GET", cache: "no-store" },
    );
    return invitation;
  } catch {
    return null;
  }
}

export async function acceptCompanyInvitation(token: string): Promise<Result> {
  try {
    const headers = { ...(await getAuthHeaders()) };
    await sdk.client.fetch(`/store/companies/invitations/accept`, {
      method: "POST",
      headers,
      body: { token },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
