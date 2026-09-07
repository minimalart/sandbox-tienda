"use server";

import { sdk } from "@lib/config";
import { sortProducts } from "@lib/util/sort-products";
import type { HttpTypes } from "@medusajs/types";
import type { SortOptions } from "@modules/store/components/refinement-list/sort-products";
import { getRegion, retrieveRegion } from "@lib/data/regions";
import { getActiveSalesChannelId } from "@lib/data/cookies";

type ProductsCacheEntry = {
  products: any[];
  expiresAt: number;
};

const PRODUCTS_CACHE_TTL_MS = 5 * 60 * 1000;

const getProductsCache = (): Record<string, ProductsCacheEntry> => {
  const g = globalThis as unknown as {
    __mercattoProductsCache?: Record<string, ProductsCacheEntry>;
  };
  if (!g.__mercattoProductsCache) {
    g.__mercattoProductsCache = {};
  }
  return g.__mercattoProductsCache;
};

/**
 * FUGA DE CATÁLOGO ENTRE TIENDAS — arreglada acá.
 *
 * Esta cache vive en `globalThis`, o sea que es de PROCESO y la comparten todas las
 * requests, de cualquier tienda. Hasta ahora se keyeaba sólo por `backendUrl`, que
 * no llevaba el sales channel, mientras la publishable key es una sola global: el
 * resultado es que la primera tienda que pedía promociones dejaba SU catálogo
 * cacheado para todas las demás durante 5 minutos.
 *
 * No era un riesgo a futuro del multitienda: pasaba en producción.
 *
 * El arreglo es doble y los dos hacen falta:
 *  - el canal de la tienda activa va en la URL, así el backend filtra de verdad;
 *  - la key incluye la publishable key, para que el día que haya una por tienda no
 *    haya que volver a descubrir esto.
 */
const cacheKeyOf = (backendUrl: string, publishableKey: string) =>
  `${backendUrl}::${publishableKey}`;

export const getCachedPromotionProducts = async (
  backendUrl: string,
  publishableKey: string,
): Promise<any[]> => {
  const cache = getProductsCache();
  const now = Date.now();
  const cacheKey = cacheKeyOf(backendUrl, publishableKey);

  const cached = cache[cacheKey];
  if (cached && cached.expiresAt > now) {
    return cached.products;
  }

  const resp = await fetch(backendUrl, {
    method: "GET",
    headers: {
      "x-publishable-api-key": publishableKey,
    },
    cache: "force-cache",
    next: { revalidate: Math.floor(PRODUCTS_CACHE_TTL_MS / 1000) },
  });

  if (!resp.ok) {
    const contentType = resp.headers.get("content-type") || "";
    const errorBody = contentType.includes("application/json")
      ? await resp
          .json()
          .catch(() => ({ error: "Medusa error (invalid JSON)" }))
      : await resp.text();

    throw new Error(
      `Custom endpoint error (${resp.status}): ${typeof errorBody === "string" ? errorBody : errorBody.message || errorBody.error || "Failed to fetch products"}`,
    );
  }

  const data = await resp.json();
  const rawProducts = data?.products || [];

  // Transform products to compute inventory_quantity from nested inventory data
  const products = rawProducts.map((product: any) => ({
    ...product,
    variants: product.variants?.map((variant: any) => {
      let inventoryQuantity = variant.inventory_quantity;

      if (inventoryQuantity === undefined || inventoryQuantity === null) {
        if (variant.inventory?.[0]?.stocked_quantity !== undefined) {
          inventoryQuantity = variant.inventory[0].stocked_quantity;
        } else if (
          variant.inventory_items?.[0]?.inventory?.stocked_quantity !==
          undefined
        ) {
          inventoryQuantity =
            variant.inventory_items[0].inventory.stocked_quantity;
        }
      }

      return {
        ...variant,
        inventory_quantity: inventoryQuantity ?? 0,
      };
    }),
  }));

  cache[cacheKey] = {
    products,
    expiresAt: now + PRODUCTS_CACHE_TTL_MS,
  };

  return products;
};

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

const SALES_CHANNEL_ID = process.env.NEXT_PUBLIC_SALES_CHANNEL_ID;
const MEDUSA_BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000";
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "";

// ============================================================================
// TIPOS
// ============================================================================

export interface ListProductsOptions {
  page?: number;
  limit?: number;
  sortBy?: SortOptions;
  countryCode?: string;
  regionId?: string;
  categoryId?: string;
  collectionId?: string;
  productIds?: string[];
  searchQuery?: string;
  erpSubcategoryId?: string;
  inStock?: boolean;
}

export interface ProductsResponse {
  products: HttpTypes.StoreProduct[];
  count: number;
  currentPage: number;
  totalPages: number;
  nextPage: number | null;
  prevPage: number | null;
}

// ============================================================================
// REPOSITORIO DE PRODUCTOS
// ============================================================================

/**
 * Lista productos del canal de ventas con paginación y filtros
 * Usa endpoint custom /store/product-promotion para obtener productos con precios promocionales
 */
export async function listProducts(
  options: ListProductsOptions,
): Promise<ProductsResponse> {
  const {
    page = 1,
    limit = 12,
    sortBy = "created_at",
    countryCode,
    regionId,
    categoryId,
    collectionId,
    productIds,
    searchQuery,
  } = options;

  // Validación
  if (!countryCode && !regionId) {
    throw new Error(
      "[ProductsRepository] Country code or region ID is required",
    );
  }

  // Obtener región
  let region: HttpTypes.StoreRegion | undefined | null;
  if (countryCode) {
    region = await getRegion(countryCode);
  } else {
    region = await retrieveRegion(regionId!);
  }

  // Si no hay región y no se pasan productIds específicos, retornar vacío
  // Pero si hay productIds, intentar obtenerlos aunque no haya región (modo desarrollo)
  if (!region && !productIds?.length) {
    return {
      products: [],
      count: 0,
      currentPage: page,
      totalPages: 0,
      nextPage: null,
      prevPage: null,
    };
  }

  // Usar endpoint custom /store/product-promotion en lugar del SDK
  // Este endpoint trae productos con precios promocionales y soporte para customer groups
  // NO pasamos parámetros de filtro - el endpoint devuelve todos los productos del sales channel
  const backendParams = new URLSearchParams();
  backendParams.set(
    "fields",
    "*variants.calculated_price,+description,+subtitle,+metadata,+tags",
  );

  // El canal de la TIENDA ACTIVA. Sin esto el endpoint lo resuelve desde la
  // publishable key, que es una sola para toda la instancia: todas las tiendas
  // recibirían el mismo catálogo de promociones.
  const activeChannelId = await getActiveSalesChannelId();
  if (activeChannelId) backendParams.set('sales_channel_id', activeChannelId);

  // Construir URL del backend
  const backendUrl = `${MEDUSA_BACKEND_URL}/store/product-promotion?${backendParams.toString()}`;

  let products: any[] = [];

  try {
    products = await getCachedPromotionProducts(backendUrl, PUBLISHABLE_KEY);
  } catch (error) {
    console.error(
      "[ProductsRepository] Error fetching products from backend:",
      error,
    );
    // Retornar vacío si el backend no está disponible
    return {
      products: [],
      count: 0,
      currentPage: page,
      totalPages: 0,
      nextPage: null,
      prevPage: null,
    };
  }

  // Filtrar por región (verificar que el producto esté disponible en la región)
  if (region?.id) {
    products = products.filter((product: any) => {
      // Si el producto no tiene variants, lo excluimos
      if (!product.variants || product.variants.length === 0) return false;
      // Verificar que al menos una variante tenga precio en esta región
      return product.variants.some((variant: any) => variant.calculated_price);
    });
  }

  // Filtrar por categoría si se especifica
  if (categoryId) {
    products = products.filter((product: any) => {
      const categoryIds = new Set<string>();

      const rawCategories = product?.categories;
      if (Array.isArray(rawCategories)) {
        for (const cat of rawCategories) {
          if (!cat) continue;

          if (typeof cat === "string") {
            categoryIds.add(cat);
            continue;
          }

          if (typeof cat?.id === "string") {
            categoryIds.add(cat.id);
          }

          if (typeof cat?.parent_category?.id === "string") {
            categoryIds.add(cat.parent_category.id);
          }
        }
      }

      const rawCategoryIds = product?.category_ids;
      if (Array.isArray(rawCategoryIds)) {
        for (const id of rawCategoryIds) {
          if (typeof id === "string") {
            categoryIds.add(id);
          }
        }
      }

      return categoryIds.has(categoryId);
    });
  }

  // Filtrar por colección si se especifica
  if (collectionId) {
    products = products.filter((product: any) => {
      const productCollectionId: string | undefined =
        product?.collection_id ?? product?.collection?.id;

      return productCollectionId === collectionId;
    });
  }

  // Filtrar por IDs específicos si se especifican
  if (productIds?.length) {
    products = products.filter((product: any) =>
      productIds.includes(product.id),
    );
  } else {
    // Hide products flagged as not-for-storefront from generic listings.
    // Skipped when the caller passes explicit IDs so internal flows (cart,
    // wishlist, etc.) can still resolve the hidden product on demand.
    products = products.filter(
      (product: any) =>
        product?.metadata?.hidden_from_store !== true &&
        product?.metadata?.hidden_from_store !== "true",
    );
  }

  // Filtrar productos sin imágenes
  let productsWithImages = products.filter(
    (product: any) => product.images && product.images.length > 0,
  );

  // Si hay searchQuery, hacer un filtrado estricto en nuestro lado
  if (searchQuery && searchQuery.trim().length > 0) {
    const lowerQuery = searchQuery.toLowerCase().trim();
    const queryTerms = lowerQuery.split(/\s+/).filter(Boolean);

    productsWithImages = productsWithImages.filter((product: any) => {
      const title = product.title?.toLowerCase() || "";
      const description = product.description?.toLowerCase() || "";
      const handle = product.handle?.toLowerCase() || "";
      const subtitle = product.subtitle?.toLowerCase() || "";

      // Tags: puede ser array de objetos con 'value' o strings directos
      const tags =
        product.tags
          ?.map((tag: any) => {
            if (typeof tag === "string") return tag.toLowerCase();
            return tag?.value?.toLowerCase() || "";
          })
          .filter(Boolean)
          .join(" ") || "";

      // Categorías: buscar en nombres y handles de categorías
      const categoryNames =
        product.categories
          ?.map((cat: any) => cat.name?.toLowerCase() || "")
          .filter(Boolean) || [];
      const categoryHandles =
        product.categories
          ?.map((cat: any) => cat.handle?.toLowerCase() || "")
          .filter(Boolean) || [];
      const categories = [...categoryNames, ...categoryHandles].join(" ");

      // Buscar en todos los campos relevantes
      const searchableText =
        `${title} ${subtitle} ${description} ${handle} ${tags} ${categories}`.trim();

      // Todos los términos deben estar presentes (búsqueda AND)
      const matches = queryTerms.every((term) => searchableText.includes(term));

      return matches;
    });
  }

  // Ordenar productos
  const sortedProducts = sortProducts(productsWithImages, sortBy);

  // Paginar
  const offset = (page - 1) * limit;
  const paginatedProducts = sortedProducts.slice(offset, offset + limit);
  const totalPages = Math.ceil(sortedProducts.length / limit);

  return {
    products: paginatedProducts,
    count: sortedProducts.length,
    currentPage: page,
    totalPages,
    nextPage: page < totalPages ? page + 1 : null,
    prevPage: page > 1 ? page - 1 : null,
  };
}

/**
 * Obtiene un producto por ID
 * Usa sdk.store.product.retrieve() del SDK oficial de Medusa
 */
export async function getProductById(
  productId: string,
  countryCode: string,
): Promise<HttpTypes.StoreProduct | null> {
  const region = await getRegion(countryCode);

  if (!region) {
    return null;
  }

  try {
    const { product } = await sdk.store.product.retrieve(productId, {
      region_id: region.id,
      sales_channel_id: SALES_CHANNEL_ID,
      fields: "*variants.calculated_price,+metadata,+tags",
    } as Parameters<typeof sdk.store.product.retrieve>[1]);

    return product;
  } catch (error) {
    return null;
  }
}
