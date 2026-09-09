"use server";

import { sdk } from "@lib/config";
import { isHiddenFromStore } from "@lib/util/hidden-product";
import {
  seoPageOffsets,
  toSeoProduct,
  type SeoProduct,
} from "@lib/util/seo/product-entries";
import { withTimeout } from "@lib/util/with-timeout";
import type { HttpTypes } from "@medusajs/types";
import type { SortOptions } from "@modules/store/components/refinement-list/sort-products";
import { getActiveSalesChannelId, getAuthHeaders, getCacheOptions } from "./cookies";
import { getRegion, retrieveRegion } from "./regions";

/**
 * Topes del fetch de productos para SEO. Ver `listProductsForSeo()` al final del
 * archivo para de dónde salen estos números (están MEDIDOS, no elegidos).
 */
const SEO_PAGE_LIMIT: number = 500;
const SEO_HARD_CAP: number = 20_000;
const SEO_FETCH_BUDGET_MS: number = 30_000;
const SEO_PER_REQUEST_TIMEOUT_MS: number = 12_000;

export const listProducts = async ({
  pageParam = 1,
  queryParams,
  countryCode,
  regionId,
}: {
  pageParam?: number;
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductListParams;
  countryCode?: string;
  regionId?: string;
}): Promise<{
  response: { products: HttpTypes.StoreProduct[]; count: number };
  nextPage: number | null;
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductListParams;
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
            "*variants.calculated_price,+variants.metadata,+variants.inventory_quantity,+metadata,+tags",
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
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductListParams;
  sortBy?: SortOptions;
  countryCode: string;
}): Promise<{
  response: { products: HttpTypes.StoreProduct[]; count: number };
  nextPage: number | null;
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductListParams;
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
    "*variants.calculated_price,+variants.metadata,+variants.inventory_quantity,+metadata,+tags";
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
        "*variants.calculated_price,+variants.metadata,+variants.inventory_quantity,+metadata,+tags",
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
            "*variants.calculated_price,+variants.metadata,+variants.inventory_quantity,+metadata,+tags",
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

/**
 * ─── PRODUCTOS PARA LAS SUPERFICIES SEO ──────────────────────────────────────
 *
 * Los productos que publican `sitemap.xml` y `llms.txt`, en la forma mínima que esas
 * rutas consumen (handle, título, subtítulo, fecha).
 *
 * NO usa `listProducts()`, y las dos razones por las que no son las dos causas por las
 * que el sitemap de desdeelsur publicó 12 URLs y CERO de sus 2.696 productos, con 200
 * OK, durante semanas (DESDEELSUR-50):
 *
 *  1. **`listProducts()` exige una REGIÓN, y resolverla es case-sensitive.**
 *     `getRegion()` hace `regionMap.get(countryCode)` contra los `iso_2` del backend,
 *     que son minúsculas. El país sale de la cadena
 *     `NEXT_PUBLIC_COUNTRY_CODE || NEXT_PUBLIC_DEFAULT_REGION || 'ar'`, y `proxy.ts` y
 *     `site-config/site-path.ts` la bajan a minúsculas — pero `app/sitemap.ts` y
 *     `app/llms.txt/route.ts` la leían crudas. Con la env en `AR` el proxy rewritea a
 *     `/ar/...` y el PDP anda perfecto, mientras el sitemap recibe `undefined` de
 *     `getRegion()` y `listProducts()` devuelve `{ products: [], count: 0 }` — sin
 *     throw, sin log, sin nada que mirar. Catálogo entero desaparecido en silencio.
 *
 *     Acá no hay región porque no hace falta: un `<loc>` no muestra precios.
 *
 *  2. **`listProducts()` pide `*variants.calculated_price`**, que dispara el cálculo de
 *     precios por producto. Medido contra el backend de desdeelsur: 1,5 s por página de
 *     100 → 27 páginas ≈ 40 s, contra un presupuesto de 30 s. O sea que arreglar sólo
 *     la región habría dado un sitemap PARCIAL y el ticket habría vuelto.
 *
 *     Sin pricing la misma query baja a ~0,9 s por página de 500: los 2.696 productos
 *     entran en 6 requests y ~5,5 s.
 *
 * Secuencial a propósito: 6 requests contra un backend detrás de Cloudflare no
 * justifican paralelizar, y el Data Cache absorbe los crawls repetidos. Si el catálogo
 * creciera un orden de magnitud, el próximo paso es un sitemap indexado, no 40
 * requests en paralelo.
 *
 * `complete: false` es el contrato que faltaba: el llamador puede decir la verdad —y
 * logguear— en vez de degradar callado, que es cómo esto duró semanas.
 */
export const listProductsForSeo = async ({
  max = SEO_HARD_CAP,
  budgetMs = SEO_FETCH_BUDGET_MS,
  perRequestTimeoutMs = SEO_PER_REQUEST_TIMEOUT_MS,
}: {
  /** Cuántos productos publicar como máximo. Default: el techo de seguridad. */
  max?: number;
  budgetMs?: number;
  perRequestTimeoutMs?: number;
} = {}): Promise<{
  products: SeoProduct[];
  /** Cuántos productos tiene el catálogo, según el `count` del backend. */
  total: number;
  /** ¿Se trajo todo lo PEDIDO, sin fallas ni corte por presupuesto? */
  complete: boolean;
  /** ¿El catálogo es más grande que `max`? Truncar a propósito no es fallar. */
  truncated: boolean;
}> => {
  const pageLimit = Math.max(1, Math.min(SEO_PAGE_LIMIT, max));
  const salesChannelId = await getActiveSalesChannelId();
  const next = { ...(await getCacheOptions("products")) };

  // SIN `getAuthHeaders()`, a propósito: un sitemap es anónimo por definición y estas
  // respuestas se cachean por URL. Mandar el JWT de quien pasó por acá primero haría el
  // listado dependiente de una sesión.
  const fetchPage = (offset: number) =>
    withTimeout(
      sdk.client.fetch<{ products: unknown[]; count: number }>("/store/products", {
        method: "GET",
        query: {
          limit: pageLimit,
          offset,
          sales_channel_id: salesChannelId,
          fields: "handle,title,subtitle,updated_at,metadata",
        },
        next,
        cache: "force-cache",
      }),
      perRequestTimeoutMs,
      `seo-products offset ${offset}`
    );

  const products: SeoProduct[] = [];
  const collect = (raw: unknown[]) => {
    for (const item of raw) {
      if (products.length >= max) return;
      const product = toSeoProduct(item as Parameters<typeof toSeoProduct>[0]);
      if (product) products.push(product);
    }
  };

  const startedAt = Date.now();
  let total = 0;

  // La primera página se pide siempre: de su `count` sale el plan de las demás.
  try {
    const first = await fetchPage(0);
    total = first.count ?? 0;
    collect(first.products ?? []);
  } catch (error) {
    console.error("[seo-products] la primera página falló; no hay catálogo:", error);
    return { products: [], total: 0, complete: false, truncated: false };
  }

  let complete = true;
  for (const offset of seoPageOffsets(total, pageLimit, max).slice(1)) {
    if (products.length >= max) break;
    if (Date.now() - startedAt > budgetMs) {
      console.error(
        `[seo-products] presupuesto de ${budgetMs}ms agotado en el offset ${offset}: ` +
          `${products.length} de ${total} productos`
      );
      complete = false;
      break;
    }
    try {
      const page = await fetchPage(offset);
      collect(page.products ?? []);
    } catch (error) {
      console.error(
        `[seo-products] falló el offset ${offset}; ${products.length} de ${total}:`,
        error
      );
      complete = false;
      break;
    }
  }

  return { products, total, complete, truncated: total > max };
};
