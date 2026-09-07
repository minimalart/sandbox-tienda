import "server-only";

import { cache } from "react";
import { sdk } from "@lib/config";
import { getActiveSalesChannelId } from "@lib/data/cookies";
import { getActiveDemoSalesChannelId } from "@lib/site-config/active-tenant";
import { getRegion } from "@lib/data/regions";

export type ShopByLookPlacement =
  | "top"
  | "after_collections"
  | "after_featured"
  | "before_footer";

export type ShopByLookVariant = {
  id: string;
  title?: string;
  calculated_amount: number | null;
  currency_code: string | null;
  available: number;
  options: { value: string; option_id?: string; option_title?: string }[];
};

export type ShopByLookProductData = {
  product_id: string;
  variant_id: string | null;
  pos_x: number;
  pos_y: number;
  title?: string;
  handle?: string;
  thumbnail: string | null;
  variants: ShopByLookVariant[];
};

export type ShopByLookData = {
  id: string;
  title: string;
  subtitle: string | null;
  cta_label: string | null;
  image_url: string;
  image_alt: string | null;
  placement: ShopByLookPlacement;
  products: ShopByLookProductData[];
};

/**
 * Looks activos para el contexto actual (canal + región). Cacheado con
 * `cache()` para compartir una sola request entre los distintos slots del home.
 * Nunca tira: ante cualquier error devuelve [] (el home no se rompe).
 */
export const getActiveShopByLooks = cache(
  async (countryCode: string): Promise<ShopByLookData[]> => {
    try {
      const [salesChannelId, demoSalesChannelId, region] = await Promise.all([
        getActiveSalesChannelId(),
        getActiveDemoSalesChannelId(),
        getRegion(countryCode),
      ]);

      const params = new URLSearchParams();
      // Scope por canal (misma regla que el blog): mandamos siempre el canal
      // activo; en una demo agregamos `strict` para ocultar los looks globales.
      if (salesChannelId) {
        params.set("sales_channel_id", salesChannelId);
        if (demoSalesChannelId) params.set("strict", "1");
      }
      if (region?.id) params.set("region_id", region.id);
      const qs = params.toString();

      const { looks } = await sdk.client.fetch<{ looks: ShopByLookData[] }>(
        `/store/shop-by-look${qs ? `?${qs}` : ""}`,
        {
          method: "GET",
          next: { revalidate: 60, tags: ["shop-by-look"] },
        }
      );

      return looks ?? [];
    } catch {
      return [];
    }
  }
);
