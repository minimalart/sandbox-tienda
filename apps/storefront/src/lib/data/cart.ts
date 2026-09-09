"use server";

import { sdk } from "@lib/config";
import { getActiveDemoSlug } from "@lib/site-config/active-tenant";
import { getActiveSitePrefix } from "@lib/site-config/active-tenant";
import { withSitePrefix } from "@lib/site-config/site-path";
import medusaError from "@lib/util/medusa-error";
import type { HttpTypes } from "@medusajs/types";
import { sanitizeCartGiftCardCodes } from "@lib/util/gift-card-cart";
import { revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import {
  getActiveSalesChannelId,
  getAuthHeaders,
  getCacheOptions,
  getCacheTag,
  getCartId,
  removeCartId,
  setCartId,
} from "./cookies";
import { getRegion } from "./regions";
import {
  buildB2CCartMetadata,
  hasB2CMetadata,
  hasB2BMetadata,
} from "@lib/util/b2c-metadata-builder";
import {
  enrichCartWithInventory,
  syncGuestCustomerProfileFromCartBeforeComplete,
  syncGuestCustomerProfileFromOrder,
} from "@lib/repositories/cart.repository";
import {
  CART_CUSTOMER_ACCOUNT_FIELD,
  shouldTransferCartToCustomer,
} from "@lib/util/cart-customer-transfer";
import {
  buildManualPromoCodesMetadata,
  hydrateCartPromotionsFromMetadata,
} from "@lib/util/cart-promotion-metadata";

/**
 * Retrieves a cart by its ID. If no ID is provided, it will use the cart ID from the cookies.
 * @param cartId - optional - The ID of the cart to retrieve.
 * @returns The cart object if found, or null if not found.
 */
export async function retrieveCart(cartId?: string) {
  const id = cartId || (await getCartId());

  if (!id) {
    return null;
  }

  const headers = {
    ...(await getAuthHeaders()),
  };

  const next = {
    ...(await getCacheOptions("carts")),
  };

  return await sdk.client
    .fetch<HttpTypes.StoreCartResponse>(`/store/carts/${id}`, {
      method: "GET",
      query: {
        // `+customer.has_account` no es cosmético: es lo único que distingue un
        // carrito que ya es de la cuenta de uno colgado de un customer invitado.
        // Lo consume shouldTransferCartToCustomer (self-heal de getOrSetCart y
        // CartMismatchBanner, que recibe este mismo cart por props desde el
        // layout). Sin el campo, el criterio no puede decidir y no transfiere.
        fields: `+metadata, *items, *region, *items.product, +items.product.metadata, *items.variant, +items.variant.metadata, *items.thumbnail, *items.metadata, +items.total, +items.subtotal, +items.original_total, +items.unit_price, +items.quantity, *promotions, +shipping_methods.name, *payment_collection, *payment_collection.payment_sessions, +${CART_CUSTOMER_ACCOUNT_FIELD}`,
      },
      headers,
      next,
      cache: "no-store", // No cachear para obtener siempre el estado actual del carrito
    })
    .then(async (response) => {
      if (!response.cart) return null;
      const cart = await enrichCartWithInventory(response.cart);
      return sanitizeCartGiftCardCodes(hydrateCartPromotionsFromMetadata(cart));
    })
    .catch(() => null);
}

/**
 * Repara un cart que quedó como guest teniendo al customer logueado (pasa
 * cuando el cart nació antes del login y el transferCart del login falló o no
 * corrió; nada más lo re-asocia después). Sin cart huérfano es un no-op.
 * Necesario p.ej. para asociar perfiles de facturación: el backend valida
 * profile.customer_id === cart.customer_id.
 *
 * "Guest" incluye el cart que YA tiene customer_id, pero de un customer
 * invitado: setAddresses guarda el email y Medusa crea ahí mismo un customer
 * `has_account: false` y lo ata al cart. Ver cart-customer-transfer.ts.
 */
export async function ensureCartCustomer(cartId?: string): Promise<void> {
  const id = cartId || (await getCartId());
  if (!id) return;
  const headers = { ...(await getAuthHeaders()) };
  if (!headers.authorization) return; // guest: nada que reparar
  try {
    const { cart } = await sdk.client.fetch<HttpTypes.StoreCartResponse>(
      `/store/carts/${id}`,
      {
        method: "GET",
        query: {
          fields: `id,customer_id,${CART_CUSTOMER_ACCOUNT_FIELD}`,
        },
        headers,
        cache: "no-store",
      },
    );
    if (cart && shouldTransferCartToCustomer(cart)) {
      await sdk.store.cart.transferCart(id, {}, headers);
    }
  } catch {
    // Best effort: si falla, el flujo que dependa del vínculo dará su error.
  }
}

export async function getOrSetCart(countryCode: string) {
  const region = await getRegion(countryCode);

  if (!region) {
    throw new Error(`Region not found for country code: ${countryCode}`);
  }

  // Canal activo: el de la sucursal resuelta (cookie) o el default del build.
  // getOrSetCart re-asocia el cart al canal correcto más abajo si cambió.
  const salesChannelId = await getActiveSalesChannelId();

  let cart = await retrieveCart();

  const headers = {
    ...(await getAuthHeaders()),
  };

  // Self-healing: cart guest con customer logueado → re-asociar (transfer).
  // "Guest" es también el cart que ya tiene customer_id de un INVITADO: pasar
  // por el paso de direcciones y loguearse después dejaba el cart (y la orden)
  // colgando del invitado. Ver cart-customer-transfer.ts.
  if (
    cart &&
    !!headers.authorization &&
    shouldTransferCartToCustomer(cart)
  ) {
    try {
      await sdk.store.cart.transferCart(cart.id, {}, headers);
      cart = (await retrieveCart()) ?? cart;
    } catch {
      // Best effort: el checkout puede seguir como guest.
    }
  }

  if (!cart) {
    // Build B2C metadata before creating the cart
    const metadata = await buildB2CCartMetadata();

    const cartResp = await sdk.store.cart.create(
      {
        region_id: region.id,
        sales_channel_id: salesChannelId,
        metadata,
      },
      {},
      headers,
    );
    cart = cartResp.cart;
    await setCartId(cart.id);
  } else {
    // Check if cart needs B2C metadata
    const cartMetadata = cart.metadata as
      | Record<string, any>
      | null
      | undefined;

    // Only add B2C metadata if:
    // 1. Cart doesn't have B2C metadata
    // 2. Cart doesn't have B2B metadata (we don't want to overwrite B2B orders)
    if (!hasB2CMetadata(cartMetadata) && !hasB2BMetadata(cartMetadata)) {
      const metadata = await buildB2CCartMetadata(cart);
      const updatedCartResp = await sdk.store.cart.update(
        cart.id,
        { metadata },
        {},
        headers,
      );
      cart = updatedCartResp.cart;
    }
  }

  // Verificar si el cart tiene el sales channel correcto del tenant actual
  // Solo actualizar si es necesario, sin revalidar para evitar loops
  if (
    cart &&
    (cart?.region_id !== region.id || cart?.sales_channel_id !== salesChannelId)
  ) {
    const updatedCartResp = await sdk.store.cart.update(
      cart.id,
      {
        region_id: region.id,
        sales_channel_id: salesChannelId,
      },
      {},
      headers,
    );
    cart = updatedCartResp.cart;
  }

  return sanitizeCartGiftCardCodes(cart);
}

export async function updateCart(data: HttpTypes.StoreUpdateCart) {
  const cartId = await getCartId();

  if (!cartId) {
    throw new Error(
      "No existing cart found, please create one before updating",
    );
  }

  const headers = {
    ...(await getAuthHeaders()),
  };

  // Retrieve current cart to check metadata
  const currentCart = await retrieveCart(cartId);
  if (currentCart) {
    const cartMetadata = currentCart.metadata as
      | Record<string, any>
      | null
      | undefined;

    // If cart doesn't have B2C metadata and is not a B2B cart, ensure B2C metadata
    if (!hasB2CMetadata(cartMetadata) && !hasB2BMetadata(cartMetadata)) {
      const b2cMetadata = await buildB2CCartMetadata(currentCart);
      // Merge with existing metadata if provided in update data
      data.metadata = {
        ...b2cMetadata,
        ...(data.metadata || {}),
      };
    } else if (data.metadata && typeof data.metadata === "object") {
      // Preserve existing metadata when updating
      data.metadata = {
        ...(cartMetadata || {}),
        ...data.metadata,
      };
    }
  }

  return sdk.store.cart
    .update(cartId, data, {}, headers)
    .then(async ({ cart }) => {
      const cartCacheTag = await getCacheTag("carts");
      revalidateTag(cartCacheTag, 'max');

      const fulfillmentCacheTag = await getCacheTag("fulfillment");
      revalidateTag(fulfillmentCacheTag, 'max');

      return sanitizeCartGiftCardCodes(cart);
    })
    .catch((error) => {
      console.error("[updateCart] Error updating cart:", error);
      return medusaError(error);
    });
}

export async function addToCart({
  variantId,
  quantity,
  countryCode,
  metadata,
}: {
  variantId: string;
  quantity: number;
  countryCode: string;
  metadata?: Record<string, unknown>;
}) {
  if (!variantId) {
    throw new Error("Missing variant ID when adding to cart");
  }

  const cart = await getOrSetCart(countryCode);

  if (!cart) {
    throw new Error("Error retrieving or creating cart");
  }

  const headers = {
    ...(await getAuthHeaders()),
  };

  await sdk.store.cart
    .createLineItem(
      cart.id,
      {
        variant_id: variantId,
        quantity,
        ...(metadata ? { metadata } : {}),
      },
      {},
      headers,
    )
    .then(async () => {
      const cartCacheTag = await getCacheTag("carts");
      revalidateTag(cartCacheTag, 'max');

      const fulfillmentCacheTag = await getCacheTag("fulfillment");
      revalidateTag(fulfillmentCacheTag, 'max');
    })
    .catch(medusaError);
}

export async function updateLineItem({
  lineId,
  quantity,
}: {
  lineId: string;
  quantity: number;
}) {
  if (!lineId) {
    throw new Error("Missing lineItem ID when updating line item");
  }

  const cartId = await getCartId();

  if (!cartId) {
    throw new Error("Missing cart ID when updating line item");
  }

  const headers = {
    ...(await getAuthHeaders()),
  };

  await sdk.store.cart
    .updateLineItem(cartId, lineId, { quantity }, {}, headers)
    .then(async () => {
      const cartCacheTag = await getCacheTag("carts");
      revalidateTag(cartCacheTag, 'max');

      const fulfillmentCacheTag = await getCacheTag("fulfillment");
      revalidateTag(fulfillmentCacheTag, 'max');
    })
    .catch(medusaError);
}

export async function deleteLineItem(lineId: string) {
  if (!lineId) {
    throw new Error("Missing lineItem ID when deleting line item");
  }

  const cartId = await getCartId();

  if (!cartId) {
    throw new Error("Missing cart ID when deleting line item");
  }

  const headers = {
    ...(await getAuthHeaders()),
  };

  await sdk.store.cart
    .deleteLineItem(cartId, lineId, {}, headers)
    .then(async () => {
      const cartCacheTag = await getCacheTag("carts");
      revalidateTag(cartCacheTag, 'max');

      const fulfillmentCacheTag = await getCacheTag("fulfillment");
      revalidateTag(fulfillmentCacheTag, 'max');
    })
    .catch(medusaError);
}

export async function initiatePaymentSession(
  cart: HttpTypes.StoreCart,
  data: HttpTypes.StoreInitializePaymentSession,
) {
  const headers = {
    ...(await getAuthHeaders()),
  };

  return sdk.store.payment
    .initiatePaymentSession(cart, data, {}, headers)
    .then(async (resp) => {
      const cartCacheTag = await getCacheTag("carts");
      revalidateTag(cartCacheTag, 'max');
      return resp;
    })
    .catch(medusaError);
}

export async function applyPromotions(codes: string[]) {
  let cartId: string | undefined;
  try {
    cartId = await getCartId();
  } catch (e: any) {
    throw new Error(`Could not read cart id: ${e?.message || "unknown"}`);
  }

  if (!cartId) {
    throw new Error("No existing cart found");
  }

  let headers: Record<string, string> = {};
  try {
    headers = { ...(await getAuthHeaders()) };
  } catch (e: any) {
    throw new Error(`Could not read auth headers: ${e?.message || "unknown"}`);
  }

  let result: any;
  try {
    result = await sdk.store.cart.update(
      cartId,
      {
        promo_codes: codes,
        metadata: buildManualPromoCodesMetadata(codes),
      },
      {},
      headers,
    );
  } catch (error: any) {
    const msg =
      (typeof error?.message === "string" && error.message) ||
      (typeof error === "string" && error) ||
      `Request failed with status ${error?.status ?? "unknown"}`;
    throw new Error(msg);
  }

  // Paso 4: revalidaciones — blindadas (no queremos que tiren el server action)
  try {
    const cartCacheTag = await getCacheTag("carts");
    revalidateTag(cartCacheTag, 'max');
  } catch {}

  try {
    const fulfillmentCacheTag = await getCacheTag("fulfillment");
    revalidateTag(fulfillmentCacheTag, 'max');
  } catch {}

  if (result?.cart) {
    return {
      ...result,
      cart: sanitizeCartGiftCardCodes(hydrateCartPromotionsFromMetadata(result.cart)),
    };
  }

  return result;
}

/**
 * Aplica una gift card al carrito vía el endpoint del loyalty-plugin
 * (POST /store/carts/:id/gift-cards). Devuelve el cart actualizado.
 */
export async function applyGiftCard(
  code: string,
): Promise<HttpTypes.StoreCart> {
  const cartId = await getCartId();
  if (!cartId) {
    throw new Error("No existing cart found");
  }

  const headers = {
    ...(await getAuthHeaders()),
  };

  const { cart } = await sdk.client
    .fetch<HttpTypes.StoreCartResponse>(
      `/store/carts/${cartId}/gift-cards`,
      {
        method: "POST",
        body: { code: code.trim() },
        headers,
      },
    )
    .catch(medusaError);

  const cartCacheTag = await getCacheTag("carts");
  revalidateTag(cartCacheTag, 'max');

  return sanitizeCartGiftCardCodes(cart);
}

/**
 * Quita una gift card del carrito (DELETE /store/carts/:id/gift-cards).
 * Devuelve el cart actualizado.
 */
export async function removeGiftCard(
  code: string,
): Promise<HttpTypes.StoreCart> {
  const cartId = await getCartId();
  if (!cartId) {
    throw new Error("No existing cart found");
  }

  const headers = {
    ...(await getAuthHeaders()),
  };

  const { cart } = await sdk.client
    .fetch<HttpTypes.StoreCartResponse>(
      `/store/carts/${cartId}/gift-cards`,
      {
        method: "DELETE",
        body: { code: code.trim() },
        headers,
      },
    )
    .catch(medusaError);

  const cartCacheTag = await getCacheTag("carts");
  revalidateTag(cartCacheTag, 'max');

  return sanitizeCartGiftCardCodes(cart);
}

export async function submitPromotionForm(
  currentState: unknown,
  formData: FormData,
) {
  const code = formData.get("code") as string;
  try {
    await applyPromotions([code]);
  } catch (e: any) {
    return e.message;
  }
}

// TODO: Pass a POJO instead of a form entity here
export async function setAddresses(currentState: unknown, formData: FormData) {
  try {
    if (!formData) {
      throw new Error("No form data found when setting addresses");
    }
    const cartId = await getCartId();

    if (!cartId) {
      throw new Error("No existing cart found when setting addresses");
    }

    const data = {
      shipping_address: {
        first_name: formData.get("shipping_address.first_name"),
        last_name: formData.get("shipping_address.last_name"),
        address_1: formData.get("shipping_address.address_1"),
        address_2: "",
        company: formData.get("shipping_address.company"),
        postal_code: formData.get("shipping_address.postal_code"),
        city: formData.get("shipping_address.city"),
        country_code: formData.get("shipping_address.country_code"),
        province: formData.get("shipping_address.province"),
        phone: formData.get("shipping_address.phone"),
      },
      email: formData.get("email"),
    } as any;

    const sameAsBilling = formData.get("same_as_billing");
    if (sameAsBilling === "on") data.billing_address = data.shipping_address;

    if (sameAsBilling !== "on")
      data.billing_address = {
        first_name: formData.get("billing_address.first_name"),
        last_name: formData.get("billing_address.last_name"),
        address_1: formData.get("billing_address.address_1"),
        address_2: "",
        company: formData.get("billing_address.company"),
        postal_code: formData.get("billing_address.postal_code"),
        city: formData.get("billing_address.city"),
        country_code: formData.get("billing_address.country_code"),
        province: formData.get("billing_address.province"),
        phone: formData.get("billing_address.phone"),
      };

    await updateCart(data);
  } catch (e: any) {
    console.error("[setAddresses] Error:", e);
    return e.message;
  }

  // El checkout de un demo sigue dentro de /demo/{slug}: sin el prefijo la URL
  // sale del demo (la sesión sobrevive por la cookie, pero la URL no).
  redirect(
    withSitePrefix("/checkout?step=delivery", await getActiveSitePrefix())
  );
}

/**
 * Places an order for a cart. If no cart ID is provided, it will use the cart ID from the cookies.
 * @param cartId - optional - The ID of the cart to place an order for.
 * @returns The cart object if the order was successful, or null if not.
 */
export async function placeOrder(cartId?: string) {
  const id = cartId || (await getCartId());

  if (!id) {
    throw new Error("No existing cart found when placing an order");
  }

  const headers = {
    ...(await getAuthHeaders()),
  };

  // Retrieve cart before completing to ensure metadata
  const cart = await retrieveCart(id);
  if (cart) {
    const cartMetadata = cart.metadata as
      | Record<string, any>
      | null
      | undefined;

    // Ensure B2C metadata is present before completing (unless it's a B2B cart)
    if (!hasB2CMetadata(cartMetadata) && !hasB2BMetadata(cartMetadata)) {
      const b2cMetadata = await buildB2CCartMetadata(cart);
      await sdk.store.cart.update(id, { metadata: b2cMetadata }, {}, headers);
    }

    await syncGuestCustomerProfileFromCartBeforeComplete(cart);
  }

  const cartRes = await sdk.store.cart
    .complete(id, {}, headers)
    .then(async (cartRes) => {
      const cartCacheTag = await getCacheTag("carts");
      revalidateTag(cartCacheTag, 'max');
      return cartRes;
    })
    .catch(medusaError);

  if (cartRes?.type === "order") {
    const countryCode =
      cartRes.order.shipping_address?.country_code?.toLowerCase();

    const orderCacheTag = await getCacheTag("orders");
    revalidateTag(orderCacheTag, 'max');

    removeCartId();

    await syncGuestCustomerProfileFromOrder(cartRes.order);

    redirect(
      withSitePrefix(
        `/order/${cartRes?.order.id}/confirmed`,
        await getActiveSitePrefix()
      )
    );
  }

  return sanitizeCartGiftCardCodes(cartRes.cart);
}

/**
 * Updates the countrycode param and revalidates the regions cache
 * @param regionId
 * @param countryCode
 */
export async function updateRegion(countryCode: string, currentPath: string) {
  const cartId = await getCartId();
  const region = await getRegion(countryCode);

  if (!region) {
    throw new Error(`Region not found for country code: ${countryCode}`);
  }

  if (cartId) {
    await updateCart({ region_id: region.id });
    const cartCacheTag = await getCacheTag("carts");
    revalidateTag(cartCacheTag, 'max');
  }

  const regionCacheTag = await getCacheTag("regions");
  revalidateTag(regionCacheTag, 'max');

  const productsCacheTag = await getCacheTag("products");
  revalidateTag(productsCacheTag, 'max');

  redirect(currentPath || "/");
}

export async function listCartOptions() {
  const cartId = await getCartId();
  const headers = {
    ...(await getAuthHeaders()),
  };
  const next = {
    ...(await getCacheOptions("shippingOptions")),
  };

  return await sdk.client.fetch<{
    shipping_options: HttpTypes.StoreCartShippingOption[];
  }>("/store/shipping-options", {
    query: { cart_id: cartId },
    next,
    headers,
    cache: "force-cache",
  });
}
