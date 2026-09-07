"use server";

import { sdk } from "@lib/config";
import { isHiddenFromStore } from "@lib/util/hidden-product";
import type { HttpTypes } from "@medusajs/types";
import type { SortOptions } from "@modules/store/components/refinement-list/sort-products";
import { getActiveSalesChannelId, getAuthHeaders, getCacheOptions } from "./cookies";
import { getRegion, retrieveRegion } from "./regions";

export const listProducts = async ({
  pageParam = 1,
  queryParams,
  countryCode,
  regionId,
}: {
  pageParam?: number;
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductParams;
  countryCode?: string;
  regionId?: string;
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

  let region: HttpTypes.StoreRegion | undefined | null;

  if (countryCode) {
    region = await getRegion(countryCode);
  } else {
    region = await retrieveRegion(regionId!);
  }

  if (!region) {
    return {
      response: { products: [], count: 0 },
      nextPage: null,
    };
  }

  const headers = {
    ...(await getAuthHeaders()),
  };

  const next = {
    ...(await getCacheOptions("products")),
  };

  const salesChannelId = await getActiveSalesChannelId();

  return sdk.client
    .fetch<{ products: HttpTypes.StoreProduct[]; count: number }>(
      "/store/products",
      {
        method: "GET",
        query: {
          limit,
          offset,
          region_id: region?.id,
          sales_channel_id: salesChannelId,
          fields:
            "*variants.calculated_price,+variants.inventory_quantity,+metadata,+tags",
          ...queryParams,
        },
        headers,
        next,
        cache: "force-cache",
      }
    )
    .then(({ products, count }) => {
      // Drop products explicitly hidden from the storefront (sitemap/llms.txt
      // and any other generic listing fed by this function). The PDP-by-handle
      // path also 404s for these, so emitting their URLs here would only
      // produce dead links. Skip the filter when the caller passes explicit
      // ids so internal flows can still resolve hidden products.
      const explicitIds = (queryParams as { id?: unknown } | undefined)?.id;
      const visibleProducts = explicitIds
        ? products
        : products.filter((p) => !isHiddenFromStore(p));
      const nextPage = count > offset + limit ? pageParam + 1 : null;

      return {
        response: {
          products: visibleProducts,
          count,
        },
        nextPage,
        queryParams,
      };
    });
};

/**
 * This will fetch 100 products to the Next.js cache and sort them based on the sortBy parameter.
 * It will then return the paginated products based on the page and limit parameters.
 */
export const listProductsWithSort = async ({
  page = 0,
  queryParams,
  sortBy = "created_at",
  countryCode,
}: {
  page?: number;
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductParams;
  sortBy?: SortOptions;
  countryCode: string;
}): Promise<{
  response: { products: HttpTypes.StoreProduct[]; count: number };
  nextPage: number | null;
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductParams;
}> => {
  const limit = queryParams?.limit || 12;

  // Convert sortBy to Medusa's order parameter format
  let order: string | undefined;
  switch (sortBy) {
    case "price_asc":
      order = "variants.calculated_price.calculated_amount";
      break;
    case "price_desc":
      order = "-variants.calculated_price.calculated_amount";
      break;
    case "created_at":
    default:
      order = "-created_at";
      break;
  }

  const {
    response: { products, count },
    nextPage,
  } = await listProducts({
    pageParam: page,
    queryParams: {
      ...queryParams,
      limit,
      order,
    },
    countryCode,
  });

  return {
    response: {
      products,
      count,
    },
    nextPage,
    queryParams,
  };
};

/**
 * Obtiene productos específicos por sus IDs
 */
export const getProductsByIds = async ({
  productIds,
  countryCode,
  regionId,
  extraFields,
}: {
  productIds: string[];
  countryCode?: string;
  regionId?: string;
  extraFields?: string;
}): Promise<HttpTypes.StoreProduct[]> => {
  if (!(countryCode || regionId)) {
    throw new Error("Country code or region ID is required");
  }

  if (!productIds.length) {
    return [];
  }

  let region: HttpTypes.StoreRegion | undefined | null;

  if (countryCode) {
    region = await getRegion(countryCode);
  } else {
    region = await retrieveRegion(regionId!);
  }

  if (!region) {
    return [];
  }

  const baseFields =
    "*variants.calculated_price,+variants.inventory_quantity,+metadata,+tags";
  const fields = extraFields ? `${baseFields},${extraFields}` : baseFields;

  // Fetch productos usando sdk.store.product.list() con filtro de IDs
  const { products } = await sdk.store.product.list({
    id: productIds,
    region_id: region.id,
    sales_channel_id: await getActiveSalesChannelId(),
    fields,
  } as Parameters<typeof sdk.store.product.list>[0]);

  // Mantener el orden original de los IDs solicitados
  const orderedProducts = productIds
    .map((id) => products.find((p) => p.id === id))
    .filter((p): p is HttpTypes.StoreProduct => p !== undefined);

  return orderedProducts;
};

/**
 * Obtiene productos filtrados por un tag específico
 */
export const getProductsByTag = async ({
  tagValue,
  limit = 12,
  countryCode,
  regionId,
}: {
  tagValue: string;
  limit?: number;
  countryCode?: string;
  regionId?: string;
}): Promise<HttpTypes.StoreProduct[]> => {
  if (!(countryCode || regionId)) {
    throw new Error("Country code or region ID is required");
  }

  if (!tagValue) {
    return [];
  }

  let region: HttpTypes.StoreRegion | undefined | null;

  if (countryCode) {
    region = await getRegion(countryCode);
  } else {
    region = await retrieveRegion(regionId!);
  }

  if (!region) {
    return [];
  }

  const headers = {
    ...(await getAuthHeaders()),
  };

  const next = {
    ...(await getCacheOptions("products")),
  };

  const salesChannelId = await getActiveSalesChannelId();

  // Fetch productos usando el filtro de tag_id
  const { products } = await sdk.client.fetch<{
    products: HttpTypes.StoreProduct[];
  }>("/store/products", {
    method: "GET",
    query: {
      limit,
      region_id: region.id,
      sales_channel_id: salesChannelId,
      tag_id: tagValue,
      fields:
        "*variants.calculated_price,+variants.inventory_quantity,+metadata,+tags",
    },
    headers,
    next,
    cache: "force-cache",
  });

  return products;
};

/**
 * Obtiene productos alternados (no consecutivos) para optimizar la carga inicial
 * Por ejemplo: si step=10, traerá productos en índices 0, 10, 20, 30, etc.
 */
export const getAlternatedProducts = async ({
  limit = 12,
  step = 10,
  countryCode,
  regionId,
}: {
  limit?: number;
  step?: number;
  countryCode?: string;
  regionId?: string;
}): Promise<HttpTypes.StoreProduct[]> => {
  if (!(countryCode || regionId)) {
    throw new Error("Country code or region ID is required");
  }

  let region: HttpTypes.StoreRegion | undefined | null;

  if (countryCode) {
    region = await getRegion(countryCode);
  } else {
    region = await retrieveRegion(regionId!);
  }

  if (!region) {
    return [];
  }

  const headers = {
    ...(await getAuthHeaders()),
  };

  const next = {
    ...(await getCacheOptions("products")),
  };

  const salesChannelId = await getActiveSalesChannelId();

  // Obtener productos alternados haciendo múltiples requests con offset
  const productPromises = Array.from({ length: limit }, (_, i) => {
    const offset = i * step;
    return sdk.client
      .fetch<{ products: HttpTypes.StoreProduct[] }>("/store/products", {
        method: "GET",
        query: {
          limit: 1,
          offset,
          region_id: region?.id,
          sales_channel_id: salesChannelId,
          fields:
            "*variants.calculated_price,+variants.inventory_quantity,+metadata,+tags",
        },
        headers,
        next,
        cache: "force-cache",
      })
      .then(({ products }) => products[0])
      .catch(() => null);
  });

  const products = await Promise.all(productPromises);
  
  return products.filter((p): p is HttpTypes.StoreProduct => p !== null);
};
