import { formulaKeyOf } from './plan-base-products';

/**
 * Lo que la card del listado necesita saber de una base entonable: cuántos
 * colores se logran con ella y una muestra de sus hex.
 *
 * POR QUÉ VIVE EN LA METADATA DEL PRODUCTO. La card no puede pedir la carta por
 * producto —serían N llamadas por página— así que el conteo y seis hex viajan en
 * `product.metadata` → índice de Typesense. Es el "+912 colores" y los círculos
 * que se ven abajo del título.
 *
 * POR QUÉ ES UN MÓDULO Y NO CÓDIGO SUELTO EN LA RUTA. Lo calculaba sólo el PATCH
 * de `bases/sync-products`, así que un alta por POST dejaba los productos creados
 * SIN esa metadata y la card sin indicador. Nada lo decía: el POST respondía
 * `created: 118` y parecía terminado. En desdeelsur quedó así dos días, hasta que
 * la clienta comparó con otra tienda y preguntó por qué en una estaban los
 * círculos y en la otra no. Ahora el POST la escribe al crear —ya tiene las
 * fórmulas en la mano, no cuesta una llamada más— y el PATCH la refresca.
 */

/** Seis alcanzan para la tira de círculos; pedir más es traer hex que no se ven. */
export const MAX_CARD_SWATCHES = 6;

export type CardMetadataBase = {
  article_code: string;
  product_line: string;
  base_letter: string | null;
};

export type CardMetadataFormula = {
  product_line: string;
  base_letter: string | null;
  collection: string;
  color_code: string;
};

export type CardMetadataColor = {
  code: string;
  collection: string;
  hex: string | null;
};

export type BaseCardMetadata = {
  count: number;
  swatches: string[];
};

/**
 * Metadata de card por `article_code`.
 *
 * Sólo entran las bases cuya `(línea, letra)` tiene al menos una fórmula: una
 * base sin carta no tiene nada que contar, y publicar "+0 colores" es peor que
 * no publicar nada.
 *
 * Los hex se toman en el orden en que vienen las fórmulas y sin repetir: la
 * llamada pide los colores ordenados por `rank`, así que la tira termina siendo
 * el arranque de la carta y no seis colores al azar.
 */
export function buildBaseCardMetadata(input: {
  bases: readonly CardMetadataBase[];
  formulas: readonly CardMetadataFormula[];
  colors: readonly CardMetadataColor[];
}): Map<string, BaseCardMetadata> {
  const hexByColor = new Map<string, string | null>();
  for (const color of input.colors) {
    hexByColor.set(`${color.collection}::${color.code}`, color.hex);
  }

  // Un índice por `(línea, letra)` y no un `filter` por base: con 33.292 fórmulas
  // y ~120 bases, filtrar dentro del bucle es el mismo trabajo repetido 120 veces.
  const formulasByKey = new Map<string, CardMetadataFormula[]>();
  for (const formula of input.formulas) {
    const key = formulaKeyOf(formula.product_line, formula.base_letter);
    const bucket = formulasByKey.get(key);
    if (bucket) bucket.push(formula);
    else formulasByKey.set(key, [formula]);
  }

  const out = new Map<string, BaseCardMetadata>();
  for (const base of input.bases) {
    const own = formulasByKey.get(formulaKeyOf(base.product_line, base.base_letter));
    if (!own?.length) continue;

    const swatches: string[] = [];
    for (const formula of own) {
      const hex = hexByColor.get(`${formula.collection}::${formula.color_code}`);
      if (hex && !swatches.includes(hex)) swatches.push(hex);
      if (swatches.length >= MAX_CARD_SWATCHES) break;
    }
    out.set(base.article_code, { count: own.length, swatches });
  }

  return out;
}
