/**
 * Modo de venta de un Product por tienda (PRD Bundles V2 §5-§12).
 *
 * Módulo PURO: define la semántica y las decisiones, sin tocar el contenedor ni
 * la base. Los tres consumidores —el filtro del catálogo, el guard de
 * add-to-cart y la validación al publicar un bundle— comparten estas funciones
 * para que no haya tres interpretaciones distintas de `bundle_only`.
 */

export const SALES_MODES = ['standalone', 'bundle_only', 'standalone_and_bundle'] as const;
export type SalesMode = (typeof SALES_MODES)[number];

/**
 * Sin fila configurada, un producto se vende suelto Y puede ir en kits: es
 * exactamente lo que hacían todos antes de que existiera esta tabla, así que el
 * default preserva el comportamiento (§5).
 */
export const DEFAULT_SALES_MODE: SalesMode = 'standalone_and_bundle';

export const isSalesMode = (value: unknown): value is SalesMode =>
  typeof value === 'string' && (SALES_MODES as readonly string[]).includes(value);

/** Normaliza lo que venga de la base o del cliente al enum, con default. */
export const toSalesMode = (value: unknown): SalesMode =>
  isSalesMode(value) ? value : DEFAULT_SALES_MODE;

/**
 * ¿Se muestra y se vende suelto en esta tienda?
 *
 * `bundle_only` es el único que responde que no: sigue existiendo en Medusa,
 * resolviendo variantes, precios y órdenes, pero no se ofrece por fuera de un
 * kit (§6, §8).
 */
export const isSellableStandalone = (mode: SalesMode): boolean => mode !== 'bundle_only';

/**
 * ¿Puede formar parte de un bundle de esta tienda?
 *
 * `standalone` dice que ese producto, en esa tienda, se vende solo — meterlo en
 * un kit es una contradicción que conviene avisar al publicar (§12).
 */
export const canBeBundled = (mode: SalesMode): boolean => mode !== 'standalone';

/**
 * Productos que hay que ESCONDER del catálogo de una tienda, a partir de las
 * filas configuradas. Devuelve sólo los `bundle_only`: los demás no necesitan
 * fila y no deben aparecer en un `$nin` gigante.
 */
export const hiddenProductIds = (
  rows: ReadonlyArray<{ product_id: string; sales_mode: string }>,
): string[] => {
  const hidden = new Set<string>();
  for (const row of rows) {
    if (!isSellableStandalone(toSalesMode(row.sales_mode))) hidden.add(row.product_id);
  }
  return Array.from(hidden);
};

/**
 * Mapa producto → modo efectivo, ya con el default aplicado para los que no
 * tienen fila. `productIds` fija el universo: así el llamador siempre obtiene
 * una respuesta por producto y no tiene que recordar el default.
 */
export const resolveSalesModes = (
  productIds: readonly string[],
  rows: ReadonlyArray<{ product_id: string; sales_mode: string }>,
): Map<string, SalesMode> => {
  const configured = new Map<string, SalesMode>();
  for (const row of rows) configured.set(row.product_id, toSalesMode(row.sales_mode));
  return new Map(productIds.map((id) => [id, configured.get(id) ?? DEFAULT_SALES_MODE]));
};

/**
 * Productos de un bundle que NO deberían estar en él para una tienda dada
 * (§12). Se usa al publicar: el bundle se puede publicar igual, pero quien lo
 * hace tiene que enterarse.
 */
export const invalidBundleProductIds = (
  productIds: readonly string[],
  rows: ReadonlyArray<{ product_id: string; sales_mode: string }>,
): string[] => {
  const modes = resolveSalesModes(productIds, rows);
  return productIds.filter((id) => !canBeBundled(modes.get(id) ?? DEFAULT_SALES_MODE));
};
