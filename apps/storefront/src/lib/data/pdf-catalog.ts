import "server-only";

import { cache } from "react";
import { sdk } from "@lib/config";
import { getActiveSalesChannelId } from "@lib/data/cookies";
import { getRegion } from "@lib/data/regions";

export type PdfHotspotType = "product" | "video" | "text";

export type PdfCatalogVariant = {
  id: string;
  title?: string;
  calculated_amount: number | null;
  currency_code: string | null;
  available: number;
  options: { value: string; option_id?: string; option_title?: string }[];
};

export type PdfCatalogProduct = {
  product_id: string;
  variant_id: string | null;
  title?: string;
  handle?: string;
  thumbnail: string | null;
  variants: PdfCatalogVariant[];
};

export type PdfCatalogHotspot = {
  id: string;
  type: PdfHotspotType;
  page_index: number;
  pos_x: number;
  pos_y: number;
  product?: PdfCatalogProduct;
  data?: Record<string, unknown>;
};

export type PdfCatalogData = {
  id: string;
  name: string;
  pdf_url: string;
  pages: number;
  hotspots: PdfCatalogHotspot[];
};

/**
 * Catálogo PDF activo para el canal + región actuales. Cacheado con `cache()`.
 * Nunca tira: ante cualquier error devuelve null (la página no se rompe).
 */
export const getActivePdfCatalog = cache(
  async (countryCode: string): Promise<PdfCatalogData | null> => {
    try {
      const [salesChannelId, region] = await Promise.all([
        getActiveSalesChannelId(),
        getRegion(countryCode),
      ]);

      const params = new URLSearchParams();
      if (salesChannelId) params.set("sales_channel_id", salesChannelId);
      if (region?.id) params.set("region_id", region.id);
      const qs = params.toString();

      const { catalog } = await sdk.client.fetch<{ catalog: PdfCatalogData | null }>(
        `/store/pdf-catalog/active${qs ? `?${qs}` : ""}`,
        {
          method: "GET",
          next: { revalidate: 60, tags: ["pdf-catalog"] },
        }
      );

      return catalog ?? null;
    } catch {
      return null;
    }
  }
);
