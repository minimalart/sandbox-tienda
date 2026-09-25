"use server";

import { removeCartBundleInstance } from "@lib/repositories/cart.repository";

/**
 * Saca del carrito todas las líneas que comparten un `bundle_instance_id`
 * con UNA llamada al backend (`POST /store/bundles/remove`), que las borra
 * juntas con `deleteLineItemsWorkflow`: un lock del carrito y un recálculo de
 * totales, en vez de uno por producto del kit.
 *
 * El repositorio ya invalida el tag `carts` cuando el borrado sale bien.
 * Si falla, el kit sigue entero en el carrito: mejor eso que un estado a
 * medias que el comprador tenga que limpiar a mano.
 */
export async function removeBundleInstance(bundleInstanceId: string): Promise<boolean> {
  const result = await removeCartBundleInstance(bundleInstanceId);
  return result.success;
}
