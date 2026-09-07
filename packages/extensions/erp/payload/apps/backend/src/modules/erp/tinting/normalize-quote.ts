import { roundAmount } from '../sync/plan-price-updates';

/**
 * Interpretación del precio que devuelve `GET /articulos/formulaTintometrico`.
 *
 * SEMÁNTICA MEDIDA contra la cuenta real (DESDE EL SUR SAS, 2026-07-29) con la
 * fórmula `00NN 16/000` (color COSMOS) sobre la base `113` (ALBACRYL LATEX
 * INTERIOR ACRILICO MATE BASE F X 3,6 LTS):
 *
 * - `total` es el TOTAL DE LA LÍNEA, no unitario: cantidad 1/2/3/4 devuelve
 *   66352.822 / 132705.645 / 199058.467 / 265411.289 (lineal exacto).
 * - `total` INCLUYE el precio de la base: `precio1` del artículo 113 es
 *   40585.52, o sea que el entonado agrega 25767.30 (COSMOS son 481,6 impulsos
 *   de 3 colorantes).
 * - `lista` es el MISMO índice que `precioN` del artículo: lista 1/2/3 dan
 *   66352.822 y lista 4 (mayorista) da 46446.975 — exactamente el mismo ratio
 *   0.700000 que `precio4/precio1`. Las listas sin precio devuelven `total: 0.0`
 *   (no un error), igual que `precio0`/`precio5..9` en el catálogo.
 * - `ival` es 0 y NO sirve para deducir el IVA (igual que `ival0..9`, que es 0 en
 *   los 3438 artículos). `poriva` sí trae la alícuota en porcentaje (21.0).
 *
 * - **`total` viene CON IVA**, en la misma base que `precioN`. Medido cotizando la
 *   MISMA fórmula sobre los tres tamaños de la línea (bases 113 / 119 / 122 =
 *   3,6 / 8,7 / 17,4 L → 66352.822 / 131482.155 / 286313.683): el sobreprecio de
 *   entonado por litro sale 7157.584 / 7157.539 / 7157.606, o sea la misma
 *   constante con 0.001% de dispersión. Tratando `total` como neto la constante se
 *   dispersa 3% (9114 / 8538 / 8771), y el costo de colorante por litro de un
 *   color no puede depender del envase. De paso: el sobreprecio es exactamente
 *   lineal en litros, así que la dosificación por litro es constante.
 * - La fórmula aplica a las tres bases F de ALBACRYL pero NO a la 114 (BASE P,
 *   409 "no existe"): las fórmulas son por (color, carta, línea, LETRA).
 */
export type TintingQuoteRaw = {
  /** `total` crudo del ERP: total de la línea para `quantity` envases. */
  total: number;
  /** `poriva`: alícuota en PORCENTAJE (21, 10.5) o null si el ERP no la mandó. */
  tax_rate: number | null;
};

export type NormalizedTintingQuote = {
  /** Precio por envase, en la misma base impositiva que los precios del catálogo. */
  unit_price: number;
  /** Precio de la línea completa (`unit_price × quantity`). */
  line_total: number;
  /**
   * Sobreprecio del entonado sobre el precio de catálogo de la base, por envase.
   * `null` si no se pasó `base_unit_price` (informativo: la UI lo desglosa).
   */
  tint_surcharge: number | null;
  /** Alícuota en porcentaje tal como la devolvió el ERP. */
  tax_rate: number | null;
  quantity: number;
};

export type NormalizeTintingQuoteInput = {
  raw: TintingQuoteRaw;
  /** Envases que se quieren comprar. Entero ≥ 1. */
  quantity: number;
  /**
   * Envases que el ERP COTIZÓ para producir `raw.total`. Default `quantity`.
   *
   * Existe porque los dos números pueden diferir y confundirlos es un error de
   * plata: el quote service le pide a Zeus siempre `cantidad: 1` (para que la
   * clave de caché no dependa de la cantidad) y después quiere el precio de N.
   * Con `quoted_quantity` implícito, `total / quantity` DIVIDÍA el precio de un
   * envase entre N: el total quedaba clavado y agregar 2 al carrito los cobraba
   * al precio de 1.
   */
  quoted_quantity?: number;
  /** Precio de catálogo de la base, por envase. Habilita el desglose. */
  base_unit_price?: number | null;
  /** `total` ya trae IVA. Default true (ver el comentario de arriba). */
  includes_tax?: boolean;
};

/**
 * `total` → precio de línea de Medusa. Devuelve `null` cuando la combinación no
 * es cotizable: `total <= 0` es cómo el ERP responde una lista sin precio, no un
 * error, y cobrar 0 por una pintura entonada sería peor que no ofrecerla.
 */
export function normalizeTintingQuote(
  input: NormalizeTintingQuoteInput
): NormalizedTintingQuote | null {
  const { raw, quantity } = input;
  const quotedQuantity = input.quoted_quantity ?? quantity;
  if (!Number.isInteger(quantity) || quantity < 1) return null;
  if (!Number.isInteger(quotedQuantity) || quotedQuantity < 1) return null;
  if (!Number.isFinite(raw.total) || raw.total <= 0) return null;

  const includesTax = input.includes_tax ?? true;
  const rate =
    typeof raw.tax_rate === 'number' && Number.isFinite(raw.tax_rate) && raw.tax_rate >= 0
      ? raw.tax_rate
      : null;

  // El ERP devolvió neto: se le suma la alícuota para dejarlo en la misma base
  // que los precios que el catalog sync escribe en las variantes (finales).
  const grossTotal = includesTax ? raw.total : raw.total * (1 + (rate ?? 0) / 100);

  // El precio unitario sale de la cantidad COTIZADA, no de la pedida.
  const unitPrice = roundAmount(grossTotal / quotedQuantity);
  const baseUnit = input.base_unit_price;
  const surcharge =
    typeof baseUnit === 'number' && Number.isFinite(baseUnit)
      ? roundAmount(unitPrice - baseUnit)
      : null;

  return {
    unit_price: unitPrice,
    line_total: roundAmount(unitPrice * quantity),
    tint_surcharge: surcharge,
    tax_rate: rate,
    quantity,
  };
}
