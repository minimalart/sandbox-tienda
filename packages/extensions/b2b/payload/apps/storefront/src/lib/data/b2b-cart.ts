"use server";

import { sdk } from "@lib/config";
import { getTenant } from "@lib/site-config/resolver";
import { getActiveDemoB2BSalesChannelId } from "@lib/site-config/active-tenant";
import {
  CART_CUSTOMER_ACCOUNT_FIELD,
  shouldTransferCartToCustomer,
} from "@lib/util/cart-customer-transfer";
import type { HttpTypes } from "@medusajs/types";
import {
  getAuthHeaders,
  getB2BCartId,
  getLoggedInCustomerId,
  removeB2BCartId,
  setB2BCartId,
} from "./cookies";
import { getMyCompany } from "./company";
import { getRegion } from "./regions";

// `+customer.has_account` es lo único que distingue un carrito que ya es de la
// cuenta de uno colgado de un customer invitado. Lo consume el self-heal de
// getOrSetB2BCart; sin el campo el criterio no puede decidir y no transfiere.
const CART_FIELDS =
  `*items, *items.variant, *items.product, *region, *shipping_address, *billing_address, *shipping_methods, *payment_collection, *payment_collection.payment_sessions, *promotions, +${CART_CUSTOMER_ACCOUNT_FIELD}`;

/**
 * Sales channel del carrito B2B: el de la empresa (la cuenta demo ya lo trae),
 * el canal mayorista del demo activo, el Wholesale por env, o el del tenant.
 */
async function b2bSalesChannelId(): Promise<string | undefined> {
  const { company } = await getMyCompany();
  if (company?.sales_channel_id) return company.sales_channel_id;
  // Dentro de un demo con B2B habilitado (navegando /demo/{slug}/b2b sin login),
  // usar el canal mayorista del demo en vez del default del store principal.
  const demoB2B = await getActiveDemoB2BSalesChannelId();
  if (demoB2B) return demoB2B;
  const tenant = await getTenant();
  return (
    process.env.NEXT_PUBLIC_WHOLESALE_SALES_CHANNEL_ID ||
    tenant.medusa?.salesChannelId ||
    process.env.NEXT_PUBLIC_SALES_CHANNEL_ID
  );
}

export async function retrieveB2BCart(): Promise<HttpTypes.StoreCart | null> {
  const id = await getB2BCartId();
  if (!id) return null;
  const headers = { ...(await getAuthHeaders()) };
  try {
    const { cart } = await sdk.store.cart.retrieve(id, { fields: CART_FIELDS }, headers);
    return cart;
  } catch {
    return null;
  }
}

/** Crea/recupera el carrito B2B (cookie _b2b_cart_id) en el sales channel de la empresa. */
export async function getOrSetB2BCart(countryCode: string): Promise<HttpTypes.StoreCart> {
  const region = await getRegion(countryCode);
  if (!region) throw new Error(`Region not found for country code: ${countryCode}`);
  const sc = await b2bSalesChannelId();
  const headers = { ...(await getAuthHeaders()) };

  let cart = await retrieveB2BCart();
  // Self-healing: cart guest con customer logueado → re-asociar (transfer).
  // "Guest" es también el cart que YA tiene customer_id de un INVITADO:
  // setB2BCartAddress guarda el email y Medusa crea ahí mismo un customer
  // `has_account: false` y lo ata al cart. El id del logueado se compara
  // contra `cart.customer_id` para no reintentar un transfer que el core ya
  // resuelve como no-op cuando el cart es del mismo customer.
  // Ver @lib/util/cart-customer-transfer.
  const loggedInCustomerId = headers.authorization
    ? await getLoggedInCustomerId()
    : undefined;
  if (
    cart &&
    !!headers.authorization &&
    shouldTransferCartToCustomer(cart, loggedInCustomerId)
  ) {
    try {
      await sdk.store.cart.transferCart(cart.id, {}, headers);
      cart = (await retrieveB2BCart()) ?? cart;
    } catch {
      // Best effort.
    }
  }
  if (!cart) {
    const { cart: created } = await sdk.store.cart.create(
      { region_id: region.id, sales_channel_id: sc, metadata: { context: "b2b" } },
      {},
      headers,
    );
    cart = created;
  } else if (cart.region_id !== region.id || (sc && cart.sales_channel_id !== sc)) {
    const { cart: upd } = await sdk.store.cart.update(
      cart.id,
      { region_id: region.id, sales_channel_id: sc },
      {},
      headers,
    );
    cart = upd;
  }
  // SIEMPRE (re)escribir la cookie con path "/", también cuando el carrito ya
  // existía. Si no, una cookie vieja scopeada a /api/b2b (seteada sin path en un
  // request al route handler) nunca se reescribe y no llega a /b2b/checkout.
  await setB2BCartId(cart.id);
  return cart;
}

/** Agrega líneas al carrito B2B y lo etiqueta con la empresa. */
export async function addB2BLineItems(
  countryCode: string,
  lines: Array<{ variant_id: string; quantity: number; presentation_mode?: "unit" | "package" }>,
  company?: { id?: string; name?: string; placed_by_id?: string; placed_by_email?: string },
): Promise<{ ok: true; cartId: string } | { ok: false; error: string }> {
  try {
    const cart = await getOrSetB2BCart(countryCode);
    const headers = { ...(await getAuthHeaders()) };
    for (const l of lines) {
      if (!Number.isSafeInteger(l.quantity) || l.quantity < 1) throw new Error("Ingresá una cantidad entera positiva.");
      if (l.presentation_mode) {
        await sdk.client.fetch(`/store/b2b/carts/${cart.id}/presentations`, { method: "POST", headers, body: { variant_id: l.variant_id, quantity: l.quantity, mode: l.presentation_mode } });
        continue;
      }
      // eslint-disable-next-line no-await-in-loop
      await sdk.store.cart.createLineItem(
        cart.id,
        { variant_id: l.variant_id, quantity: l.quantity },
        {},
        headers,
      );
    }
    await sdk.store.cart.update(
      cart.id,
      {
        metadata: {
          context: "b2b",
          ...(company?.id ? { company_id: company.id } : {}),
          ...(company?.name ? { company_name: company.name } : {}),
          ...(company?.placed_by_id ? { placed_by_customer_id: company.placed_by_id } : {}),
          ...(company?.placed_by_email ? { placed_by_email: company.placed_by_email } : {}),
        },
      },
      {},
      headers,
    );
    return { ok: true, cartId: cart.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error" };
  }
}

/**
 * Reconcilia las líneas del carrito B2B para que coincidan EXACTAMENTE con
 * `lines` (crea las nuevas, ajusta cantidades y borra las que ya no están). A
 * diferencia de `addB2BLineItems` (que suma), esto es idempotente: el order
 * builder precarga el carrito actual y al "Finalizar" sincroniza sin duplicar.
 */
export async function syncB2BCartLines(
  countryCode: string,
  lines: Array<{ variant_id: string; quantity: number; presentation_mode?: "unit" | "package" }>,
  company?: { id?: string; name?: string; placed_by_id?: string; placed_by_email?: string },
): Promise<{ ok: true; cartId: string } | { ok: false; error: string }> {
  try {
    for (const l of lines) {
      if (!Number.isSafeInteger(l.quantity) || l.quantity < 1) throw new Error("Ingresá una cantidad entera positiva.");
    }
    const base = await getOrSetB2BCart(countryCode);
    const headers = { ...(await getAuthHeaders()) };
    const metadata = b2bCartMetadata(company);

    // Una sola request: el backend agrupa altas y bajas en un workflow cada una.
    // Línea por línea (abajo) eran ~65 s con 8 SKUs. El fallback cubre el
    // storefront desplegado antes que un backend que todavía no tiene la ruta.
    try {
      await sdk.client.fetch(`/store/b2b/carts/${base.id}/sync`, {
        method: "POST",
        headers,
        body: { lines, metadata },
      });
      return { ok: true, cartId: base.id };
    } catch (e) {
      if ((e as { status?: number })?.status !== 404) throw e;
    }
    await syncB2BCartLinesOneByOne(base, lines, metadata, headers);
    return { ok: true, cartId: base.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error" };
  }
}

function b2bCartMetadata(
  company?: { id?: string; name?: string; placed_by_id?: string; placed_by_email?: string },
): Record<string, string> {
  return {
    context: "b2b",
    ...(company?.id ? { company_id: company.id } : {}),
    ...(company?.name ? { company_name: company.name } : {}),
    ...(company?.placed_by_id ? { placed_by_customer_id: company.placed_by_id } : {}),
    ...(company?.placed_by_email ? { placed_by_email: company.placed_by_email } : {}),
  };
}

async function syncB2BCartLinesOneByOne(
  base: HttpTypes.StoreCart,
  lines: Array<{ variant_id: string; quantity: number; presentation_mode?: "unit" | "package" }>,
  metadata: Record<string, string>,
  headers: Awaited<ReturnType<typeof getAuthHeaders>>,
): Promise<void> {
  const desired = new Map<string, number>();
  for (const l of lines) desired.set(l.variant_id, l.quantity);

  // Ítems actuales (getOrSetB2BCart puede devolver un carrito recién creado sin
  // items expandidos → releer con los CART_FIELDS).
  const current = await retrieveB2BCart();
  const existing = new Map<string, { id: string; quantity: number }>();
  for (const it of (current?.items ?? []) as Array<{ id: string; variant_id?: string | null; quantity: number }>) {
    if (it.variant_id) existing.set(it.variant_id, { id: it.id, quantity: it.quantity });
  }

  // Crear / actualizar.
  for (const [variant_id, quantity] of Array.from(desired.entries())) {
    const ex = existing.get(variant_id);
    const presentationMode = lines.find(l => l.variant_id === variant_id)?.presentation_mode;
    if (presentationMode) {
      await sdk.client.fetch(`/store/b2b/carts/${base.id}/presentations`, { method: "POST", headers, body: { variant_id, quantity, mode: presentationMode, replace: true } });
      continue;
    }
    if (ex) {
      if (ex.quantity !== quantity) {
        // eslint-disable-next-line no-await-in-loop
        await sdk.store.cart.updateLineItem(base.id, ex.id, { quantity }, {}, headers);
      }
    } else {
      // eslint-disable-next-line no-await-in-loop
      await sdk.store.cart.createLineItem(base.id, { variant_id, quantity }, {}, headers);
    }
  }
  // Borrar las que ya no están.
  for (const [variant_id, ex] of Array.from(existing.entries())) {
    if (!desired.has(variant_id)) {
      // eslint-disable-next-line no-await-in-loop
      await sdk.store.cart.deleteLineItem(base.id, ex.id, {}, headers);
    }
  }

  // Cada update corre el workflow entero del carrito: saltearlo si no cambió.
  const stored = (base.metadata ?? {}) as Record<string, unknown>;
  if (Object.entries(metadata).some(([k, v]) => stored[k] !== v)) {
    await sdk.store.cart.update(base.id, { metadata }, {}, headers);
  }
}

/** Actualiza la cantidad de una línea del carrito B2B. */
export async function updateB2BLineItem(
  lineId: string,
  quantity: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = await getB2BCartId();
  if (!id) return { ok: false, error: "Sin carrito" };
  const headers = { ...(await getAuthHeaders()) };
  try {
    await sdk.store.cart.updateLineItem(id, lineId, { quantity }, {}, headers);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error" };
  }
}

/** Elimina una línea del carrito B2B. */
export async function removeB2BLineItem(
  lineId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = await getB2BCartId();
  if (!id) return { ok: false, error: "Sin carrito" };
  const headers = { ...(await getAuthHeaders()) };
  try {
    await sdk.store.cart.deleteLineItem(id, lineId, {}, headers);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error" };
  }
}

export async function setB2BCartAddress(
  address: HttpTypes.StoreAddAddress,
  email: string,
) {
  const id = await getB2BCartId();
  if (!id) return { ok: false as const, error: "Sin carrito" };
  const headers = { ...(await getAuthHeaders()) };
  try {
    await sdk.store.cart.update(
      id,
      { shipping_address: address, billing_address: address, email },
      {},
      headers,
    );
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Error" };
  }
}

export async function listB2BShippingOptions() {
  const id = await getB2BCartId();
  if (!id) return [];
  const headers = { ...(await getAuthHeaders()) };
  try {
    const { shipping_options } = await sdk.store.fulfillment.listCartOptions(
      { cart_id: id },
      headers,
    );
    return shipping_options ?? [];
  } catch {
    return [];
  }
}

export async function setB2BShippingMethod(optionId: string) {
  const id = await getB2BCartId();
  if (!id) return { ok: false as const, error: "Sin carrito" };
  const headers = { ...(await getAuthHeaders()) };
  try {
    await sdk.store.cart.addShippingMethod(id, { option_id: optionId }, {}, headers);
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Error" };
  }
}

/** Aplica la lista completa de códigos de promoción al carrito B2B. */
export async function applyB2BPromotions(
  codes: string[],
): Promise<{ ok: true; cart: HttpTypes.StoreCart | null } | { ok: false; error: string }> {
  const id = await getB2BCartId();
  if (!id) return { ok: false, error: "Sin carrito" };
  const headers = { ...(await getAuthHeaders()) };
  try {
    // Medusa reemplaza toda la lista de promo_codes en cada request.
    await sdk.store.cart.update(id, { promo_codes: codes }, {}, headers);
    const cart = await retrieveB2BCart();
    return { ok: true, cart };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error" };
  }
}

/** Métodos de pago configurados para la región del carrito B2B. */
export async function listB2BPaymentProviders(): Promise<
  Array<{ id: string; is_enabled?: boolean }>
> {
  const headers = { ...(await getAuthHeaders()) };
  try {
    const cart = await retrieveB2BCart();
    if (!cart?.region_id) return [];
    const { payment_providers } = await sdk.store.payment.listPaymentProviders(
      { region_id: cart.region_id },
      headers,
    );
    return (payment_providers ?? []).sort((a, b) => (a.id > b.id ? 1 : -1));
  } catch {
    return [];
  }
}

/** Inicia la sesión de pago del carrito B2B con el provider elegido. */
export async function initiateB2BPayment(
  providerId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = await getB2BCartId();
  if (!id) return { ok: false, error: "Sin carrito" };
  const headers = { ...(await getAuthHeaders()) };
  try {
    const cart = await retrieveB2BCart();
    if (!cart) return { ok: false, error: "Sin carrito" };
    await sdk.store.payment.initiatePaymentSession(
      cart,
      { provider_id: providerId },
      {},
      headers,
    );
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error" };
  }
}

/**
 * Completa el pedido B2B. Espera que la sesión de pago ya esté iniciada
 * (initiateB2BPayment); si no la encuentra, cae al primer provider disponible
 * para no romper flujos que no pasan por el paso de pago.
 */
export async function placeB2BOrder(): Promise<
  { ok: true; orderId: string } | { ok: false; error: string }
> {
  const id = await getB2BCartId();
  if (!id) return { ok: false, error: "Sin carrito" };
  const headers = { ...(await getAuthHeaders()) };
  try {
    const cart = await retrieveB2BCart();
    if (!cart) return { ok: false, error: "Sin carrito" };

    // ¿Ya hay una sesión de pago iniciada? Si no, fallback al primer provider.
    const sessions =
      (cart.payment_collection as { payment_sessions?: Array<{ status?: string }> } | null)
        ?.payment_sessions ?? [];
    const hasSession = sessions.some((s) => s.status === "pending");
    if (!hasSession) {
      const { payment_providers } = await sdk.store.payment.listPaymentProviders(
        { region_id: cart.region_id! },
        headers,
      );
      const providerId = payment_providers?.[0]?.id;
      if (!providerId) return { ok: false, error: "No hay métodos de pago configurados para la región." };
      await sdk.store.payment.initiatePaymentSession(cart, { provider_id: providerId }, {}, headers);
    }

    const res = await sdk.store.cart.complete(id, {}, headers);
    if (res.type === "order") {
      await removeB2BCartId();
      return { ok: true, orderId: res.order.id };
    }
    return { ok: false, error: (res as { error?: { message?: string } }).error?.message ?? "No se pudo completar el pedido." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error" };
  }
}

export async function clearB2BCart() {
  await removeB2BCartId();
}

/**
 * Lista los pedidos del cliente filtrados al sales channel mayorista (Wholesale).
 * `listOrders` del B2C filtra por el SC del tenant (default) y deja afuera los
 * pedidos B2B, por eso "Mis pedidos" salía vacío.
 */
export async function listB2BOrders(limit = 50): Promise<HttpTypes.StoreOrder[]> {
  const headers = { ...(await getAuthHeaders()) };
  const sc = await b2bSalesChannelId();
  try {
    const { orders } = await sdk.client.fetch<HttpTypes.StoreOrderListResponse>(
      "/store/orders",
      {
        method: "GET",
        query: {
          limit: 100,
          offset: 0,
          order: "-created_at",
          fields:
            "*items,*items.variant,*items.product,sales_channel_id,status,payment_status,fulfillment_status,total,currency_code,display_id,created_at",
        },
        headers,
        cache: "no-store",
      },
    );
    const filtered = (orders ?? []).filter((o) => !sc || o.sales_channel_id === sc);
    return filtered.slice(0, limit);
  } catch {
    return [];
  }
}

/** Recupera una orden B2B por id, validando que sea del sales channel mayorista. */
export async function retrieveB2BOrder(id: string): Promise<HttpTypes.StoreOrder | null> {
  const headers = { ...(await getAuthHeaders()) };
  const sc = await b2bSalesChannelId();
  try {
    const { order } = await sdk.client.fetch<HttpTypes.StoreOrderResponse>(
      `/store/orders/${id}`,
      {
        method: "GET",
        query: {
          fields:
            "+metadata,+custom_display_id,*items,*items.variant,*items.product,*shipping_address,*shipping_methods,*payment_collections.payments,+fulfillments,+fulfillments.tracking_links,subtotal,shipping_total,tax_total,discount_total,total,currency_code,status,payment_status,fulfillment_status,display_id,created_at,sales_channel_id",
        },
        headers,
        cache: "no-store",
      },
    );
    // La store API ya scopea /store/orders/:id al cliente autenticado; este check
    // evita además ver una orden B2C por id desde el portal mayorista.
    if (sc && order.sales_channel_id && order.sales_channel_id !== sc) return null;
    return order;
  } catch {
    return null;
  }
}
