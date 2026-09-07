/**
 * Config de relevancia del buscador del ADMIN.
 *
 * ESPEJO de `apps/storefront/src/lib/typesense/core/query-by.ts`, que es la fuente
 * de verdad. Mismo orden, mismos pesos, mismos typos por campo — así el operador
 * ve en el backoffice lo mismo que ve el comprador en el storefront. Hay un test
 * de paridad (`search-defaults.test.ts`) que falla si los dos archivos divergen.
 *
 * `handle` estaba en esta lista y se removió: con `token_separators` vacío en el
 * schema, "remera-oversize-negra" es UN token, así que "remera" no matchea salvo
 * como prefijo del slug entero. Costaba CPU sin aportar recall.
 */
export const STOREFRONT_TYPESENSE_QUERY_BY_FIELDS = [
  'title',
  'variants.sku',
  'brand.name',
  'tags.value',
  'collection.title',
  'categories.name',
  'options.values',
  'categories.parent_category.name',
  'variants.title',
  'subtitle',
  'description',
] as const;

/** Desempate bajo `text_match_type: max_score`. Alineado posicionalmente. */
export const STOREFRONT_TYPESENSE_QUERY_BY_WEIGHT_VALUES = [
  100, 90, 60, 40, 30, 25, 20, 15, 12, 8, 3,
] as const;

/** Typos tolerados por campo. Alineado posicionalmente. */
export const STOREFRONT_TYPESENSE_NUM_TYPOS_VALUES = [
  2, 0, 1, 1, 1, 1, 0, 1, 1, 1, 0,
] as const;

/** Prefix match por campo. Alineado posicionalmente. */
export const STOREFRONT_TYPESENSE_PREFIX_VALUES = [
  true, true, true, true, true, true, true, true, true, true, false,
] as const;

export const STOREFRONT_TYPESENSE_QUERY_BY = STOREFRONT_TYPESENSE_QUERY_BY_FIELDS.join(',');
export const STOREFRONT_TYPESENSE_QUERY_BY_WEIGHTS =
  STOREFRONT_TYPESENSE_QUERY_BY_WEIGHT_VALUES.join(',');

export const STOREFRONT_TYPESENSE_TYPO_PARAMS = {
  query_by_weights: STOREFRONT_TYPESENSE_QUERY_BY_WEIGHTS,
  num_typos: STOREFRONT_TYPESENSE_NUM_TYPOS_VALUES.join(','),
  prefix: STOREFRONT_TYPESENSE_PREFIX_VALUES.join(','),

  // Protegen identificadores y medidas: "AB1234" no debe matchear "AB1235", y
  // "aerosol 500" no debe traer 600ml. Ambos son `true` por default en Typesense.
  enable_typos_for_alpha_numerical_tokens: false,
  enable_typos_for_numerical_tokens: false,

  // Default 1 = "con 1 resultado, no busques variantes con typos". Muy conservador
  // para una grilla de 12.
  typo_tokens_threshold: 10,

  // Se deja en el default A PROPÓSITO, en asimetría con typo_tokens_threshold:
  // subirlo hace que una query de 2 términos devuelva los resultados de 1 solo.
  drop_tokens_threshold: 1,

  // OJO: `remove_stop_words` estaba acá y NO EXISTE en Typesense — era un
  // algolismo que el server ignoraba en silencio. El mecanismo real es
  // `stopwords: '<nombre-del-set>'` sobre un set creado con la API de stopwords.
} as const;

export const TYPESENSE_ADMIN_DEFAULT_PER_PAGE = 12;

export function normalizeTypesenseQuery(query?: string | null): string {
  const trimmed = query?.trim() ?? '';

  if (!trimmed || trimmed === '*') {
    return '*';
  }

  const stripped = trimmed.replace(/^\*+/, '').replace(/\*+$/, '').trim();
  return stripped.length > 0 ? stripped : '*';
}

export function getStaleTypesenseDocumentIds(
  existingIds: string[],
  incomingIds: string[]
): string[] {
  const incomingIdSet = new Set(incomingIds.filter(Boolean));
  return existingIds.filter((id) => id && !incomingIdSet.has(id));
}
