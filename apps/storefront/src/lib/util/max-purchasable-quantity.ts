/**
 * Los tres campos que hacen falta para saber el techo. Tipado estructural a
 * propósito: lo llaman con variantes del Product API, del carrito y del selector
 * del PDP, y no queremos acoplar el helper a una forma exacta de `HttpTypes`.
 */
type StockAwareVariant = {
  manage_inventory?: boolean | null;
  allow_backorder?: boolean | null;
  inventory_quantity?: number | null;
};

type StockAwareLineItem = {
  variant?: StockAwareVariant | null;
};

/**
 * Techo de unidades comprables de una variante.
 *
 * `null` = sin techo conocido: la variante no gestiona inventario, admite
 * backorder, o el payload no trajo `inventory_quantity` (p. ej. un carrito que
 * no pasó por el enriquecimiento). En esos casos NO clampeamos: preferimos que
 * el server decida antes que bloquear una compra válida por falta de datos.
 *
 * El carrito que devuelve `/api/store/cart` YA viene enriquecido con el stock
 * real por variante (ver `enrichCartWithInventory` en cart.repository), así que
 * para las líneas del carrito este número es la verdad del server — no una
 * estimación del índice de Typesense, cuyo `stock_available` es la SUMA de
 * todas las variantes del producto y por eso no sirve como techo por variante.
 */
export function getVariantMaxQuantity(
  variant: StockAwareVariant | null | undefined,
): number | null {
  if (!variant) return null;
  if (variant.manage_inventory === false) return null;
  if (variant.allow_backorder) return null;
  if (typeof variant.inventory_quantity !== "number") return null;
  return Math.max(0, variant.inventory_quantity);
}

/** Igual que `getVariantMaxQuantity`, leyendo la variante de una línea de carrito. */
export function getLineItemMaxQuantity(
  item: StockAwareLineItem | null | undefined,
): number | null {
  return getVariantMaxQuantity(item?.variant);
}

/**
 * Clampea una cantidad objetivo al rango `[1, techo]`.
 *
 * Piso 1 porque los steppers +/- nunca eliminan la línea (eso es el tacho).
 *
 * Un techo `<= 0` NO fuerza la cantidad a 0: significa que el enriquecimiento no
 * pudo resolver el stock (devuelve 0 cuando no hay location levels ni
 * `inventory_quantity`), y bloquear el stepper con ese dato dejaría al cliente
 * sin poder tocar una línea que quizá sí tiene stock. Ahí dejamos pasar y que
 * el server rechace.
 */
export function clampToStock(quantity: number, max: number | null): number {
  const atLeastOne = Math.max(1, quantity);
  if (!hasKnownCeiling(max)) return atLeastOne;
  return Math.min(atLeastOne, max);
}

/**
 * ¿Se puede sumar una unidad más?
 *
 * Vive acá —y no inline en cada componente— para que la UI (que apaga el "+") y
 * el store (que clampea) decidan con la MISMA regla. Si se separan, volvemos al
 * bug original: el botón deja clickear algo que el store después recorta, o al
 * revés.
 */
export function canIncrementQuantity(
  current: number,
  max: number | null,
): boolean {
  if (!hasKnownCeiling(max)) return true;
  return current < max;
}

/** Ver la nota de `clampToStock` sobre por qué un techo `<= 0` es "desconocido". */
function hasKnownCeiling(max: number | null): max is number {
  return max !== null && max > 0;
}
