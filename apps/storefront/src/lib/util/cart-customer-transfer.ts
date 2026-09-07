/**
 * Criterio ÚNICO para decidir si un carrito hay que re-asociar (transferir) al
 * customer logueado. Vive acá porque lo consumen tres caminos distintos
 * (ensureCartCustomer, el self-heal de getOrSetCart y el CartMismatchBanner) y
 * cuando el criterio estaba copiado en los tres se desincronizó.
 *
 * El punto fino: `cart.customer_id` con valor NO significa "el carrito ya es de
 * la cuenta". Medusa v2 crea un customer INVITADO (`has_account: false`) y lo
 * pincha en el carrito en cuanto se guarda un email sobre un carrito anónimo
 * (`findOrCreateCustomerStep`, que corre en el update de setAddresses). O sea:
 * el que agrega al carrito sin loguearse, pasa el paso de direcciones y DESPUÉS
 * se loguea, termina con un carrito colgado de un invitado. Con el guard viejo
 * (`!cart.customer_id`) la transferencia no volvía a dispararse nunca y la orden
 * quedaba a nombre del invitado, así que no aparecía en /account/orders — en
 * silencio, sin ningún error.
 *
 * Transferir un carrito que ya cuelga de un invitado está PERMITIDO por el core:
 * `transferCartCustomerWorkflow` (v2.18.0) tiene el hook de validación vacío y
 * lo único que hace es saltear la operación si es el mismo customer. El guard
 * del storefront era más estricto que Medusa sin motivo.
 */

/**
 * Campo que hay que pedir explícito en el fetch del carrito para poder
 * distinguir cuenta de invitado: `has_account` no está en los fields default de
 * `/store/carts/:id` (los defaults sólo traen `customer.id` y `customer.email`)
 * ni existe en los tipos HTTP de Medusa. Si no se pide, no viene, y sin el flag
 * este criterio no puede decidir.
 */
export const CART_CUSTOMER_ACCOUNT_FIELD = "customer.has_account";

/**
 * Forma mínima que necesita el criterio. `customer.has_account` va a mano
 * porque `StoreCustomer` no lo declara (la columna existe en el módulo customer
 * de Medusa, el tipo HTTP no la expone).
 */
export type CartCustomerLink = {
  customer_id?: string | null;
  customer?: { has_account?: boolean | null } | null;
};

/**
 * `true` sólo cuando SABEMOS que el customer del carrito es un invitado.
 *
 * `has_account` es `model.boolean().default(false)` en el módulo customer: nunca
 * es null en la base. Entonces `undefined` acá significa "no pedimos el campo",
 * no "es invitado", y en ese caso NO afirmamos nada. Esa distinción evita el
 * peor escenario: dar invitado por defecto haría que el banner de mismatch se
 * muestre a todo usuario logueado y que cada request dispare un transfer al
 * aire.
 */
export function isCartOwnedByGuestCustomer(cart: CartCustomerLink): boolean {
  return !!cart.customer_id && cart.customer?.has_account === false;
}

/**
 * `true` si el carrito hay que transferir al customer logueado: o no tiene
 * customer, o el que tiene es un invitado. Quien llama es responsable de
 * chequear que HAYA sesión (headers de auth / customer en props); esto sólo
 * mira el carrito.
 */
export function shouldTransferCartToCustomer(cart: CartCustomerLink): boolean {
  return !cart.customer_id || isCartOwnedByGuestCustomer(cart);
}
