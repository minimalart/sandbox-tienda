"use server";

import { searchTypesenseProducts } from "@lib/typesense";
import type { TypesenseProductDocument } from "@lib/typesense";

/**
 * Fetch de una página adicional del feed campaign, disparado por el sentinel
 * de scroll infinito. Server action para no exponer publishable keys ni el
 * filtro base al cliente.
 */
export async function loadMoreCampaignKits(input: {
  page: number;
  limit: number;
  collectionId?: string;
  tag?: string;
}): Promise<{
  products: TypesenseProductDocument[];
  hasMore: boolean;
}> {
  try {
    const result = await searchTypesenseProducts({
      page: input.page,
      limit: input.limit,
      collectionId: input.collectionId,
      tag: input.tag,
      sortBy: "created_at",
    });
    const products = [...result.products].sort((a, b) => {
      const aIn = a.stock_available > 0;
      const bIn = b.stock_available > 0;
      if (aIn === bIn) return 0;
      return aIn ? -1 : 1;
    });
    return {
      products,
      hasMore: input.page < result.totalPages,
    };
  } catch (err) {
    console.error("[campaign-kits] loadMore fetch failed:", err);
    return { products: [], hasMore: false };
  }
}
