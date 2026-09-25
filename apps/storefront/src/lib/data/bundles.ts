"use server";

import { getMedusaSDK } from "@lib/config";
import { getActiveTenant } from "@lib/site-config/active-tenant";
import { getAuthHeaders, getCacheOptions } from "./cookies";

/**
 * Contracts mirror the backend `GET /store/bundles/*` and
 * `POST /store/bundles/confirm` routes. `Product` / `Variant` shapes are
 * intentionally a subset of Medusa's own types — bundles never consume more
 * than what the wizard needs to render.
 */

export interface StorefrontBundleSummary {
  id: string;
  title: string;
  handle: string;
  description: string | null;
  thumbnail: string | null;
  status: "published";
  updated_at: string;
  /**
   * Orden ESTABLE del listado. `updated_at` (por el que ordena el backend) se
   * mueve cada vez que alguien edita un bundle, y con él cambiaría el tono de
   * la card; `created_at` no cambia nunca (PRD V2 §34).
   */
  created_at: string;
}

export interface StorefrontVariant {
  id: string;
  title: string | null;
  sku: string | null;
  options: Record<string, string>;
  calculated_price: { amount: number; currency_code: string } | null;
  inventory_available: boolean;
  allow_backorder: boolean;
  manage_inventory: boolean;
}

export interface StorefrontBundleProduct {
  id: string;
  title: string;
  handle: string;
  thumbnail: string | null;
  status: string;
  options: Array<{ id: string; title: string; values: string[] }>;
  variants: StorefrontVariant[];
}

export interface StorefrontBundleItem {
  id: string;
  quantity: number;
  position: number;
  product_id: string;
  product: StorefrontBundleProduct | null;
  auto_resolved_variant_id: string | null;
}

export interface StorefrontBundleDetail extends StorefrontBundleSummary {
  items: StorefrontBundleItem[];
  pricing: {
    from: { amount: number; currency_code: string } | null;
    all_configurable: boolean;
  };
  store_context: {
    active_store_id: string | null;
    region_id: string | null;
    currency_code: string | null;
    sales_channel_id: string | null;
  } | null;
}

/**
 * Query string con `sales_channel_id` del tenant activo, cuando el tenant lo
 * expone. Es el eje de scoping que consume `resolveActiveBundleStore` en el
 * backend — mismo patrón que ya usan blog, banners, marcas, videos, etc.
 *
 * **`getActiveTenant()` y NO `getTenant()`.** El resolver ESTÁTICO devuelve
 * `defaultConfig` (site-config/default.ts) con el `salesChannelId` del site
 * principal — desde /tienda/{slug}/* devolvería el sc de main en vez del sc
 * de la tienda hija que está haciendo el request, y volveríamos a caer al
 * fallback por pk que no disambigua. Es el mismo bug que documentó
 * `products/[handle]/page.tsx` para el SEO del PDP.
 *
 * Sin este parámetro, el backend cae al fallback `siteFromPublishableKey`,
 * que en el boilerplate real (donde una pk sirve a N sales channels)
 * resuelve al primer site del listado — típicamente NO al de la tienda hija.
 */
const buildScopeParam = async (): Promise<string> => {
  try {
    const tenant = await getActiveTenant();
    const scId = tenant.medusa?.salesChannelId;
    return scId ? `?sales_channel_id=${encodeURIComponent(scId)}` : "";
  } catch {
    return "";
  }
};

export const listBundles = async (): Promise<{
  bundles: StorefrontBundleSummary[];
  count: number;
}> => {
  const sdk = await getMedusaSDK();
  const scope = await buildScopeParam();
  const headers = { ...(await getAuthHeaders()) };
  const next = { ...(await getCacheOptions("bundles")) };
  return sdk.client.fetch(`/store/bundles${scope}`, {
    method: "GET",
    headers,
    next,
  });
};

/**
 * Detalle de un bundle por handle — o por id.
 *
 * El endpoint resuelve por handle, pero los line items creados antes de que el
 * workflow estampara `bundle_handle` sólo conocen el `bundle_id`. Sin este
 * fallback, "Editar" desde el carrito de un kit viejo lleva a un 404; con él, el
 * link funciona igual y no hay que migrar metadata de carritos vivos.
 */
export const getBundle = async (
  handleOrId: string,
): Promise<StorefrontBundleDetail | null> => {
  const sdk = await getMedusaSDK();
  const scope = await buildScopeParam();
  const headers = { ...(await getAuthHeaders()) };
  const next = { ...(await getCacheOptions("bundles")) };
  const fetchByHandle = async (handle: string) => {
    const { bundle } = await sdk.client.fetch<{ bundle: StorefrontBundleDetail }>(
      `/store/bundles/${encodeURIComponent(handle)}${scope}`,
      { method: "GET", headers, next },
    );
    return bundle;
  };

  try {
    return await fetchByHandle(handleOrId);
  } catch {
    // Sólo vale la pena el segundo viaje cuando parece un id de bundle: para un
    // handle inexistente el listado no va a aportar nada.
    if (!handleOrId.startsWith("bndl_")) return null;
    try {
      const { bundles } = await listBundles();
      const match = bundles.find((bundle) => bundle.id === handleOrId);
      return match ? await fetchByHandle(match.handle) : null;
    } catch {
      return null;
    }
  }
};

export const confirmBundle = async (input: {
  bundle_id: string;
  cart_id: string;
  selections: { bundle_item_id: string; variant_id: string }[];
}): Promise<{
  cart_id: string;
  bundle_instance_id: string;
  added_line_item_ids: string[];
}> => {
  // confirm NO recibe scope por query: el workflow deriva la Store desde
  // `cart.sales_channel_id` server-side. El cart nació con el canal que la
  // pk autoriza y no se puede spoofear.
  const sdk = await getMedusaSDK();
  const headers = { ...(await getAuthHeaders()) };
  return sdk.client.fetch("/store/bundles/confirm", {
    method: "POST",
    headers,
    body: input,
  });
};

/**
 * Reemplaza los line items de una instancia existente del bundle en el
 * carrito, preservando el `bundle_instance_id`. Ver `reconfigureBundleWorkflow`
 * en el backend — atómico: agrega los nuevos primero, si succeed elimina los
 * viejos. En failure del add, el estado del carrito no cambia.
 */
export const reconfigureBundle = async (input: {
  bundle_id: string;
  cart_id: string;
  bundle_instance_id: string;
  selections: { bundle_item_id: string; variant_id: string }[];
}): Promise<{
  cart_id: string;
  bundle_instance_id: string;
  added_line_item_ids: string[];
  removed_line_item_ids: string[];
  warnings: string[];
}> => {
  const sdk = await getMedusaSDK();
  const headers = { ...(await getAuthHeaders()) };
  return sdk.client.fetch("/store/bundles/reconfigure", {
    method: "POST",
    headers,
    body: input,
  });
};

/**
 * Saca un kit entero del carrito en UNA llamada. El backend resuelve las
 * líneas de la instancia y las borra juntas con `deleteLineItemsWorkflow`
 * (un lock y un recálculo de totales, en vez de uno por producto).
 */
export const removeBundleInstanceFromCart = async (input: {
  cart_id: string;
  bundle_instance_id: string;
}): Promise<{
  cart_id: string;
  bundle_instance_id: string;
  removed_line_item_ids: string[];
}> => {
  const sdk = await getMedusaSDK();
  const headers = { ...(await getAuthHeaders()) };
  return sdk.client.fetch("/store/bundles/remove", {
    method: "POST",
    headers,
    body: input,
  });
};
