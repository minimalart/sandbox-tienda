/**
 * Line items del carrito que pertenecen a UNA instancia de kit.
 *
 * Se resuelve en el servidor a partir de `(cart_id, bundle_instance_id)` y no
 * de una lista de ids que mande el cliente: así la ruta de borrado sólo puede
 * tocar líneas de ese carrito y de ese kit, nunca una línea ajena.
 */
export interface CartLineItemLike {
  id: string;
  metadata?: Record<string, unknown> | null;
}

export function selectBundleInstanceLineItemIds(
  items: CartLineItemLike[] | null | undefined,
  bundleInstanceId: string,
): string[] {
  if (!bundleInstanceId) return [];
  return (items ?? [])
    .filter((item) => item.metadata?.bundle_instance_id === bundleInstanceId)
    .map((item) => item.id);
}
