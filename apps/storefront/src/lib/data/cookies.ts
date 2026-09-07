import "server-only";
import { cookies as nextCookies, headers as nextHeaders } from "next/headers";

export const getAuthHeaders = async (): Promise<
  { authorization: string } | {}
> => {
  try {
    // Primero intentar obtener el token del header inyectado por el proxy
    const headersList = await nextHeaders();
    const tokenFromHeader = headersList.get("x-medusa-jwt");
    
    if (tokenFromHeader) {
      return { authorization: `Bearer ${tokenFromHeader}` };
    }

    // Fallback: intentar leer directamente de las cookies
    const cookies = await nextCookies();
    const token = cookies.get("_medusa_jwt")?.value;

    if (!token) {
      return {};
    }

    return { authorization: `Bearer ${token}` };
  } catch {
    return {};
  }
};

export const getCacheTag = async (tag: string): Promise<string> => {
  try {
    const cookies = await nextCookies();
    const cacheId = cookies.get("_medusa_cache_id")?.value;

    if (!cacheId) {
      return "";
    }

    return `${tag}-${cacheId}`;
  } catch (error) {
    return "";
  }
};

export const getCacheOptions = async (
  tag: string
): Promise<{ tags: string[] } | {}> => {
  if (typeof window !== "undefined") {
    return {};
  }

  const cacheTag = await getCacheTag(tag);

  if (!cacheTag) {
    return {};
  }

  return { tags: [`${cacheTag}`] };
};

export const setAuthToken = async (token: string) => {
  const cookies = await nextCookies();
  cookies.set("_medusa_jwt", token, {
    maxAge: 60 * 60 * 24 * 7,
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });
};

export const removeAuthToken = async () => {
  const cookies = await nextCookies();
  cookies.set("_medusa_jwt", "", {
    maxAge: -1,
  });
};

export const getCartId = async () => {
  const cookies = await nextCookies();
  return cookies.get("_medusa_cart_id")?.value;
};

export const setCartId = async (cartId: string) => {
  const cookies = await nextCookies();
  cookies.set("_medusa_cart_id", cartId, {
    maxAge: 60 * 60 * 24 * 7,
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });
};

export const removeCartId = async () => {
  const cookies = await nextCookies();
  cookies.set("_medusa_cart_id", "", {
    maxAge: -1,
  });
};

// ── Carrito B2B (mayorista) ──────────────────────────────────────────────────
// Cookie separada del carrito B2C para que los entornos NO se mezclen: el portal
// mayorista usa su propio carrito (en el sales channel Wholesale) y su checkout.
export const getB2BCartId = async () => {
  const cookies = await nextCookies();
  return cookies.get("_b2b_cart_id")?.value;
};

export const setB2BCartId = async (cartId: string) => {
  const cookies = await nextCookies();
  cookies.set("_b2b_cart_id", cartId, {
    maxAge: 60 * 60 * 24 * 7,
    httpOnly: true,
    // Lax (no Strict) + path "/" para que viaje en la navegación al checkout.
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
};

export const removeB2BCartId = async () => {
  const cookies = await nextCookies();
  // path "/" explícito: sin él la cookie se borra en el scope de la request
  // (p.ej. /api/b2b) y no en "/", quedando una huérfana.
  cookies.set("_b2b_cart_id", "", { maxAge: -1, path: "/" });
};

// ── Sucursal (Branch) + canal resuelto ───────────────────────────────────────
// La dirección del usuario se resuelve por polígonos a una sucursal, y esa
// sucursal define el sales channel B2C activo. Persistimos ambos en cookies
// (lax + path "/" como el carrito B2B, para que viajen en toda la navegación
// incluido el checkout). El canal resuelto se cachea para no remapear en cada
// request; el branch_id queda para mostrar/usar en UI y guardarlo en el cliente.

const BRANCH_COOKIE_OPTS = {
  maxAge: 60 * 60 * 24 * 30,
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export const getBranchId = async (): Promise<string | undefined> => {
  const cookies = await nextCookies();
  return cookies.get("_branch_id")?.value;
};

export const setBranchId = async (branchId: string) => {
  const cookies = await nextCookies();
  cookies.set("_branch_id", branchId, BRANCH_COOKIE_OPTS);
};

export const removeBranchId = async () => {
  const cookies = await nextCookies();
  cookies.set("_branch_id", "", { maxAge: -1, path: "/" });
};

export const getSalesChannelIdCookie = async (): Promise<string | undefined> => {
  const cookies = await nextCookies();
  return cookies.get("_sales_channel_id")?.value;
};

export const setSalesChannelIdCookie = async (salesChannelId: string) => {
  const cookies = await nextCookies();
  cookies.set("_sales_channel_id", salesChannelId, BRANCH_COOKIE_OPTS);
};

export const removeSalesChannelIdCookie = async () => {
  const cookies = await nextCookies();
  cookies.set("_sales_channel_id", "", { maxAge: -1, path: "/" });
};

/**
 * The sales channel the storefront should use: the branch-resolved channel from
 * the cookie, or the build-time default. This is the single source of truth for
 * the active channel across the server data layer (products, cart, PDPs).
 * Never throws (returns the env default outside request scope).
 */
export const getActiveSalesChannelId = async (): Promise<string | undefined> => {
  try {
    // On a /demo/{slug} page the catalog must come from the demo's own sales
    // channel, ahead of the branch cookie / build-time default.
    const { getActiveDemoSalesChannelId } = await import(
      "@lib/site-config/active-tenant"
    );
    const demoChannel = await getActiveDemoSalesChannelId();
    if (demoChannel) return demoChannel;

    const fromCookie = await getSalesChannelIdCookie();
    return fromCookie || process.env.NEXT_PUBLIC_SALES_CHANNEL_ID;
  } catch {
    return process.env.NEXT_PUBLIC_SALES_CHANNEL_ID;
  }
};
