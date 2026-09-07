/**
 * Color como opción de variante, extraído del título.
 *
 * Zeus NO manda color: `codigo_color`, `codigo_acabado`, `codigo_talle` y
 * `codigo_tamanio` están vacíos en los 3.438 artículos de la cuenta (medido
 * 2026-07-31 contra `GET /articulos`). El color existe únicamente dentro del
 * nombre: "XYLASOL LASUR ROBLE CLARO X 1 LT".
 *
 * La especificación (R12) desaconsejaba inferirlo del texto en la v1, pero la
 * condición que dejaba abierta —"moverlo a opción solo si Zeus provee un atributo
 * confiable"— no se puede cumplir porque ese atributo no existe. Así que se
 * extrae del título, y el riesgo se acota igual que con las tildes: con un
 * DICCIONARIO CERRADO. No hay inferencia libre; una palabra que no está en la
 * lista no es un color.
 *
 * El color NO se saca del título (R12: "conservar color/acabado si diferencia el
 * producto"), se DUPLICA en la opción. Es lo que ya hacía el trabajo manual:
 * "Lasur roble claro x1 L" con `Color: Roble claro`.
 *
 * No agrupa variantes: cada presentación sigue siendo su propio producto. La
 * agrupación Color × Formato necesita un código padre que Zeus no da, y la
 * planilla la deja fuera de alcance (R11).
 */

/**
 * Vocabulario de colores. Espeja las claves de `WOOD_TONES` + `FLAT_COLORS` de
 * `apps/storefront/src/lib/util/variant-labels.ts`, que es lo que decide si la
 * card pinta un círculo de color o solo texto.
 *
 * Están duplicadas a propósito: el backend no puede importar del storefront. Un
 * color que esté acá y no allá degrada bien (se muestra como texto), así que la
 * divergencia molesta pero no rompe. Al agregar uno, agregarlo en los dos lados.
 *
 * Las entradas van CON TILDE porque son la etiqueta que se escribe en la opción
 * de variante y se muestra en la card ("Marrón", no "Marron"); el matcheo contra
 * el título es por forma plegada, así que el ERP puede mandarlas sin tilde. El
 * mapa del storefront también compara plegado, así que la tilde no le rompe el
 * círculo de color.
 */
export const DEFAULT_COLOR_VOCABULARY: string[] = [
  // Tonos de madera: el nombre del color es una especie de madera.
  'natural',
  'cristal',
  'incoloro',
  'transparente',
  'pino',
  'pino oregón',
  'roble',
  'roble claro',
  'roble oscuro',
  'nogal',
  'nogal claro',
  'nogal oscuro',
  'caoba',
  'cedro',
  'teca',
  'teka',
  'algarrobo',
  'cerezo',
  'wengue',
  'ébano',
  'ciprés',
  'guindo',
  'petiribí',
  // Colores planos.
  'blanco',
  'blanco mate',
  'hueso',
  'marfil',
  'crema',
  'beige',
  'arena',
  'tiza',
  'negro',
  'gris',
  'gris claro',
  'gris oscuro',
  'grafito',
  'cemento',
  'plata',
  'plateado',
  'aluminio',
  'dorado',
  'cobre',
  'bronce',
  'rojo',
  'bordo',
  'teja',
  'terracota',
  'naranja',
  'ocre',
  'amarillo',
  'verde',
  'verde claro',
  'verde oscuro',
  'verde inglés',
  'oliva',
  'celeste',
  'turquesa',
  'azul',
  'azul marino',
  'violeta',
  'lila',
  'rosa',
  'fucsia',
  'salmón',
  'marrón',
];

/** Títulos de opción que ya son de color; si el producto tiene una, no se toca. */
const COLOR_OPTION_TITLE_RE = /(colou?r|tono)/i;

/**
 * Palabras del vocabulario que en cierto contexto NO son un color, sino parte del
 * nombre de la técnica o de la línea.
 *
 * Medido contra el catálogo real: "PINTURA A LA TIZA 100 NEGRO" es pintura *a la
 * tiza* (chalk paint) de color negro. Sin esta excepción daba `Tiza` en 102
 * artículos, todos mal.
 */
const CONTEXT_EXCLUSIONS: Array<{ color: string; precededBy: string }> = [
  { color: 'tiza', precededBy: 'a la' },
];

const collapse = (input: string): string => input.trim().replace(/\s+/g, ' ');

const fold = (input: string): string =>
  collapse(input)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export const isColorOptionTitle = (title: string | null | undefined): boolean =>
  COLOR_OPTION_TITLE_RE.test(title ?? '');

/**
 * Color del título, o `null`.
 *
 * Busca desde el FINAL hacia el principio, y en cada posición prefiere la frase
 * más larga ("roble claro" gana sobre "roble"). El orden importa y está medido
 * contra el catálogo real: en estos nombres el color califica al producto y va
 * al final, mientras que al principio suele estar la técnica o la línea. Yendo de
 * izquierda a derecha, "PINTURA A LA TIZA 100 NEGRO" daba `Tiza` en lugar de
 * `Negro`, y "PINTURA A LA TIZA 030 COBRE" daba `Tiza` en lugar de `Cobre`.
 *
 * Devuelve la forma canónica del VOCABULARIO con mayúscula inicial ("Roble
 * claro", "Marrón"), que es la que ya usaban los productos cargados a mano. El
 * título matchea plegado, así que el ERP puede mandar el color sin tilde y la
 * etiqueta sale igual bien escrita.
 */
export function extractColorLabel(
  title: string | null | undefined,
  vocabulary: string[] = DEFAULT_COLOR_VOCABULARY
): string | null {
  const folded = fold(title ?? '');
  if (!folded) return null;

  const known = new Map(vocabulary.map((entry) => [fold(entry), collapse(entry)]));
  const maxWords = vocabulary.reduce((max, entry) => Math.max(max, entry.split(' ').length), 1);
  const tokens = folded.split(' ');

  for (let i = tokens.length - 1; i >= 0; i -= 1) {
    for (let size = Math.min(maxWords, tokens.length - i); size >= 1; size -= 1) {
      const phrase = tokens.slice(i, i + size).join(' ');
      const canonical = known.get(phrase);
      if (canonical === undefined) continue;
      const excluded = CONTEXT_EXCLUSIONS.some(
        (rule) =>
          rule.color === phrase &&
          tokens.slice(Math.max(0, i - rule.precededBy.split(' ').length), i).join(' ') ===
            rule.precededBy
      );
      if (excluded) continue;
      return canonical.charAt(0).toUpperCase() + canonical.slice(1);
    }
  }
  return null;
}

/** Estado mínimo de un producto para decidir si se le agrega la opción de color. */
export type ColorProductState = {
  product_id: string;
  /** Títulos de las options que ya tiene el producto. */
  option_titles: string[];
  /**
   * Valores de la option de color que el producto YA tiene, si tiene una. Sirven
   * para corregir la ortografía de una etiqueta escrita antes de que el
   * vocabulario tuviera la tilde ("Marron" → "Marrón").
   */
  color_option_values?: Array<{ option_value_id: string; value: string | null }>;
  variants: Array<{
    variant_id: string;
    /** Color detectado en el título (lo deja el sync en `metadata.zeus_color`). */
    color: string | null;
    /**
     * Valores de opción que la variante tiene HOY, por título (`{Formato: '4 L'}`).
     *
     * Hacen falta para el link: `assignOptionsToVariants` del módulo de producto
     * exige que el payload traiga un valor para CADA option del producto, y tira
     * "Product has N option values but there were M provided" si no. O sea que al
     * agregar `Color` hay que re-mandar también los que ya estaban.
     */
    options: Record<string, string>;
  }>;
};

export type ColorPlan = {
  /** Productos a los que hay que crear la option `Color` y enlazar la variante. */
  creates: Array<{
    product_id: string;
    variant_id: string;
    color: string;
    /** Options actuales de la variante, para re-mandarlas junto con `Color`. */
    options: Record<string, string>;
  }>;
  /**
   * Valores de color que son EL MISMO color escrito distinto y se corrigen in
   * situ (`Marron` → `Marrón`). El id no cambia, así que el link con la variante
   * tampoco — es el mismo mecanismo que usa el renombre de presentación.
   */
  renames: Array<{ option_value_id: string; from: string; to: string; product_id: string }>;
  skipped: Record<string, number>;
};

/**
 * Decide a qué productos agregarles la opción. PURA, así que el dry-run informa
 * exactamente lo que haría.
 */
export function planColorOptions(states: ColorProductState[]): ColorPlan {
  const plan: ColorPlan = { creates: [], renames: [], skipped: {} };
  const skip = (reason: string): void => {
    plan.skipped[reason] = (plan.skipped[reason] ?? 0) + 1;
  };

  for (const state of states) {
    // Ya tiene una option de color (cargada a mano o por una corrida anterior):
    // no se crea nada. Lo único que se corrige es la ORTOGRAFÍA de la etiqueta
    // cuando es el mismo color escrito distinto — "Marron" contra el "Marrón" del
    // vocabulario. Una etiqueta que dice OTRO color no se pisa: puede haberla
    // puesto alguien a mano, igual que con las presentaciones.
    if (state.option_titles.some(isColorOptionTitle)) {
      const detected = state.variants.map((variant) => variant.color?.trim()).filter(Boolean) as string[];
      let renamed = false;
      for (const current of state.color_option_values ?? []) {
        const value = current.value ?? '';
        const match = detected.find((color) => fold(color) === fold(value));
        if (!match || match === value) continue;
        plan.renames.push({
          option_value_id: current.option_value_id,
          from: value,
          to: match,
          product_id: state.product_id,
        });
        renamed = true;
      }
      if (!renamed) skip('ya_tiene_color');
      continue;
    }
    // Con más de una variante el color puede ser POR variante, y eso es agrupar
    // (fuera de alcance, R11).
    if (state.variants.length !== 1) {
      skip('multiples_variantes');
      continue;
    }
    const variant = state.variants[0]!;
    const color = variant.color?.trim();
    if (!color) {
      skip('sin_color_en_el_titulo');
      continue;
    }
    plan.creates.push({
      product_id: state.product_id,
      variant_id: variant.variant_id,
      color,
      options: variant.options,
    });
  }

  return plan;
}
