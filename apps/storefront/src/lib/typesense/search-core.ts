// Orquestador puro de búsqueda Typesense — sin `server-only` ni dependencias
// que lo importen transitivamente. Importable desde el browser.

import typesenseClient, {
  TYPESENSE_COLLECTION_NAME,
  TYPESENSE_SEARCH_PRESET,
} from "./client";
import type { SearchResponse } from "typesense/lib/Typesense/Documents";
import type {
  TypesenseProductDocument,
  TypesenseProductsParams,
  TypesenseProductsResponse,
  TypesenseFacetCount,
  TypesenseFacetStats,
} from "./types";
import { normalizeSearchQuery } from "./core/normalize";
import { buildSortBy } from "./core/sort";
import { buildBaseFilterBy, buildUserFilterBy } from "./core/filters";
import { buildQueryByFields } from "./core/query-by";
import {
  CORE_FACET_FIELDS,
  MAX_FACET_VALUES,
  getAvailableFacetFields,
} from "./core/facets";
import { applyPromotionPricing } from "./core/enrich";

/** Techos de paginación: Typesense corta en 250 por página. */
const MAX_LIMIT = 250;
const MAX_PAGE = 1000;

/**
 * Normaliza un número que puede venir de contenido editable o de la URL a un
 * entero dentro de [1, max]. Cualquier basura (negativo, 0, NaN, decimal,
 * string) cae al `fallback`, porque Typesense responde 400 y tumba la búsqueda.
 */
const clampPositiveInt = (
  value: unknown,
  fallback: number,
  max: number,
): number => {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, max);
};

// Tipos internos para mapear hits y facetas crudas de Typesense.
type TypesenseHit = {
  document: TypesenseProductDocument;
  highlight?: Record<string, unknown>;
  highlights?: Array<Record<string, unknown>>;
};

type RawFacetValueCount = {
  value: string;
  count: number;
};

type RawFacetCount = {
  field_name: string;
  counts: RawFacetValueCount[];
  stats?: TypesenseFacetStats;
};

/** Normaliza las facetas de una respuesta, preservando `stats` (rango de precio). */
const mapFacetCounts = (
  response: SearchResponse<TypesenseProductDocument> | null,
): TypesenseFacetCount[] =>
  ((response?.facet_counts as RawFacetCount[] | undefined) || []).map((fc) => ({
    field_name: fc.field_name,
    counts: fc.counts.map((c) => ({ value: c.value, count: c.count })),
    ...(fc.stats ? { stats: fc.stats } : {}),
  }));

// Una vez que una colección demostró no tener las facetas opcionales, no tiene
// sentido pagar el 404 + reintento en CADA búsqueda de la sesión.
let degradedToCoreFacets = false;

// El storefront es solo-search en Typesense (la search-only key no puede leer el
// schema). Por eso NO introspeccionamos: las funciones de gating reciben un Set
// vacío (modo conservador para los filtros) y las facetas se piden de forma
// optimista. Si una faceta opcional no existe en la colección, Typesense devuelve
// un 404 "facet field not found" y reintentamos con las facetas CORE.
const EMPTY_SCHEMA: Set<string> = new Set<string>();

/** Detecta el 404 de Typesense cuando una faceta pedida no existe en el schema. */
function isFacetFieldNotFound(error: unknown): boolean {
  const e = error as { httpStatus?: number; message?: string };
  const msg = e?.message || "";
  return (
    /facet field named/i.test(msg) ||
    (e?.httpStatus === 404 && /facet/i.test(msg))
  );
}

export function executeSearch<TDocument extends object>(
  searchParams: Record<string, unknown>,
): Promise<SearchResponse<TDocument>> {
  return typesenseClient
    .collections(TYPESENSE_COLLECTION_NAME)
    .documents()
    .search(searchParams) as Promise<SearchResponse<TDocument>>;
}

export async function searchWithPresetFallback<TDocument extends object>(
  baseParams: Record<string, unknown>,
): Promise<SearchResponse<TDocument>> {
  const { queryBy, weights, numTypos, prefix } = buildQueryByFields();

  // La fuente de verdad de la relevancia es `core/query-by.ts`, no el preset del
  // servidor: estos overrides se pasan a propósito DESPUÉS del preset para
  // pisarlo. Un preset editado desde el admin puede omitir campos de query_by o
  // aplanar los pesos, y eso reintroduciría el empate masivo que esta config
  // arregla. El preset sigue sirviendo para lo que no toca la relevancia.
  const queryOverrides: Record<string, unknown> = {
    query_by: queryBy,
    query_by_weights: weights,
    // Por campo, alineado posicionalmente con query_by (ver query-by.ts).
    num_typos: numTypos,
    prefix,

    // Protege identificadores: "AB1234" no debe matchear "AB1235". Default `true`.
    // Es lo que hace seguro el peso alto de `variants.sku`.
    enable_typos_for_alpha_numerical_tokens: false,

    // Default `true`, y causa un bug clásico de e-commerce: "aerosol 500" trae
    // productos de 600ml porque 500 y 600 están a una edición de distancia.
    // Crítico en un catálogo con ml/gr/litros/talles.
    enable_typos_for_numerical_tokens: false,

    // Default `1` = "si hay al menos 1 resultado, no busques variantes con
    // typos". Con una grilla de 12, una query con 2 matches exactos muestra una
    // página casi vacía cuando la variante corregida la llenaría.
    typo_tokens_threshold: 10,

    // `mapHits` sólo lee `hit.document` y descarta los highlights. Sin esto,
    // Typesense highlightea los 11 campos de query_by en cada tecla, gratis.
    highlight_fields: "title",

    // NO setear (los defaults de Typesense ya son los correctos para este caso):
    //   min_len_1typo: 4, min_len_2typo: 7  → ya calibrados: "remra" (5) tolera
    //     1 typo, "pantalno" (8) tolera 2.
    //   split_join_tokens: "fallback"       → "pantalon corto" ↔ "pantaloncorto"
    //     sólo cuando la búsqueda normal no devuelve nada. Ideal.
    //   prioritize_exact_match: true, drop_tokens_mode: "right_to_left"
    //     → right_to_left es correcto para español, donde el sustantivo núcleo va
    //       primero ("remera oversize negra").
    //
    // drop_tokens_threshold se deja en su default (1) A PROPÓSITO, en asimetría
    // con typo_tokens_threshold: subirlo haría que "remera oversize" con 2
    // resultados devuelva 200 ítems y el usuario crea que el segundo término no
    // se aplicó. Un typo es un error del usuario que conviene perdonar; un token
    // es intención del usuario que conviene respetar.
  };

  if (TYPESENSE_SEARCH_PRESET) {
    try {
      return await executeSearch({
        ...baseParams,
        preset: TYPESENSE_SEARCH_PRESET,
        ...queryOverrides,
      });
    } catch {
      // El preset no existe o falló — caer en defaults abajo
    }
  }

  return executeSearch({
    ...baseParams,
    ...queryOverrides,
  });
}

/**
 * Orquestador puro de búsqueda. Recibe los IDs de promociones activas como
 * parámetro (nunca los fetcha). Sin analytics — el caller es responsable.
 *
 * @param params - Parámetros de búsqueda
 * @param activePromoIds - IDs de promociones activas para el canal, o null para
 *   omitir el filtro de promociones (mismo comportamiento que cuando no hay canal
 *   configurado o no hay productos con promociones).
 */
export async function searchTypesenseProductsCore(
  params: TypesenseProductsParams,
  activePromoIds: Set<string> | null,
): Promise<TypesenseProductsResponse> {
  // `page`/`limit` terminan en `per_page`/`page` de Typesense, que rechaza con
  // 400 cualquier valor no positivo. Como estos números pueden venir de contenido
  // editable (el editor del home guarda la Cantidad de cada fila) o de una query
  // string, se sanean acá: un `limit: -9` guardado hacía fallar la búsqueda y la
  // sección desaparecía entera.
  const page: number = clampPositiveInt(params.page, 1, MAX_PAGE);
  const limit: number = clampPositiveInt(params.limit, 12, MAX_LIMIT);
  const rawQuery: string = params.q?.trim() || "*";
  const query: string = normalizeSearchQuery(rawQuery);

  // Se separa el cálculo de filtros para que la query de facet-universe pueda
  // aplicar solo los filtros base (que definen qué pertenece a la tienda)
  // dejando afuera los filtros de usuario — así la barra lateral muestra valores
  // de otros filtros que el usuario podría combinar con su selección actual, pero
  // nunca surfacea productos ocultos/canal-incorrecto/precio-cero en esos conteos.
  const baseFilterBy: string = buildBaseFilterBy(params);
  const userFilterBy: string = buildUserFilterBy(params, EMPTY_SCHEMA);
  const filterBy: string = [baseFilterBy, userFilterBy]
    .filter(Boolean)
    .join(" && ");
  const hasFilters: boolean = Boolean(userFilterBy);

  const sortBy = buildSortBy(params.sortBy);

  // Ejecuta la búsqueda listada + (opcional) la de facet-universe con un set de
  // facetas dado. Se extrae para poder reintentar con menos facetas ante un 404.
  async function runSearches(facetFields: string[]): Promise<{
    filteredResponse: SearchResponse<TypesenseProductDocument>;
    universeResponse: SearchResponse<TypesenseProductDocument> | null;
  }> {
    const commonParams: Record<string, unknown> = {
      q: query,
      sort_by: sortBy,
      page,
      per_page: limit,
      facet_by: facetFields.length > 0 ? facetFields.join(",") : undefined,
      // Ver MAX_FACET_VALUES: un tope corto trunca facetas EN SILENCIO (marcas
      // primero, categorías después). No afecta al autocomplete, que no pide
      // facetas.
      max_facet_values: MAX_FACET_VALUES,
    };

    const filteredParams: Record<string, unknown> = {
      ...commonParams,
      filter_by: filterBy || undefined,
    };

    const universeParams: Record<string, unknown> = {
      ...commonParams,
      per_page: 0,
      filter_by: baseFilterBy || undefined,
    };

    const universePromise:
      | Promise<SearchResponse<TypesenseProductDocument>>
      | null =
      params.facets && hasFilters
        ? searchWithPresetFallback<TypesenseProductDocument>(universeParams)
        : null;

    const filteredResponse =
      await searchWithPresetFallback<TypesenseProductDocument>(filteredParams);
    const universeResponse = universePromise ? await universePromise : null;
    return { filteredResponse, universeResponse };
  }

  const primaryFacets = params.facets
    ? degradedToCoreFacets
      ? CORE_FACET_FIELDS
      : getAvailableFacetFields(EMPTY_SCHEMA)
    : [];

  let filteredResponse: SearchResponse<TypesenseProductDocument>;
  let universeResponse: SearchResponse<TypesenseProductDocument> | null;

  try {
    ({ filteredResponse, universeResponse } = await runSearches(primaryFacets));
  } catch (error) {
    // Una faceta opcional (p. ej. promociones) no existe en esta colección:
    // reintentar solo con CORE en vez de romper toda la búsqueda.
    if (
      isFacetFieldNotFound(error) &&
      primaryFacets.length > CORE_FACET_FIELDS.length
    ) {
      console.debug(
        "[TYPESENSE] Faceta opcional ausente en la colección; reintentando con facetas core.",
      );
      degradedToCoreFacets = true;
      ({ filteredResponse, universeResponse } =
        await runSearches(CORE_FACET_FIELDS));
    } else {
      console.error("[TYPESENSE ERROR] Search failed:", error);
      console.error("[TYPESENSE ERROR] Params:", {
        page,
        limit,
        filterBy,
        query,
      });
      throw error;
    }
  }

  const rawProducts = (filteredResponse.hits || []).map(
    (hit: TypesenseHit) => hit.document,
  );

  const { products, promotionFilteredCount } = applyPromotionPricing(
    rawProducts,
    params,
    activePromoIds,
  );

  // Recomputar `found` exactamente como el código original (L687-690):
  // si hay filtro de campaña y tenemos IDs de promos, el found real es la
  // longitud del array ya filtrado (la paginación de Typesense no sabe cuántos
  // productos pasarán el filtro client-side de promo activa).
  const found =
    params.promotion && activePromoIds
      ? promotionFilteredCount
      : filteredResponse.found || 0;
  const totalPages = Math.ceil(found / limit);

  const facetCounts: TypesenseFacetCount[] = mapFacetCounts(filteredResponse);

  const facetUniverse: TypesenseFacetCount[] = universeResponse
    ? mapFacetCounts(universeResponse)
    : facetCounts;

  return {
    products,
    found,
    page,
    totalPages,
    facetCounts,
    facetUniverse,
    // `universeResponse` sólo existe cuando había filtros de usuario que quitar,
    // que es exactamente el caso en que este dato sirve.
    ...(universeResponse ? { unfilteredFound: universeResponse.found || 0 } : {}),
  };
}
