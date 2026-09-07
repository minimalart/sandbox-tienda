/**
 * Lectura tipada de los textos SEO que la extensión "catalogador" escribe en
 * `product.metadata`: `meta_title`, `meta_description`, `keywords` y `alt_text`.
 *
 * El catalogador los generaba con IA y el backoffice los aplicaba bien al
 * producto, pero el storefront NUNCA los leía: `generateMetadata` de la PDP
 * componía title/description a mano desde `product.title`/`product.description`
 * y la galería seguía emitiendo `alt="Imagen 1"`. Todo ese trabajo moría en la
 * base de datos.
 *
 * Vive acá, al lado de `faqsFromMetadata`, porque `product.metadata` es un
 * `Record<string, unknown>` sin garantías de forma: cada consumidor que lo lee
 * inline vuelve a escribir los mismos guards (y se olvida de alguno).
 */

/** Mínimo de caracteres que Google no considera `meta-description-too-short`. */
export const META_DESCRIPTION_MIN_LENGTH = 70;

export type ProductSeoMetadata = {
  metaTitle: string | null;
  metaDescription: string | null;
  /** Vacío cuando no hay keywords: `Metadata.keywords` no debe emitirse vacío. */
  keywords: string[];
  altText: string | null;
};

/** String no vacía de `metadata[key]`, o null. Ignora números/objetos/arrays. */
function readString(
  metadata: Record<string, unknown> | null | undefined,
  key: string,
): string | null {
  const raw = metadata?.[key];
  if (typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed ? trimmed : null;
}

/**
 * Keywords normalizadas a `string[]`.
 *
 * El backend acepta las DOS formas (ver `enrichment.ts`: si la IA no devuelve un
 * array, hace `String(raw).split(',')`), así que en metadata pueden aparecer como
 * array o como string separada por comas. Se contempla además el array
 * serializado en JSON, que es lo que queda cuando la metadata viaja por un
 * import/export CSV.
 */
export function keywordsFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
): string[] {
  const raw = metadata?.keywords;
  if (!raw) {
    return [];
  }

  let list: unknown[];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (typeof raw === "string") {
    const parsed = tryParseJsonArray(raw);
    list = parsed ?? raw.split(",");
  } else {
    return [];
  }

  const seen = new Set<string>();
  const keywords: string[] = [];
  for (const entry of list) {
    if (typeof entry !== "string" && typeof entry !== "number") {
      continue;
    }
    const value = String(entry).trim();
    // Dedupe case-insensitive: la IA repite la misma keyword con distinta
    // capitalización y `<meta name="keywords">` duplicada no aporta nada.
    const key = value.toLowerCase();
    if (!value || seen.has(key)) {
      continue;
    }
    seen.add(key);
    keywords.push(value);
  }
  return keywords;
}

function tryParseJsonArray(raw: string): unknown[] | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("[")) {
    return null;
  }
  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    // Metadata mal formada: se trata como texto separado por comas.
    return null;
  }
}

/** Todos los textos SEO del catalogador en un solo objeto. */
export function productSeoFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
): ProductSeoMetadata {
  return {
    metaTitle: readString(metadata, "meta_title"),
    metaDescription: readString(metadata, "meta_description"),
    keywords: keywordsFromMetadata(metadata),
    altText: readString(metadata, "alt_text"),
  };
}

/**
 * Primer candidato que llega al mínimo de 70 caracteres; si ninguno llega,
 * `fallback`.
 *
 * El umbral se aplica a TODOS los candidatos, no sólo al `meta_description` del
 * catalogador: la razón de existir de la descripción compuesta es justamente ese
 * piso de 70 (27 páginas salían con `meta-description-too-short` en la auditoría
 * del 19/08), y aceptar un `product.description` de 30 caracteres pero rechazar
 * un `meta_description` de 30 sería una asimetría imposible de explicar. Cuando
 * el candidato queda corto, la compuesta —título + subtítulo + línea + claim de
 * la tienda— siempre es más informativa que el texto que descartamos.
 */
export function pickMetaDescription(
  candidates: Array<string | null | undefined>,
  fallback: string,
): string {
  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (value && value.length >= META_DESCRIPTION_MIN_LENGTH) {
      return value;
    }
  }
  return fallback;
}
