/**
 * Un carrito ya convertido en orden no es un carrito.
 *
 * El caso normal en esta tienda: la orden la crea el WEBHOOK de MercadoPago, del
 * lado del servidor, sin que el navegador participe. Lo único que borra la cookie
 * `_medusa_cart_id` después de pagar es la pantalla de éxito
 * (`checkout/success/success-client.tsx`), y sólo cuando su polling llega a ver
 * el `order_id`. Si esa pantalla no se completa — pestaña cerrada, timeout del
 * polling, deep-link a la confirmación, volver atrás — la cookie sigue apuntando
 * al carrito que YA es una orden.
 *
 * A partir de ahí el storefront vuelve a mostrar ese carrito como el activo, con
 * los ítems que la persona acaba de comprar y cuyo stock esa misma compra
 * consumió: aparecen etiquetados "Sin stock" y el drawer bloquea "Finalizar
 * compra" con "Eliminá los productos sin stock para continuar". Es
 * DESDEELSUR-61 / BUG-08, y era bloqueante: el cliente no podía volver a comprar.
 * El stock que se muestra no está mal — el carrito que se muestra sí.
 *
 * La regla ya existía en `repositories/cart.repository.ts`, pero la OTRA
 * implementación de `retrieveCart` (`data/cart.ts`, la que alimenta el layout,
 * `/cart` y el botón del header) ni pedía el campo. Por eso vive acá: una sola
 * regla, un solo lugar, y los dos caminos la consumen.
 */

/** Campo que hay que pedir en el `fields` del fetch del carrito. */
export const CART_COMPLETED_AT_FIELD = "completed_at";

/**
 * ¿Este carrito ya se convirtió en orden?
 *
 * Se lee de forma laxa a propósito: el tipo `StoreCart` del SDK no declara
 * `completed_at`, así que un chequeo tipado obligaría a castear en cada call
 * site — que es justo cómo la regla terminó implementada en un solo lado.
 */
export function isCompletedCart(cart: unknown): boolean {
  if (!cart || typeof cart !== "object") return false;
  const completedAt = (cart as { completed_at?: string | Date | null })
    .completed_at;
  return Boolean(completedAt);
}
