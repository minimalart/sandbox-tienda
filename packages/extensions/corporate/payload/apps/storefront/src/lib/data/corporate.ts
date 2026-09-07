"use server";

import { sdk } from "@lib/config";
import { getTenant } from "@lib/site-config/resolver";
import { revalidateTag } from "next/cache";
import { getAuthHeaders, getCacheTag, setAuthToken } from "./cookies";

export type CorporateRole = "owner" | "admin" | "buyer" | "viewer";

export type CorporateMember = {
  id: string;
  customer_id: string;
  role: CorporateRole;
  status: "invited" | "active" | "disabled";
  joined_at?: string | null;
};

export type CorporateRule = {
  id: string;
  type: string;
  config: Record<string, unknown>;
  enabled: boolean;
};

export type Corporate = {
  id: string;
  name: string;
  slug: string;
  legal_name?: string | null;
  tax_id?: string | null;
  email_domain?: string | null;
  status: "pending" | "active" | "suspended" | "archived";
  customer_group_id?: string | null;
};

export type MyCorporate = {
  corporate: Corporate | null;
  membership: { id: string; role: CorporateRole; status: string } | null;
  role?: CorporateRole;
  members?: CorporateMember[];
  rules?: CorporateRule[];
};

/** Empresa del customer autenticado (o null si no pertenece a ninguna). */
export async function getMyCorporate(): Promise<MyCorporate> {
  const authHeaders = await getAuthHeaders();
  if (!authHeaders || Object.keys(authHeaders).length === 0) {
    return { corporate: null, membership: null };
  }
  try {
    return await sdk.client.fetch<MyCorporate>("/store/corporates/me", {
      method: "GET",
      headers: { ...authHeaders },
      cache: "no-store",
    });
  } catch {
    return { corporate: null, membership: null };
  }
}

/**
 * Registra una empresa: crea el customer dueño (patrón signup) y luego la empresa.
 * Devuelve { ok } o { error }.
 */
export async function registerCorporate(input: {
  email: string;
  password: string;
  contact_name: string;
  company_name: string;
  legal_name?: string;
  tax_id?: string;
  tax_condition?: string;
  email_domain?: string;
  employee_count?: string;
  industry?: string;
}): Promise<{ ok: true } | { error: string }> {
  try {
    const tenant = await getTenant();
    const [first_name, ...rest] = input.contact_name.trim().split(" ");
    const last_name = rest.join(" ") || first_name;

    // Alta o login: si la identidad ya existe (intento previo), intentamos
    // loguear con la misma contraseña y continuamos (flujo reanudable).
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
          "Ese email ya tiene una cuenta. Iniciá sesión (o usá otro email) y registrá la empresa desde tu cuenta.",
      };
    }
    await setAuthToken(loginToken);
    const headers = { ...(await getAuthHeaders()) };

    // Crear el customer si todavía no existe (si ya existe, lo ignoramos).
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
      await sdk.client.fetch("/store/corporates/register", {
        method: "POST",
        headers,
        body: {
          name: input.company_name,
          legal_name: input.legal_name || null,
          tax_id: input.tax_id || null,
          email_domain: input.email_domain || null,
          metadata: {
            employee_count: input.employee_count || null,
            industry: input.industry || null,
            tax_condition: input.tax_condition || null,
          },
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/pertenece a una empresa|already/i.test(msg)) {
        return {
          error: "Ya tenés una empresa registrada. Entrá a “Mi cuenta → Mi Empresa”.",
        };
      }
      throw e;
    }

    const tag = await getCacheTag("customers");
    if (tag) revalidateTag(tag, "max");
    return { ok: true };
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

/** Info pública de una invitación (para la pantalla de aceptación). */
export async function getInvitation(token: string): Promise<{
  email: string;
  role: CorporateRole;
  status: string;
  corporate_name: string | null;
  valid: boolean;
} | null> {
  try {
    const { invitation } = await sdk.client.fetch<{
      invitation: {
        email: string;
        role: CorporateRole;
        status: string;
        corporate_name: string | null;
        valid: boolean;
      };
    }>(`/store/corporate-invitations/${encodeURIComponent(token)}`, {
      method: "GET",
      cache: "no-store",
    });
    return invitation;
  } catch {
    return null;
  }
}

/** Acepta una invitación con el customer autenticado. */
export async function acceptInvitation(
  token: string,
): Promise<{ ok: true } | { error: string }> {
  try {
    const headers = { ...(await getAuthHeaders()) };
    await sdk.client.fetch("/store/corporates/invitations/accept", {
      method: "POST",
      headers,
      body: { token },
    });
    const tag = await getCacheTag("customers");
    if (tag) revalidateTag(tag, "max");
    return { ok: true };
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

/** Invita a un empleado (owner/admin). */
export async function inviteMember(
  email: string,
  role: CorporateRole,
): Promise<{ ok: true } | { error: string }> {
  try {
    const headers = { ...(await getAuthHeaders()) };
    await sdk.client.fetch("/store/corporates/invitations", {
      method: "POST",
      headers,
      body: { email, role },
    });
    return { ok: true };
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

/** Actualiza un miembro (rol/estado). */
export async function updateMember(
  memberId: string,
  body: { role?: CorporateRole; status?: "active" | "disabled" },
): Promise<{ ok: true } | { error: string }> {
  try {
    const headers = { ...(await getAuthHeaders()) };
    await sdk.client.fetch(`/store/corporates/members/${memberId}`, {
      method: "POST",
      headers,
      body,
    });
    return { ok: true };
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

/** Quita un miembro. */
export async function removeMember(
  memberId: string,
): Promise<{ ok: true } | { error: string }> {
  try {
    const headers = { ...(await getAuthHeaders()) };
    await sdk.client.fetch(`/store/corporates/members/${memberId}`, {
      method: "DELETE",
      headers,
    });
    return { ok: true };
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

/** Valida un carrito contra las reglas de la empresa. */
export async function validateCorporateCart(
  cartId: string,
): Promise<{ ok: boolean; violations: Array<{ type: string; message: string }> }> {
  const authHeaders = await getAuthHeaders();
  if (!authHeaders || Object.keys(authHeaders).length === 0) {
    return { ok: true, violations: [] };
  }
  try {
    return await sdk.client.fetch(`/store/corporates/me/validate-cart`, {
      method: "GET",
      query: { cart_id: cartId },
      headers: { ...authHeaders },
      cache: "no-store",
    });
  } catch {
    return { ok: true, violations: [] };
  }
}
