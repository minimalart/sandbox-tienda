/**
 * Detección de bases entonables a partir de la descripción del artículo.
 *
 * Zeus TIENE campos para esto (`agrupacion_tintometrico`, `codigo_color`,
 * `acabado`, `tamanio`) pero están vacíos en los 3438 artículos de la cuenta
 * real, así que hoy la única fuente es el texto. Cuando el cliente los llene, el
 * detector los usa primero y esto queda como fallback.
 *
 * Formas reales medidas en el catálogo (158 artículos matchean):
 *   "ALBACRYL LATEX INTERIOR ACRILICO MATE BASE F X 3,6 LTS"      → letra F
 *   "ALBALATEX DESIGN SATINADO INTERIOR BASE P X 0,9 LTS"         → letra P
 *   "ALBACRYL LATEX INTERIOR ACRILICO MATE BASE X P 17,4 LTS"     → letra P (la X va ANTES)
 *   "ALBA EFECTOS ESPECIALES DESIGN MARMOL BASE X 3,24 LTS"       → SIN letra (base única)
 *   "AIKE - LATEX I+E COLOR F (B) X 18 LTS"                       → letra F (ancla COLOR)
 * Distribución de letras: P 58, F 54, T 35, MF 4.
 *
 * AIKE no escribe la palabra BASE: carga sus bases como `COLOR <letra> (<grupo>)`
 * (ver `COLOR_BASE_ANCHOR`). Son 18 artículos de dos líneas enteras —Látex I+E y
 * Esmalte 2 en 1, en 0,9 / 3,6 / 9 / 18 lt— que sin esta ancla quedaban fuera del
 * tintométrico: no se pueden vender entonadas y el título conserva el `color f b`
 * que R26 debería sacarle.
 *
 * Falsos positivos que se descartan a propósito (todos reales):
 *   "REVEAR - CLASSIC STONE CLEAR X 25 KGS (SIN BASE Y A PEDIDO)" → la "Y" es una
 *      conjunción, no una letra de base. Se cae porque no hay tamaño DESPUÉS.
 *   "EQ ARTE - BASE ACRILICA 100 NEGRO X 200 CC"                  → "ACRILICA" no
 *      es una letra de base (la clase es de 1-2 caracteres seguidos de espacio).
 *   "ALBA STANDARD FONDO P/MADERA BLANCO MATE X 0,5 LTS"          → no dice BASE.
 */

/**
 * Unidades de envase que escribe el ERP, de la forma más larga a la más corta:
 * dentro de una alternativa gana la primera que matchea, así que `L` va última o
 * se comería la `L` de `LITROS` y el `\b` de después haría fallar el match entero.
 *
 * Las formas completas (`LITROS`, `GRAMOS`) no son teóricas: Zeus las escribe
 * ("SATINOL BALANCE ESMALTE SATINADO BASE T X0.9 LITROS"), y sin ellas esas bases
 * no se detectaban. Las abreviadas de dos letras además son la forma CANÓNICA de
 * la tienda (`lt`, `kg`, `gr`), así que este detector también reconoce un título
 * ya normalizado — de eso depende la idempotencia de `normalizeProductTitle`.
 */
const SIZE_UNIT = 'LITROS?|LTS?|MILILITROS?|ML|CC|KILOS?|KGRS?|KGS?|GRAMOS?|GRS?|L';

/** Tamaño del envase: "X 3,6 LTS", "0,9 L", "X 200 CC", "18 LTS.", "5 KGS". */
const SIZE = new RegExp(`\\bX?\\s*(\\d{1,3}(?:[.,]\\d{1,2})?)\\s*(${SIZE_UNIT})\\b`, 'i');
/**
 * Igual pero ANCLADO. Se exige sólo cuando NO hay letra de base: sin letra, el
 * único caso legítimo es "BASE X 3,24 LTS" (base única), y el ancla descarta
 * "BASE ACRILICA 100 NEGRO X 200 CC" (pintura de color, no base entonable).
 * Con letra sí se permite un calificador en medio, porque el catálogo real usa
 * "BASE P (A) 0.9LTS." (multicapa) y "BASE F FINO X 5 KGS" (granulometría).
 */
const SIZE_ANCHORED = new RegExp(
  `^\\s*X?\\s*(\\d{1,3}(?:[.,]\\d{1,2})?)\\s*(${SIZE_UNIT})\\b`,
  'i'
);
/**
 * Letra de base al arrancar el resto del texto. La "X" nunca es una letra de
 * base: es el "por" del tamaño ("BASE X 3,24 LTS" es una base ÚNICA, y
 * "BASE X P 17,4" tiene la X antes de la letra).
 */
const LEADING_LETTER = /^([A-WYZ]|[A-Z]{2})(?=\s)/;
/**
 * Ancla alternativa a `BASE`: AIKE escribe `COLOR <letra> (<grupo>)`.
 *
 * El paréntesis NO es decorativo, es lo que hace el patrón seguro: sin él,
 * "VENIER - LATEX COLOR PREMIUM X 1,25 KGS" entraría como base letra "PR" y una
 * pintura de color pasaría a ser entonable — que es el peor falso positivo
 * posible, porque registrar un artículo como base le saca la venta directa.
 *
 * Medido sobre los 2606 títulos crudos de la cuenta real: 19 dicen COLOR, 18
 * matchean (todos AIKE, letras F/P/T y grupos A/B/C) y el único que queda afuera
 * es justamente el VENIER. Los 16 títulos que tienen un `(X)` cualquiera sin
 * COLOR ni BASE —mamelucos `(XL)`, cutters `(C18)`, molduras `(2ML)`— no pueden
 * entrar: el `COLOR` previo es obligatorio.
 */
const COLOR_BASE_ANCHOR = /\bCOLOR\s+([A-Z]{1,2})\s*\(\s*[A-Z0-9]{1,3}\s*\)/;
/**
 * Palabras del castellano que NO son letras de base. Sin esto, "Chorizo a BASE
 * DE planta … 240 grs" y "Bebida a BASE DE almendras … 1 lt" entran como base
 * letra "DE" — los dos son casos reales del catálogo de Mercatto, que además de
 * pinturería tiene almacén.
 *
 * Se exporta porque la normalización de títulos (R11, `sync/product-title.ts`)
 * tiene que decidir lo MISMO: si acá "DE" no es una letra de base, allá tampoco
 * puede salir "Base DE". Una sola lista, medida contra el catálogo real.
 */
export const NOT_A_BASE_LETTER = new Set([
  'A', 'AL', 'DE', 'EL', 'EN', 'ES', 'LA', 'LO', 'MI', 'NO', 'O', 'SE', 'SI', 'SU', 'TU', 'UN', 'Y',
]);
/**
 * Tokens que pueden ir entre la letra y el tamaño ("BASE F FINO X 5 KGS",
 * "BASE P (A) 0.9LTS."). Más que esto ya no es un calificador: es otra frase, y
 * ahí el match es casualidad ("base de planta NotChorixo 240 grs" tiene 3).
 */
const MAX_QUALIFIER_TOKENS = 2;

export type ParsedTintingBase = {
  /**
   * Letra de base en mayúsculas, o `null` si la línea tiene una base única
   * ("...BASE X 3,24 LTS"). No confundir con "no se pudo parsear": eso es que la
   * función devuelva `null`.
   */
  base_letter: string | null;
  /** Línea de producto: la descripción hasta el token BASE, colapsada. */
  product_line: string;
  /** Tamaño tal como lo escribe el ERP ("3,6 LTS"). */
  size_label: string;
  /** Tamaño en litros, o `null` si la unidad es de masa (KG/GR). */
  size_liters: number | null;
  /** `high` = línea + tamaño + (letra o base única evidente). `low` = revisar a mano. */
  confidence: 'high' | 'low';
};

const LITERS = new Set(['L', 'LT', 'LTS', 'LITRO', 'LITROS']);
const MILLILITERS = new Set(['CC', 'ML', 'MILILITRO', 'MILILITROS']);

function toLiters(value: number, unit: string): number | null {
  const u = unit.toUpperCase();
  if (LITERS.has(u)) return value;
  if (MILLILITERS.has(u)) return value / 1000;
  // KG/GR es masa: sin densidad no se convierte, y para el tintométrico el dato
  // que importa es el envase, no el volumen.
  return null;
}

/**
 * `null` cuando la descripción no parece una base entonable. No decide sola: lo
 * que devuelve se guarda con `confirmed: false` para que alguien lo valide — un
 * falso positivo publicaría un pincel como entonable.
 *
 * Regla dura: **sin tamaño no hay base**. La API cotiza por `cantidad` de
 * envases, así que un artículo del que no sabemos el envase no se puede vender
 * entonado; y de paso es lo que descarta los "SIN BASE Y A PEDIDO".
 */
export function parseTintingBase(description: string | null | undefined): ParsedTintingBase | null {
  if (typeof description !== 'string') return null;
  const text = description.replace(/\s+/g, ' ').trim();
  if (!text) return null;

  const upper = text.toUpperCase();
  // `BASE` manda. El ancla `COLOR <letra> (<grupo>)` es el fallback para AIKE, y
  // sólo se prueba si no hay BASE: un título que dice las dos cosas es una base
  // normal que además menciona un color, y ahí la letra buena es la de BASE.
  const baseToken = /\bBASE\b/.exec(upper);
  const colorToken = baseToken ? null : COLOR_BASE_ANCHOR.exec(upper);
  const anchor = baseToken ?? colorToken;
  if (!anchor) return null;

  // Resto del texto después del ancla, salteando el "X" separador si está.
  let rest = upper.slice(anchor.index + anchor[0].length).replace(/^\s+/, '');
  rest = rest.replace(/^X\s+/, '');

  // Con el ancla COLOR la letra viene DENTRO del match y no hay que buscarla al
  // arranque del resto: ahí ya empieza el tamaño.
  const letterMatch = colorToken ? null : LEADING_LETTER.exec(rest);
  const candidate = (colorToken ? colorToken[1] : letterMatch?.[1]) ?? null;
  // "BASE DE ALMENDRAS" no es una base entonable: es una preposición.
  const letter = candidate && !NOT_A_BASE_LETTER.has(candidate) ? candidate : null;

  // Sólo la letra que encontró `LEADING_LETTER` corre el cursor: es la única que
  // se leyó DEL resto. La del ancla COLOR ya venía consumida por el match.
  const afterLetter = letter && letterMatch ? rest.slice(letterMatch[0].length) : rest;
  // Sin letra el tamaño va ANCLADO (el único caso legítimo es "BASE X 3,24 LTS").
  // Con el ancla COLOR la letra siempre está, así que nunca cae en esa rama.
  const sizeMatch = letter ? SIZE.exec(afterLetter) : SIZE_ANCHORED.exec(rest);

  const amount = sizeMatch?.[1];
  const unit = sizeMatch?.[2];
  if (!amount || !unit) return null;

  // Con letra se permite un calificador en medio, pero acotado: si entre la letra
  // y el tamaño hay una frase, el match es casualidad.
  if (letter) {
    const between = afterLetter.slice(0, sizeMatch!.index).trim();
    const tokens = between ? between.split(/\s+/).filter((t) => t !== 'X') : [];
    if (tokens.length > MAX_QUALIFIER_TOKENS) return null;
  }

  const line = text.slice(0, anchor.index).replace(/[\s\-–]+$/, '').trim();

  return {
    base_letter: letter,
    product_line: line,
    size_label: `${amount} ${unit.toUpperCase()}`,
    size_liters: toLiters(Number(amount.replace(',', '.')), unit),
    confidence: line ? 'high' : 'low',
  };
}
