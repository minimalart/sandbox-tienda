import "server-only";
import { headers } from "next/headers";

import { getActivePromotionIdsForChannel } from "@lib/data/active-promotion-ids";
import { getActiveSalesChannelId } from "@lib/data/cookies";
import { searchTypesenseProductsCore } from "./search-core";
import type { TypesenseProductsParams, TypesenseProductsResponse } from "./types";

/**
 * Track search query in analytics collection
 */
async function trackSearchQuery(
  query: string,
  hasResults: boolean = true,
): Promise<void> {
  if (!query || query === "*" || (await headers()).has("x-puck-preview")) return;

  try {
    const backendUrl =
      process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000";
    const publishableApiKey =
      process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "";

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (publishableApiKey) {
      headers["x-publishable-api-key"] = publishableApiKey;
    }

    const response = await fetch(`${backendUrl}/store/typesense/analytics`, {
      method: "POST",
      headers,
      body: JSON.stringify({ query, hasResults }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(
        "[TYPESENSE ANALYTICS] Failed to track search query:",
        response.status,
        errorText,
      );
    } else {
      console.log("[TYPESENSE ANALYTICS] Query tracked successfully");
    }
  } catch (error) {
    console.warn("[TYPESENSE ANALYTICS] Error tracking search query:", error);
  }
}

/**
 * Wrapper servidor de búsqueda Typesense. Mantiene la firma pública exacta para
 * los ~18 consumidores server-side. Fetcha los IDs de promociones activas desde
 * el admin client (server-only) y delega al core puro.
 */
export async function searchTypesenseProducts(
  params: TypesenseProductsParams,
  options?: { track?: boolean },
): Promise<TypesenseProductsResponse> {
  const rawQuery: string = params.q?.trim() || "*";

  // Resolve the active sales channel centrally so every caller (home, PLP,
  // search, related…) is demo-aware: on a /demo/{slug} page this returns the
  // demo's channel, otherwise the branch cookie / build-time default. Callers
  // that pass an explicit salesChannelId still win.
  const resolvedSalesChannelId =
    params.salesChannelId || (await getActiveSalesChannelId());
  const effectiveParams: TypesenseProductsParams = {
    ...params,
    salesChannelId: resolvedSalesChannelId,
  };

  const promoFilterChannelId =
    resolvedSalesChannelId || process.env.NEXT_PUBLIC_SALES_CHANNEL_ID;

  // Determinar si hay productos con promociones requiere hacer la búsqueda primero,
  // pero el guard original (L641) verificaba rawProducts antes de fetchear los IDs.
  // Para preservar el comportamiento exacto: intentar fetchear los IDs siempre que
  // haya un canal configurado, como hacía el código original en la misma rama de
  // ejecución (el guard `rawProducts.some(p => p.promotions?.length)` era una
  // optimización que se puede aplicar dentro del core). Aquí mantenemos la lógica
  // del servidor igual: fetchear los IDs cuando hay canal, pasar null si no hay.
  let activePromoIds: Set<string> | null = null;
  if (promoFilterChannelId) {
    try {
      activePromoIds = await getActivePromotionIdsForChannel(promoFilterChannelId);
    } catch (err) {
      console.warn(
        "[TYPESENSE] Could not fetch promotion allowlist, skipping filter:",
        err,
      );
    }
  }

  const result = await searchTypesenseProductsCore(effectiveParams, activePromoIds);

  // Analytics en el path servidor — igual que antes del refactor.
  if (rawQuery !== "*" && options?.track !== false) {
    const hasResults = result.found > 0;
    trackSearchQuery(rawQuery, hasResults).catch((err) =>
      console.warn("[TYPESENSE] Analytics tracking error:", err),
    );
  }

  return result;
}
