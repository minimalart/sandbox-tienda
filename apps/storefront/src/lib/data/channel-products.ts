"use server";

import { getTenant } from "@lib/site-config/resolver";
import { getActiveSalesChannelId } from "./cookies";
import { isHiddenFromStore } from "@lib/util/hidden-product";
import { isPromotionActiveForStorefront } from "@lib/util/promotion-active";
import { sortProducts } from "@lib/util/sort-products";
import { promotionMatchesSalesChannel } from "@lib/util/promotion-channel-filter";
import type { HttpTypes } from "@medusajs/types";
import type { SortOptions } from "@modules/store/components/refinement-list/sort-products";
import { getRegion, retrieveRegion } from "./regions";

const MEDUSA_BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000";
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "";

/**
 * Vigencia del detalle de producto en la Data Cache.
 *
 * `cache: "force-cache"` sin `revalidate` cacheaba la ficha PARA SIEMPRE: el
 * único invalidador era el tag `channel-products-<tenant>-<canal>`, que nadie
 * revalida (no hay `revalidateTag` en el storefront) y la Data Cache de Vercel
 * sobrevive a los deploys. Resultado: variantes/precios nuevos que jamás
 * aparecían — un producto al que le agregaban presentaciones (1 L, 4 L, 10 L)
 * seguía sirviéndose con la única variante que tenía cuando se cacheó, así que
 * la PDP y el quick-view no mostraban el selector de opciones.
 *
 * ESTE TTL SIGUE SIENDO EL ÚNICO INVALIDADOR, y el tag sigue sin revalidarse
 * desde ningún lado: los `revalidateTag(getCacheTag("products"))` de
 * `lib/data/branch.ts` y `lib/data/cart.ts` apuntan a OTRO tag ("products"), no
 * a `channel-products-*`. Lo mismo aplica a todo lo que aplica la extensión
 * "catalogador" sobre el producto (`subtitle`, `description` y los
 * `meta_title` / `meta_description` / `keywords` / `alt_text` de `metadata`): el
 * backoffice los escribe al instante, pero la PDP y su `generateMetadata` los
 * siguen sirviendo desde caché hasta 5 minutos después de aplicados. Es
 * ACEPTADO a propósito — la alternativa es un endpoint de revalidación
 * disparado por webhook del backend (`product.updated`), que hoy no existe en
 * `src/app/api/**`.
 */
const PRODUCT_DETAIL_REVALIDATE_S = 300;

const PRODUCT_DETAIL_FIELDS = [
  "*variants.calculated_price",
  "*variants.inventory_quantity",
  "+variants.manage_inventory",
  "+variants.allow_backorder",
  "*variants.options",
  "*variants.options.option",
  "*options",
  "*options.values",
  "+metadata",
  "+tags",
  "+images",
  "*categories",
  "*categories.parent_category",
  "+collection",
  "+fragrance",
].join(",");

/** Resolve region from countryCode or regionId */
async function resolveRegion(
  countryCode?: string,
  regionId?: string,
): Promise<HttpTypes.StoreRegion | null> {
  if (countryCode) {
    return (await getRegion(countryCode)) ?? null;
  }
  return (await retrieveRegion(regionId ?? "")) ?? null;
}

/** Handle non-OK fetch response and throw descriptive error */
async function handleFetchError(resp: Response): Promise<never> {
  const contentType = resp.headers.get("content-type") || "";
  const errorBody = contentType.includes("application/json")
    ? await resp.json().catch(() => ({ error: "Medusa error (invalid JSON)" }))
    : await resp.text();

  console.error("[ChannelProducts] Error response:", {
    status: resp.status,
    statusText: resp.statusText,
    errorBody,
  });

  const detail =
    typeof errorBody === "string"
      ? errorBody
      : errorBody.message || errorBody.error || "Failed to fetch products";

  throw new Error(`Custom endpoint error (${resp.status}): ${detail}`);
}

/** Extract inventory_quantity from nested inventory structures */
function resolveInventoryQuantity(variant: Record<string, unknown>): unknown {
  if (
    variant.inventory_quantity !== undefined &&
    variant.inventory_quantity !== null
  ) {
    return variant.inventory_quantity;
  }

  const inv = variant.inventory as Record<string, unknown>[] | undefined;
  if (
    inv?.[0] &&
    (inv[0] as Record<string, unknown>).stocked_quantity !== undefined
  ) {
    return (inv[0] as Record<string, unknown>).stocked_quantity;
  }

  const invItems = variant.inventory_items as
    | Record<string, unknown>[]
    | undefined;
  if (invItems?.[0]) {
    const nested = (invItems[0] as Record<string, unknown>).inventory as
      | Record<string, unknown>
      | undefined;
    if (nested?.stocked_quantity !== undefined) {
      return nested.stocked_quantity;
    }
  }

  return 0;
}

/** Transform products to compute inventory_quantity from nested data */
function transformProductInventory(
  products: Record<string, unknown>[],
): Record<string, unknown>[] {
  return products.map((product) => ({
    ...product,
    variants: (product.variants as Record<string, unknown>[] | undefined)?.map(
      (variant) => ({
        ...variant,
        inventory_quantity: resolveInventoryQuantity(variant),
      }),
    ),
  }));
}

/** Strip promotions whose sales_channel_id rule excludes the active channel */
function filterProductPromotionsByChannel(
  products: Record<string, unknown>[],
  salesChannelId: string | undefined,
): Record<string, unknown>[] {
  if (!salesChannelId) return products;

  return products.map((product) => {
    const promotions = product.promotions as
      | Parameters<typeof promotionMatchesSalesChannel>[0][]
      | undefined;
    if (!promotions?.length) return product;

    const filtered = promotions.filter((promo) =>
      isPromotionActiveForStorefront(promo) &&
      promotionMatchesSalesChannel(promo, salesChannelId),
    );

    if (filtered.length === promotions.length) return product;
    return { ...product, promotions: filtered };
  });
}

/** Filter products by queryParams (handle, category_id, collection_id, id) */
function filterProductsByParams(
  products: Record<string, unknown>[],
  params: Record<string, unknown> | undefined,
  regionId: string | undefined,
): Record<string, unknown>[] {
  let result = products;

  if (regionId) {
    result = result.filter((product) => {
      const variants = product.variants as
        | Record<string, unknown>[]
        | undefined;
      if (!variants || variants.length === 0) {
        return false;
      }
      return variants.some((variant) => variant.calculated_price);
    });
  }

  if (params?.handle) {
    result = result.filter((p) => p.handle === params.handle);
  }
  if (params?.category_id) {
    result = result.filter((p) => {
      const cats = p.categories as Array<{ id: string }> | undefined;
      return cats?.some((cat) => cat.id === params.category_id);
    });
  }
  if (params?.collection_id) {
    result = result.filter((p) => p.collection_id === params.collection_id);
  }
  if (params?.id) {
    const ids = Array.isArray(params.id) ? params.id : [params.id];
    result = result.filter((p) => ids.includes(p.id));
  } else if (!params?.handle) {
    // Hide products flagged as not-for-storefront from generic listings.
    // Skip the filter when the caller fetches by explicit handle/id so the
    // cart can still resolve the hidden gift product on demand.
    result = result.filter(
      (p) => !isHiddenFromStore(p as { metadata?: Record<string, unknown> }),
    );
  }

  return result;
}

export const listChannelProducts = async ({
  pageParam = 1,
  queryParams,
  countryCode,
  regionId,
  includeSpecialPricing = true,
}: {
  pageParam?: number;
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductParams;
  countryCode?: string;
  regionId?: string;
  includeSpecialPricing?: boolean;
}): Promise<{
  response: { products: HttpTypes.StoreProduct[]; count: number };
  nextPage: number | null;
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductParams;
}> => {
  if (!(countryCode || regionId)) {
    throw new Error("Country code or region ID is required");
  }

  const limit = queryParams?.limit || 12;
  const _pageParam = Math.max(pageParam, 1);
  const offset = _pageParam === 1 ? 0 : (_pageParam - 1) * limit;

  const region = await resolveRegion(countryCode, regionId);

  if (!region) {
    return {
      response: { products: [], count: 0 },
      nextPage: null,
    };
  }

  // Obtener tenant (cacheable) - getTenant() maneja build time internamente
  const tenant = await getTenant();
  const salesChannelId = await getActiveSalesChannelId();

  // Headers para obtener precios especiales
  const headers: Record<string, string> = {
    "x-publishable-api-key": PUBLISHABLE_KEY,
  };

  if (includeSpecialPricing && tenant.medusa.customerGroupId) {
    headers["x-customer-group-id"] = tenant.medusa.customerGroupId;
  }

  const resp = await fetch(`${MEDUSA_BACKEND_URL}/store/product-promotion`, {
    method: "GET",
    headers,
    next: { revalidate: 120 },
  });

  if (!resp.ok) {
    await handleFetchError(resp);
  }

  const data = await resp.json();
  const rawProducts = data?.products || [];

  // Transform + filter using extracted helpers
  const transformed = transformProductInventory(rawProducts);
  const channelFiltered = filterProductPromotionsByChannel(
    transformed,
    salesChannelId,
  );
  const allProducts = filterProductsByParams(
    channelFiltered,
    queryParams as Record<string, unknown> | undefined,
    region?.id,
  ) as unknown as HttpTypes.StoreProduct[];

  // Aplicar paginación
  const count = allProducts.length;
  const products = allProducts.slice(offset, offset + limit);
  const nextPage = count > offset + limit ? pageParam + 1 : null;

  return {
    response: {
      products,
      count,
    },
    nextPage,
    queryParams,
  };
};

export const listChannelProductsWithSort = async ({
  page = 0,
  queryParams,
  sortBy = "created_at",
  countryCode,
  includeSpecialPricing = true,
}: {
  page?: number;
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductParams;
  sortBy?: SortOptions;
  countryCode: string;
  includeSpecialPricing?: boolean;
}): Promise<{
  response: { products: HttpTypes.StoreProduct[]; count: number };
  nextPage: number | null;
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductParams;
}> => {
  const limit = queryParams?.limit || 12;

  const {
    response: { products, count },
  } = await listChannelProducts({
    pageParam: 0,
    queryParams: {
      ...queryParams,
      limit: 100,
    },
    countryCode,
    includeSpecialPricing,
  });

  // Filtrar solo productos que tengan imágenes
  const productsWithImages = products.filter(
    (product) => product.images && product.images.length > 0,
  );

  const sortedProducts = sortProducts(productsWithImages, sortBy);

  const pageParam = (page - 1) * limit;

  const nextPage =
    productsWithImages.length > pageParam + limit ? pageParam + limit : null;

  const paginatedProducts = sortedProducts.slice(pageParam, pageParam + limit);

  return {
    response: {
      products: paginatedProducts,
      count,
    },
    nextPage,
    queryParams,
  };
};

export const getChannelProductById = async (
  productId: string,
  countryCode: string,
  includeSpecialPricing = true,
  // Canal explícito. La página Comparar es un client component que pega a
  // /api/store/product?id=...; en demos, la resolución del canal vía
  // x-demo-slug → getActiveSalesChannelId es frágil dentro de /api. El cliente
  // ya conoce el canal del demo (useTenant().medusa.salesChannelId), así que lo
  // pasa explícito y nos saltamos esa cadena. Cae a getActiveSalesChannelId()
  // cuando no se provee (PDP server-side, que sí resuelve bien el demo).
  salesChannelIdOverride?: string,
): Promise<HttpTypes.StoreProduct | null> => {
  const region = await getRegion(countryCode);

  if (!region) {
    return null;
  }

  // Obtener tenant (cacheable) - getTenant() maneja build time internamente
  const tenant = await getTenant();
  const salesChannelId =
    salesChannelIdOverride || (await getActiveSalesChannelId());

  const headers: Record<string, string> = {};

  // Usar solo header x-customer-group-id desde tenant config
  if (includeSpecialPricing && tenant.medusa.customerGroupId) {
    headers["x-customer-group-id"] = tenant.medusa.customerGroupId;
  }

  const next = {
    // Cache tag por canal: evita colisiones de catálogo entre sucursales.
    tags: [`channel-products-${tenant.id}-${salesChannelId}`],
    revalidate: PRODUCT_DETAIL_REVALIDATE_S,
  };

  try {
    // Usar SDK con tenant config
    const { getMedusaSDK } = await import("@lib/config");
    const sdk = await getMedusaSDK();

    const { product } = await sdk.client.fetch<{
      product: HttpTypes.StoreProduct;
    }>(`/store/products/${productId}`, {
      method: "GET",
      query: {
        region_id: region.id,
        sales_channel_id: salesChannelId,
        fields: PRODUCT_DETAIL_FIELDS,
      },
      headers,
      next,
      cache: "force-cache",
    });

    if (!product) return null;

    const [transformed] = transformProductInventory([
      product,
    ] as unknown as Record<string, unknown>[]);
    return (transformed as unknown as HttpTypes.StoreProduct) ?? null;
  } catch (error) {
    console.error("Error fetching channel product:", error);
    return null;
  }
};

export const getChannelProductByHandle = async (
  handle: string,
  countryCode: string,
  includeSpecialPricing = true,
  salesChannelIdOverride?: string,
): Promise<HttpTypes.StoreProduct | null> => {
  const region = await getRegion(countryCode);

  if (!region) {
    return null;
  }

  const tenant = await getTenant();
  const salesChannelId =
    salesChannelIdOverride || (await getActiveSalesChannelId());

  const headers: Record<string, string> = {};

  if (includeSpecialPricing && tenant.medusa.customerGroupId) {
    headers["x-customer-group-id"] = tenant.medusa.customerGroupId;
  }

  try {
    const { getMedusaSDK } = await import("@lib/config");
    const sdk = await getMedusaSDK();

    const { products } = await sdk.client.fetch<{
      products: HttpTypes.StoreProduct[];
    }>("/store/products", {
      method: "GET",
      query: {
        handle,
        region_id: region.id,
        sales_channel_id: salesChannelId,
        fields: PRODUCT_DETAIL_FIELDS,
        limit: 1,
      },
      headers,
      // Cachear el producto (igual que getChannelProductById): la PDP es
      // force-dynamic y, sin caché, cada navegación a "Ver ficha completa"
      // pegaba al backend (lento). El tag por canal HABILITA una revalidación
      // explícita ante cambios de catálogo/precio/textos, pero nadie la dispara
      // todavía: en la práctica el único invalidador es `revalidate`.
      next: {
        tags: [`channel-products-${tenant.id}-${salesChannelId}`],
        revalidate: PRODUCT_DETAIL_REVALIDATE_S,
      },
      cache: "force-cache",
    });

    if (!products?.[0]) return null;

    // PDPs by handle should 404 for products hidden from the storefront,
    // even though the product remains addable to the cart by other paths.
    if (isHiddenFromStore(products[0])) return null;

    const [transformed] = transformProductInventory([
      products[0],
    ] as unknown as Record<string, unknown>[]);
    return (transformed as unknown as HttpTypes.StoreProduct) ?? null;
  } catch (error) {
    console.error("Error fetching channel product by handle:", error);
    return null;
  }
};

// Función para obtener información de stock por locación
export const getChannelProductInventory = async (
  productId: string,
  variantId?: string,
): Promise<Record<string, unknown>[]> => {
  try {
    // Obtener tenant (cacheable) - getTenant() maneja build time internamente
    const tenant = await getTenant();
    const salesChannelId = await getActiveSalesChannelId();

    const headers: Record<string, string> = {};

    if (tenant.medusa.customerGroupId) {
      headers["x-customer-group-id"] = tenant.medusa.customerGroupId;
    }

    const query: Record<string, string> = {
      ...(salesChannelId ? { sales_channel_id: salesChannelId } : {}),
    };

    if (variantId) {
      query.variant_id = variantId;
    }

    // Usar SDK con tenant config
    const { getMedusaSDK } = await import("@lib/config");
    const sdk = await getMedusaSDK();

    return await sdk.client
      .fetch<{ inventory_items: Record<string, unknown>[] }>(
        `/store/products/${productId}/inventory`,
        {
          method: "GET",
          query,
          headers,
          // Sin `revalidate` este fetch no tenía NINGÚN invalidador (tampoco
          // tag): el stock por locación quedaba congelado en la Data Cache.
          next: { revalidate: PRODUCT_DETAIL_REVALIDATE_S },
          cache: "force-cache",
        },
      )
      .then(({ inventory_items }) => inventory_items || []);
  } catch (error) {
    console.error("Error fetching channel product inventory:", error);
    return [];
  }
};
