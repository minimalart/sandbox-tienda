import { isColorOptionTitle } from './color-option';
import { normalizePresentationLabel, supersededPresentationLabels } from './product-title';

/**
 * Etiqueta de presentación en la OPCIÓN de variante (`Formato: 1 lt`).
 *
 * El título ya sale normalizado ("Texturado cartucho negro x1 lt"), pero la card
 * del PLP no lee el título: pinta el valor de la option de producto, y ahí el
 * catálogo tiene un placeholder. Dos formas conviven hoy en la tienda real:
 *
 *  - las ~117 bases tintométricas, creadas por el sync de bases, tienen
 *    `Presentación: 3,6 LTS` — el tamaño CRUDO parseado del título de Zeus, que
 *    encima contradice al título normalizado (`x4 lt`, con el envase ya redondeado
 *    por R25);
 *  - los ~3.300 restantes entraron por el import con `Formato: Único`, que el
 *    storefront ESCONDE a propósito (`PLACEHOLDER_VALUE_RE` en
 *    `lib/util/variant-labels.ts`): mostrar "Único" en todas las cards sería
 *    ruido.
 *
 * El dato para llenarlo ya está en la variante: `metadata.zeus_presentacion`, que
 * deja el catalog sync al normalizar el título. Este módulo decide QUÉ renombrar;
 * `apply-presentation-option.ts` lo ejecuta.
 *
 * La regla clave es la tercera: un valor que NO es placeholder ni la forma cruda
 * de la misma medida se deja intacto. Eso protege una etiqueta que alguien
 * escribió a mano ("Pack x6", "Obra") de ser pisada por el sync, igual que la
 * política de reescritura protege un título editado.
 */

/**
 * Valores de relleno que se pueden sobrescribir sin pensar. Espeja
 * `PLACEHOLDER_VALUE_RE` del storefront a propósito: si acá considerásemos
 * placeholder algo que allá se muestra (o al revés), el resultado sería una card
 * con una etiqueta que nadie quiso poner.
 */
const PLACEHOLDER_RE =
  /^(unico|default|default option|default title|standard|estandar|n\/?a|na|sin especificar|-{1,2}|—+)$/;

const fold = (value: string): string =>
  value
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export const isPlaceholderLabel = (value: string | null | undefined): boolean =>
  PLACEHOLDER_RE.test(fold(value ?? ''));

/**
 * ¿`current` es la MISMA medida que la presentación del título, escrita de otra
 * forma? Es lo que separa "el sync la puede pisar" de "alguien la escribió a
 * mano".
 *
 * El segundo intento es el que salva a las bases entonables: su etiqueta cruda
 * dice `3,6 LTS` y el título ya dice `x4 lt` (R25 redondea el envase), así que sin
 * comparar también contra la forma redondeada la opción de las 117 bases quedaría
 * clasificada como etiqueta manual y no se corregiría nunca.
 *
 * El tercero cubre el caso inverso: la etiqueta que escribió una versión
 * ANTERIOR de R25. Cuando `17,4` pasó de `18 lt` a `20 lt` (DESDEELSUR-23) el
 * título se reescribió solo, pero `18 lt` no matchea ninguna de las dos
 * normalizaciones contra un target de `20 lt`, así que los SKU 745, 748, 767,
 * 770 y 993 quedaron con la card diciendo `x20 lt` y el chip diciendo `18 lt`,
 * sin arreglo posible por más que se re-sincronice.
 */
const isSameMeasure = (current: string, target: string): boolean =>
  normalizePresentationLabel(current) === target ||
  normalizePresentationLabel(current, { tintBase: true }) === target ||
  supersededPresentationLabels(target).includes(normalizePresentationLabel(current) ?? '') ||
  isStaleMeasure(current, target);

/**
 * ¿`current` es una medida con la UNIDAD equivocada contra la que declara el
 * título? Entonces no es una etiqueta que alguien escribió: es una medida vieja.
 *
 * El caso real es el SKU 570 de desdeelsur: la card dice
 * "Duralba frentes látex exterior vinílico blanco x20 lt" y el chip dice
 * `20 kg`, con `zeus_presentacion` en `20 lt`. Como ninguna de las tres
 * comparaciones de arriba matchea, `planPresentationOptions` lo clasifica como
 * etiqueta manual y lo protege para siempre — protege, justamente, la
 * contradicción.
 *
 * Sólo la unidad. Si la CANTIDAD también difiere (`10 lt` contra un título que
 * dice `x20 lt`) sí puede ser una corrección deliberada —un envase que se vende
 * fraccionado— y esa se sigue respetando.
 */
const isStaleMeasure = (current: string, target: string): boolean => {
  const normalized = normalizePresentationLabel(current);
  if (!normalized || normalized === target) return false;
  const [currentQuantity, currentUnit] = normalized.split(' ');
  const [targetQuantity, targetUnit] = target.split(' ');
  return Boolean(currentUnit) && currentQuantity === targetQuantity && currentUnit !== targetUnit;
};

/** Estado mínimo de un producto para decidir el renombre. */
export type PresentationProductState = {
  product_id: string;
  /** Variantes del producto. Con más de una, el renombre no aplica. */
  variants: Array<{
    variant_id: string;
    title: string | null;
    /** Presentación normalizada que dejó el catalog sync (`metadata.zeus_presentacion`). */
    presentation: string | null;
  }>;
  /**
   * Valores de opción del producto, con el título de su opción. Con más de un
   * valor NO de color el producto tiene presentaciones reales y no hay nada que
   * rellenar.
   *
   * El título hace falta porque la opción `Color` que agrega el sync no es una
   * presentación: contarla dejaba afuera a los 1.512 productos que tienen color,
   * que se quedaban con `Formato: 1 L` mientras su título decía `x1 lt`.
   */
  option_values: Array<{ option_value_id: string; value: string | null; option_title?: string | null }>;
};

export type PresentationPlan = {
  /** Renombres del valor de opción, in situ (el id no cambia → el link tampoco). */
  renames: Array<{ option_value_id: string; from: string; to: string; product_id: string }>;
  /** Títulos de variante que quedaron con el placeholder. */
  variant_titles: Array<{ variant_id: string; from: string | null; to: string }>;
  /** Ya estaba bien. */
  unchanged: number;
  /** Por qué se saltó, agrupado. */
  skipped: Record<string, number>;
};

/**
 * Decide los renombres. Función PURA: no toca la base, así que el dry-run del
 * sync puede informar exactamente lo que haría.
 */
export function planPresentationOptions(states: PresentationProductState[]): PresentationPlan {
  const plan: PresentationPlan = { renames: [], variant_titles: [], unchanged: 0, skipped: {} };
  const skip = (reason: string): void => {
    plan.skipped[reason] = (plan.skipped[reason] ?? 0) + 1;
  };

  for (const state of states) {
    // La opción de color no es una presentación: se descuenta antes de contar.
    const sizeValues = state.option_values.filter(
      (option) => !isColorOptionTitle(option.option_title)
    );
    // Más de una variante o más de un valor de tamaño = el producto YA tiene
    // presentaciones reales y agruparlas es otro problema (fuera de alcance, R11).
    if (state.variants.length !== 1 || sizeValues.length !== 1) {
      skip('multiples_presentaciones');
      continue;
    }
    const variant = state.variants[0]!;
    const optionValue = sizeValues[0]!;
    const target = variant.presentation?.trim();
    if (!target) {
      // El artículo no trae presentación en el título (un pincel, una herramienta).
      skip('sin_presentacion');
      continue;
    }

    const current = optionValue.value ?? '';
    if (current === target) {
      plan.unchanged += 1;
    } else if (isPlaceholderLabel(current) || isSameMeasure(current, target)) {
      // Placeholder, o la MISMA medida escrita distinto (`3,6 LTS` → `4 lt`).
      plan.renames.push({
        option_value_id: optionValue.option_value_id,
        from: current,
        to: target,
        product_id: state.product_id,
      });
    } else {
      // Una etiqueta que alguien puso a mano y no es esta medida: no se pisa.
      skip('etiqueta_manual');
      continue;
    }

    // El título de la variante acompaña: dejar `Único` (o `1 L` cuando la opción
    // ya dice `1 lt`) se ve en el carrito y en el PDP. Se toca con el mismo
    // criterio que la opción — placeholder o la MISMA medida escrita distinto — y
    // nunca una etiqueta que alguien escribió a mano.
    const currentTitle = variant.title ?? '';
    const titleIsSameMeasure = isSameMeasure(currentTitle, target);
    if ((isPlaceholderLabel(currentTitle) || titleIsSameMeasure) && currentTitle !== target) {
      plan.variant_titles.push({ variant_id: variant.variant_id, from: variant.title, to: target });
    }
  }

  return plan;
}

/**
 * Renombres agrupados por valor destino. `updateProductOptionValues` acepta un
 * selector, así que N productos que van a "1 L" se resuelven en UNA llamada: son
 * ~50 presentaciones distintas para miles de productos.
 */
export function groupRenamesByValue(
  renames: PresentationPlan['renames']
): Array<{ value: string; option_value_ids: string[] }> {
  const byValue = new Map<string, string[]>();
  for (const rename of renames) {
    const bucket = byValue.get(rename.to) ?? [];
    bucket.push(rename.option_value_id);
    byValue.set(rename.to, bucket);
  }
  return [...byValue]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([value, option_value_ids]) => ({ value, option_value_ids }));
}
