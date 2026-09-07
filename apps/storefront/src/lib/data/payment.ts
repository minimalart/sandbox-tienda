"use server";

import { sdk } from "@lib/config";
import type { HttpTypes } from "@medusajs/types";
import { getAuthHeaders, getCacheOptions } from "./cookies";

export const listCartPaymentMethods = async (regionId: string) => {
  const headers = {
    ...(await getAuthHeaders()),
  };

  const next = {
    ...(await getCacheOptions("payment_providers")),
    // Payment providers change whenever the backend toggles one (e.g.
    // MERCADOPAGO_ENABLED). `cache: "force-cache"` pinned the FIRST response
    // forever — and in `next dev` it survives restarts via .next/cache — which
    // is exactly how an empty/stale provider list got stuck on the payment
    // step. A short revalidate window reflects backend changes promptly without
    // hammering the endpoint (it's only hit on the payment step of checkout).
    revalidate: 60,
  };

  return sdk.client
    .fetch<HttpTypes.StorePaymentProviderListResponse>(
      "/store/payment-providers",
      {
        method: "GET",
        query: { region_id: regionId },
        headers,
        next,
      }
    )
    .then(({ payment_providers }) =>
      payment_providers.sort((a, b) => (a.id > b.id ? 1 : -1))
    )
    .catch(() => null);
};
