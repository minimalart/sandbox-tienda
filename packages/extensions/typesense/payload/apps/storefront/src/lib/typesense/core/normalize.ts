// Normalización de queries de búsqueda.
// Sin importaciones externas — puro JS.

// Elimina marcas diacríticas combinatorias para que las versiones acentuadas y
// sin acentos del mismo término colapsen en un solo token.
//
// Para el matching de Typesense esto es REDUNDANTE: sin `locale` seteado en el
// schema, Typesense usa el default `en`, que ya aplana diacríticos europeos
// tanto al indexar como al consultar — "rocio" y "rocío" ya llegan al mismo
// token. Se conserva porque igual sirve para normalizar la clave de analytics
// (así "rocío" y "rocio" no cuentan como dos queries distintas) y porque es
// barato e idempotente.
//
// NO setear `locale: "es"` para "mejorar" esto: pasa a tokenización ICU, que
// PRESERVA los diacríticos, y ahí "rocio" sólo encontraría "Rocío" vía
// tolerancia a typos. Sería una regresión, además de requerir un reindex.
const DIACRITIC_REGEX = new RegExp("[\\u0300-\\u036f]", "g");
export function removeDiacritics(text: string): string {
  return text.normalize("NFD").replace(DIACRITIC_REGEX, "");
}

// Acá vivía `singularizeSpanishQuery`, una heurística de plural → singular que
// se removió por estar rota de dos formas:
//
//   1. Su segunda regla (consonante + "es" → cortar 2 chars) era INALCANZABLE:
//      toda palabra terminada en "es" tiene una "e" —vocal— antes de la "s", así
//      que la primera regla (/[aeiou]s$/) la interceptaba siempre. Los ejemplos
//      que el propio comentario prometía nunca funcionaron:
//      "jabones" → "jabone" (no "jabon"), "papeles" → "papele", "aerosoles" →
//      "aerosole", "pinceles" → "pincele", "delantales" → "delantale".
//   2. Su primera regla mordía palabras que no son plurales:
//      "adidas" → "adida" (una marca mutilada), "crisis" → "crisi",
//      "gratis" → "grati", "ingles" → "ingle", "analisis" → "analisi".
//
// Pasó desapercibido porque el token mutilado es PREFIJO del correcto y
// `prefix: true` rescataba la mayoría de los casos — pero de paso rompía
// `prioritize_exact_match`, corrompía el matching de `variants.sku` y
// contaminaba la clave de analytics.
//
// Los plurales se resuelven con sinónimos server-side por colección, generados
// contra los valores que existen de verdad en el índice, en vez de adivinando
// del lado del cliente.

export function normalizeSearchQuery(query: string): string {
  if (!query || query === "*") return query;
  return removeDiacritics(query);
}
