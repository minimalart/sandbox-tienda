// Resolución de variantes para las cards del catálogo (documentos Typesense).
//
// El documento Typesense NO indexa las `options` por variante, solo el título
// de cada variante y las `options` a nivel producto. Por eso la detección de
// "individual" vs "bulto" se hace por el título de la variante (misma convención
// que `get-individual-variant`, que en el PDP tiene las options completas).
//
// REGLA B2C: la tienda nunca ofrece la variante mayorista "Bulto"; solo cuenta
// como presentación vendible todo lo que NO sea bulto.

import type { TypesenseProductDocument } from "@lib/typesense";

type DocVariant = TypesenseProductDocument["variants"][number];

const BULK_RE = /bulto/i;
const INDIVIDUAL_RE = /individual/i;

/**
 * Variantes que la tienda B2C puede vender: se descarta la de "Bulto"
 * (detectada por título). Si al filtrar no queda ninguna (títulos atípicos),
 * se devuelven todas para no dejar el producto sin variante comprable.
 */
export function getSellableVariantsFromDoc(
  variants: TypesenseProductDocument["variants"] | undefined | null,
): DocVariant[] {
  const list = variants ?? [];
  if (list.length <= 1) return list;
  const nonBulk = list.filter((v) => !BULK_RE.test(v.title ?? ""));
  return nonBulk.length > 0 ? nonBulk : list;
}

/**
 * Id de la variante "Individual" del documento. Para productos de una sola
 * presentación devuelve esa; para los que tienen Individual + Bulto devuelve la
 * Individual. Reemplaza el uso directo de `variants[0]`, que podía terminar
 * agregando la variante de Bulto según el orden del índice.
 */
export function getIndividualVariantIdFromDoc(
  product: Pick<TypesenseProductDocument, "variants">,
): string | null {
  const variants = product.variants ?? [];
  if (variants.length === 0) return null;
  if (variants.length === 1) return variants[0].id;
  const individual = variants.find((v) => INDIVIDUAL_RE.test(v.title ?? ""));
  if (individual) return individual.id;
  const sellable = getSellableVariantsFromDoc(variants);
  return sellable[0]?.id ?? variants[0].id;
}

/**
 * ¿El producto ofrece más de una presentación vendible? (tamaños, colores,
 * sabores…). En ese caso el quick-add es ambiguo y debe abrir un selector en
 * vez de agregar `variants[0]` a ciegas.
 */
export function isMultiVariantProduct(
  product: Pick<TypesenseProductDocument, "variants">,
): boolean {
  return getSellableVariantsFromDoc(product.variants).length > 1;
}
