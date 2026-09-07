// Similitud de tokens tolerante a errores de tipeo.
// Sin importaciones externas — puro JS.
//
// POR QUÉ EXISTE: el buscador de la carta de colores filtra con `includes()`, que
// es correcto para quien tipea bien pero no perdona nada. El cliente llega con el
// abanico en la mano y transcribe códigos como "51YY 61/792": una tecla de más y
// no encuentra el color que tiene delante de los ojos.
//
// Se usa como FALLBACK, nunca en lugar del match exacto: primero se filtra por
// coincidencia literal y sólo si eso no devuelve nada se afloja. Así quien escribe
// bien nunca ve resultados de más.
//
// NO va en el buscador de productos: ahí el motor (Typesense) ya tolera typos del
// lado del servidor, y sugerir correcciones en la interfaz resultaba en ruido —
// "lijas" devolvía 103 lijas y aun así ofrecía "¿Quisiste decir Lija autof...?".

const DIACRITICS = /[\u0300-\u036f]/g;

/**
 * Forma comparable de un texto: minúsculas y sin acentos.
 *
 * Nadie tipea acentos buscando, así que "rocio" tiene que encontrar "Rocío". Sin
 * esto el acento se paga del presupuesto de typos —o directamente no matchea en el
 * camino literal—, y una palabra con dos tildes lo agota sola.
 */
export function foldForSearch(text: string): string {
  return text.normalize("NFD").replace(DIACRITICS, "").toLowerCase();
}

/**
 * Distancia de Damerau-Levenshtein restringida (optimal string alignment):
 * inserciones, borrados, sustituciones y TRANSPOSICIONES de caracteres adyacentes.
 *
 * La transposición importa: "remrea" → "remera" es un solo error de tipeo real
 * (dos teclas invertidas), y Levenshtein a secas lo contaría como dos.
 *
 * Corta apenas supera `max` para no pagar la matriz completa cuando la respuesta
 * ya es "no".
 */
export function boundedDamerauLevenshtein(
  a: string,
  b: string,
  max: number,
): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;

  let prevPrev: number[] = [];
  let prev: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);
  let curr: number[] = [];

  for (let i = 1; i <= a.length; i++) {
    curr = new Array<number>(b.length + 1);
    curr[0] = i;
    let rowMin = curr[0];

    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(
        curr[j - 1] + 1, // inserción
        prev[j] + 1, // borrado
        prev[j - 1] + cost, // sustitución
      );
      if (
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        value = Math.min(value, prevPrev[j - 2] + 1); // transposición
      }
      curr[j] = value;
      if (value < rowMin) rowMin = value;
    }

    // Ninguna celda de la fila baja de `max`: no hay forma de mejorarlo después.
    if (rowMin > max) return max + 1;
    prevPrev = prev;
    prev = curr;
  }

  return prev[b.length];
}

/**
 * Typos permitidos según el largo del token.
 *
 * Espeja A PROPÓSITO los defaults `min_len_1typo: 4` y `min_len_2typo: 7` de
 * Typesense: así la interfaz nunca ofrece una corrección que el motor no habría
 * considerado un typo. Si estos números se desalinean, la UI sugiere cosas que la
 * búsqueda no encuentra (o al revés), que es peor que no sugerir nada.
 */
export function allowedTypos(tokenLength: number): number {
  if (tokenLength >= 7) return 2;
  if (tokenLength >= 4) return 1;
  return 0; // tokens de 1-3 chars: cualquier edición cambia demasiado el término
}

const WHITESPACE = /\s+/;

/**
 * ¿Alguna palabra de `candidate` es `token`, exacta o con un typo tolerable?
 *
 * El match LITERAL se chequea siempre, incluso sin presupuesto de typos. Sin eso,
 * un token corto hundía la consulta entera: "de" y "la" tienen 2 caracteres, o sea
 * cero typos permitidos, así que "rocio de la mañna" no matcheaba NADA por más que
 * las cuatro palabras estuvieran ahí. El presupuesto de typos limita cuánto se
 * afloja, no si se acepta lo que ya coincide.
 */
export function tokenMatchesWithTypos(token: string, candidate: string): boolean {
  const max = allowedTypos(token.length);

  for (const word of candidate.split(WHITESPACE)) {
    if (!word) continue;
    // Literal: vale para cualquier largo, y de paso resuelve el prefijo
    // ("manz" contra "manzana").
    if (word.startsWith(token)) return true;
    if (max === 0) continue;
    if (boundedDamerauLevenshtein(token, word, max) <= max) return true;
    // Prefijo con typo: "manzna" contra "manzanas" se compara contra "manzana".
    if (word.length > token.length) {
      const slice = word.slice(0, token.length + max);
      if (boundedDamerauLevenshtein(token, slice, max) <= max) return true;
    }
  }
  return false;
}

/**
 * ¿`candidate` explica TODOS los tokens de `query`, tolerando typos?
 *
 * Exige todos los tokens a propósito: si alguien escribe dos palabras y sólo una
 * matchea, el resultado no es lo que buscaba.
 */
export function matchesWithTypos(query: string, candidate: string): boolean {
  const tokens = query.split(WHITESPACE).filter(Boolean);
  if (tokens.length === 0) return false;
  return tokens.every((token) => tokenMatchesWithTypos(token, candidate));
}
