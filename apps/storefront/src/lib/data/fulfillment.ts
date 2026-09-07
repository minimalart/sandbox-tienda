"use server";

import { sdk } from "@lib/config";
import type { HttpTypes } from "@medusajs/types";
import { getAuthHeaders } from "./cookies";

export const listCartShippingMethods = async (cartId: string) => {
  const headers = {
    ...(await getAuthHeaders()),
  };

  return sdk.client
    .fetch<HttpTypes.StoreShippingOptionListResponse>(
      "/store/shipping-options",
      {
        method: "GET",
        query: {
          cart_id: cartId,
          // `+data` NO es opcional: `defaultStoreShippingOptionsFields` (Medusa
          // 2.x, api/store/shipping-options/query-config) es id, name,
          // price_type, service_zone_id, shipping_profile_id,
          // fulfillment_provider_id, shipping_option_type_id y metadata — `data`
          // NO está. Sin pedirlo, `sm.data` llega undefined y todo predicado que
          // lo lea (isStorePickupOption → data.pickup_kind) da false para
          // siempre, sin importar lo que diga la DB.
          fields:
            "+data,+service_zone.fulfillment_set.type,*service_zone.fulfillment_set.location.address",
        },
        headers,
        cache: "no-store",
      }
    )
    .then(({ shipping_options }) => shipping_options)
    .catch(() => null);
};

export const calculatePriceForShippingOption = async (
  optionId: string,
  cartId: string,
  data?: Record<string, unknown>
) => {
  const headers = {
    ...(await getAuthHeaders()),
  };

  const body = { cart_id: cartId, data };

  if (data) {
    body.data = data;
  }

  return sdk.client
    .fetch<{ shipping_option: HttpTypes.StoreCartShippingOption }>(
      `/store/shipping-options/${optionId}/calculate`,
      {
        method: "POST",
        body,
        headers,
        // The calculated price depends on the cart's current shipping address
        // (Andreani quotes by destination postal code). Never cache it, or a
        // different address keeps showing the first computed amount.
        cache: "no-store",
      }
    )
    .then(({ shipping_option }) => shipping_option)
    .catch((e) => null);
};
