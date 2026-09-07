"use server";

import type { Video, VideosResponse } from "@lib/types/video";
import { getActiveDemoSalesChannelId } from "@lib/site-config/active-tenant";
import { getActiveSalesChannelId } from "@lib/data/cookies";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000";

const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "";

/**
 * Scope por canal (misma regla que el blog): mandamos SIEMPRE el canal activo
 * para que el store principal oculte los videos de otras demos y muestre los
 * globales; en una demo agregamos `strict` para ocultar los globales y mostrar
 * solo los de la demo.
 */
async function channelScopeParams(): Promise<URLSearchParams> {
  const [demoSalesChannelId, salesChannelId] = await Promise.all([
    getActiveDemoSalesChannelId(),
    getActiveSalesChannelId(),
  ]);
  const params = new URLSearchParams();
  if (salesChannelId) {
    params.set("sales_channel_id", salesChannelId);
    if (demoSalesChannelId) params.set("strict", "1");
  }
  return params;
}

/**
 * Obtiene todos los videos activos con sus productos vinculados, scopeados al
 * canal activo (ver channelScopeParams).
 */
export async function getAllVideos(): Promise<Video[]> {
  try {
    const params = await channelScopeParams();
    const qs = params.toString();
    const response = await fetch(`${BACKEND_URL}/store/videos${qs ? `?${qs}` : ""}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(PUBLISHABLE_KEY
          ? { "x-publishable-api-key": PUBLISHABLE_KEY }
          : {}),
      },
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      console.debug("[Videos] Endpoint not available:", response.status);
      return [];
    }

    const data: VideosResponse = await response.json();
    return data.videos || [];
  } catch (error) {
    console.debug("[Videos] Could not fetch videos:", error);
    return [];
  }
}

/**
 * Obtiene videos vinculados a un producto específico
 */
export async function getVideosByProductId(
  productId: string,
): Promise<Video[]> {
  if (!productId) return [];

  try {
    const params = await channelScopeParams();
    params.set("product_id", productId);
    const response = await fetch(
      `${BACKEND_URL}/store/videos?${params.toString()}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(PUBLISHABLE_KEY
            ? { "x-publishable-api-key": PUBLISHABLE_KEY }
            : {}),
        },
        next: { revalidate: 60 },
      },
    );

    if (!response.ok) {
      console.debug("[Videos] Product videos endpoint not available:", response.status);
      return [];
    }

    const data: VideosResponse = await response.json();
    return data.videos || [];
  } catch (error) {
    console.debug("[Videos] Could not fetch product videos:", error);
    return [];
  }
}
