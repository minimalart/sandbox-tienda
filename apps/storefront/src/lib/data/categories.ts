import { sdk } from "@lib/config";
import type { HttpTypes } from "@medusajs/types";
import { getCacheOptions } from "./cookies";
import {
  CATEGORY_DETAIL_FIELDS,
  CATEGORY_TREE_FIELDS,
} from "@lib/constants/category-fields";

/**
 * Vigencia del árbol de categorías en la Data Cache.
 *
 * `force-cache` sin `revalidate` cacheaba el árbol PARA SIEMPRE: el tag
 * (`categories-<cacheId>`) sale de la cookie `_medusa_cache_id`, que el proxy
 * recién setea en la RESPUESTA, así que en la primera visita el server component
 * la lee vacía → `getCacheOptions` devuelve `{}` → el fetch queda cacheado sin
 * tag y no hay nada que lo invalide (la Data Cache de Vercel sobrevive a los
 * deploys). Resultado: categorías nuevas en el backend que nunca aparecían en el
 * filtro de la tienda, que caía a la lista PLANA de facets de Typesense.
 */
const CATEGORY_TREE_REVALIDATE_S = 300;

/**
 * MULTITIENDA — por qué el árbol NO se filtra por tienda acá.
 *
 * `/store/product-categories` es una ruta del CORE de Medusa y su validador no
 * acepta `sales_channel_id`: no hay forma de pedirle el árbol de una tienda. Que
 * todas vean el mismo no es un bug de esta función, es que el catálogo de
 * categorías es global mientras haya una sola publishable key — y hoy la hay, porque
 * `provision.ts` linkea cada canal nuevo a TODAS las keys.
 *
 * Lo que sí se arregla acá es que la entrada de Data Cache no se comparta entre
 * tiendas: el tag lleva el canal activo. Hoy eso no cambia lo que se ve, pero el día
 * que exista una publishable key por tienda, esta cache habría servido el árbol de
 * la primera que la calentó, y encontrarlo de nuevo saldría carísimo.
 */
const categoryCacheTag = async (): Promise<{ tags: string[] } | {}> => {
  const base = await getCacheOptions("categories");
  const tags = (base as { tags?: string[] }).tags;
  if (!tags?.length) return base;

  const { getActiveSalesChannelId } = await import("./cookies");
  const channelId = await getActiveSalesChannelId();
  return channelId ? { tags: tags.map((tag) => `${tag}-${channelId}`) } : base;
};

export const listCategories = async (query?: Record<string, any>) => {
  const next = {
    ...(await categoryCacheTag()),
    revalidate: CATEGORY_TREE_REVALIDATE_S,
  };

  // Trae TODAS las categorías paginando. El default anterior (limit 100) truncaba
  // catálogos grandes (ej. import VTEX con cientos de categorías): las hojas más
  // allá de la 100 no entraban al árbol del filtro de la tienda, así que no se
  // mostraban aunque tuvieran productos. Si se pasa un `limit` explícito, se
  // respeta; si no, se recorren todas las páginas.
  const explicitLimit =
    typeof query?.limit === "number" ? (query.limit as number) : undefined;
  const PAGE = 200;
  const all: HttpTypes.StoreProductCategory[] = [];
  let offset = 0;

  for (;;) {
    const take = explicitLimit
      ? Math.min(PAGE, explicitLimit - all.length)
      : PAGE;
    if (take <= 0) break;

    const { product_categories, count } = await sdk.client.fetch<{
      product_categories: HttpTypes.StoreProductCategory[];
      count: number;
    }>("/store/product-categories", {
      query: {
        fields: CATEGORY_TREE_FIELDS,
        ...query,
        limit: take,
        offset,
      },
      next,
      cache: "force-cache",
    });

    all.push(...product_categories);
    offset += product_categories.length;

    if (product_categories.length === 0) break;
    if (explicitLimit && all.length >= explicitLimit) break;
    if (typeof count === "number" && all.length >= count) break;
  }

  return all;
};

export const getCategoryByHandle = async (categoryHandle: string[]) => {
  const handle = `${categoryHandle.join("/")}`;

  const next = {
    ...(await categoryCacheTag()),
  };

  return sdk.client
    .fetch<HttpTypes.StoreProductCategoryListResponse>(
      "/store/product-categories",
      {
        query: {
          fields: CATEGORY_DETAIL_FIELDS,
          handle,
        },
        // Misma razón que en `listCategories`: sin `revalidate` esto quedaba
        // cacheado para siempre en la primera visita (sin tag que invalidar).
        next: { ...next, revalidate: CATEGORY_TREE_REVALIDATE_S },
        cache: "force-cache",
      }
    )
    .then(({ product_categories }) => product_categories[0]);
};
