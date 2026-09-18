import type { HttpTypes } from "@medusajs/types";
import { groupCartItemsByBundle } from "./group-cart-items";

/**
 * Capa de presentación del carrito (PRD V2 §13, §50).
 *
 * Medusa sigue viendo line items sueltos; el comprador tiene que ver una unidad
 * por kit. Este helper es el ÚNICO lugar donde se traduce lo primero en lo
 * segundo: minicarrito, carrito, checkout y (más adelante) confirmación de orden
 * consumen `CartPresentationItem[]` en vez de recalcular títulos, totales y
 * conteos cada uno a su manera — que es como terminan mostrando números
 * distintos para el mismo kit.
 *
 * Se apoya en `groupCartItemsByBundle`, que sigue siendo el que decide qué line
 * items pertenecen a cada instancia.
 */

export interface BundleSelection {
  /** Line item del que sale la selección; sirve de key en listas. */
  lineId: string;
  /** Producto pedido (el título del line item). */
  product: string;
  /** Opción elegida (el título de la variante). */
  option: string;
}

export interface BundlePresentation {
  kind: "bundle";
  bundleId: string;
  /** Handle para el deep link al wizard. Null en instancias viejas. */
  bundleHandle: string | null;
  bundleInstanceId: string;
  title: string;
  items: HttpTypes.StoreCartLineItem[];
  /** Productos distintos dentro del kit. */
  itemCount: number;
  /** Unidades totales (suma de cantidades). */
  unitCount: number;
  /**
   * Total confirmado del kit: la suma de los line items. NO se vuelve a pedir
   * el pricing del bundle — el carrito ya es la fuente del precio (PRD §52).
   */
  subtotal: number;
  /**
   * Sólo las decisiones que tomó el comprador. Los ítems auto-resueltos (los
   * que tenían una sola opción) no aportan nada al resumen compacto (PRD §18).
   */
  selections: BundleSelection[];
}

export type CartPresentationItem =
  | { kind: "single"; item: HttpTypes.StoreCartLineItem }
  | BundlePresentation;

const str = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

/** Total de una línea: `total` ya trae descuentos; el producto precio×cantidad es el fallback. */
const lineTotal = (item: HttpTypes.StoreCartLineItem): number => {
  const total = (item as { total?: number | null }).total;
  if (typeof total === "number") return total;
  return (item.unit_price ?? 0) * (item.quantity ?? 0);
};

/**
 * Las instancias creadas antes de que el workflow estampara
 * `bundle_auto_resolved` no distinguen elegido de automático. En ese caso
 * mostramos todas las variantes en vez de ninguna: es la degradación honesta
 * (PRD §65 pide compatibilidad con la metadata existente).
 */
const pickSelections = (items: HttpTypes.StoreCartLineItem[]): BundleSelection[] => {
  const knowsAutoResolved = items.some(
    (item) => (item.metadata as Record<string, unknown> | null)?.bundle_auto_resolved !== undefined,
  );

  return items
    .filter((item) => {
      if (!knowsAutoResolved) return true;
      return (item.metadata as Record<string, unknown> | null)?.bundle_auto_resolved !== true;
    })
    .map((item) => {
      const product = str(item.product_title) ?? str(item.title) ?? "Producto";
      const option = str(item.variant_title) ?? str(item.title);
      return option && option !== product ? { lineId: item.id, product, option } : null;
    })
    .filter((selection): selection is BundleSelection => selection !== null);
};

export const buildCartPresentation = (
  cart: HttpTypes.StoreCart | null | undefined,
): CartPresentationItem[] => buildCartPresentationFromItems(cart?.items);

/** Variante por ítems sueltos, para las superficies que no tienen el cart completo. */
export const buildCartPresentationFromItems = (
  items: readonly HttpTypes.StoreCartLineItem[] | null | undefined,
): CartPresentationItem[] =>
  groupCartItemsByBundle(items).map((row) => {
    if (row.kind === "single") return row;
    const { group } = row;
    return {
      kind: "bundle",
      bundleId: group.bundle_id,
      bundleHandle: group.bundle_handle,
      bundleInstanceId: group.bundle_instance_id,
      title: group.bundle_title ?? "Kit",
      items: group.items,
      itemCount: group.items.length,
      unitCount: group.items.reduce((acc, item) => acc + (item.quantity ?? 0), 0),
      subtotal: group.items.reduce((acc, item) => acc + lineTotal(item), 0),
      selections: pickSelections(group.items),
    };
  });

/**
 * Cuántas filas ve el comprador. El badge del header sigue contando unidades
 * de Medusa; esto es para los textos del tipo "N productos en tu carrito".
 */
export const countPresentationRows = (rows: CartPresentationItem[]): number => rows.length;
