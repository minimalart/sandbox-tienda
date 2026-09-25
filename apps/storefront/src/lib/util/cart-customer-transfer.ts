/**
 * Criterio ÚNICO para decidir si un carrito hay que re-asociar (transferir) al
 * customer logueado. Vive acá porque lo consumen varios caminos distintos
 * (ensureCartCustomer, el self-heal de getOrSetCart, el transfer automático de
 * app/api/store/auth/route.ts al crear la sesión) y cuando el criterio estaba
 * copiado en cada uno se desincronizó.
 *
 * El pase de invitado a cuenta es SIEMPRE automático y silencioso: nunca se le
 * pide confirmación al usuario. Hubo un `CartMismatchBanner` que ofrecía
 * "Sumarlos a mi cuenta"; se sacó porque mostrar ese cartel era en sí mismo el
 * bug (DESDEELSUR-61 / BUG-16) — el transfer ya corre solo, así que pedirle al
 * usuario que lo confirme no era una red de seguridad, era ruido.
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
 *
 * ── EL OTRO EXTREMO: MISMO CUSTOMER, `has_account: false` ───────────────────
 *
 * `has_account` describe cómo nació el customer, no si HOY es el logueado. Un
 * customer invitado puede loguearse más tarde (alta migrada, magic link, lo
 * que sea) sin que ese flag se ponga en `true`. Si el carrito ya cuelga de ESE
 * mismo id, `transferCartCustomerWorkflow` compara ids y hace un no-op — no
 * hay nada que transferir. Pero el criterio viejo sólo miraba `has_account`,
 * así que devolvía "transferir" para siempre: el self-heal de
 * `getOrSetCart`/`ensureCartCustomer` disparaba un transfer al pedo en CADA
 * request para un usuario que ya estaba en su cuenta. Por eso el criterio
 * ahora recibe el id del customer logueado y lo compara contra
 * `cart.customer_id` ANTES de mirar `has_account`. Sin ese id (llamador que no
 * lo puede resolver) el criterio no afirma nada nuevo y se comporta como antes.
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
 * peor escenario: dar invitado por defecto dispararía un transfer al aire en
 * cada request de todo usuario logueado.
 */
export function isCartOwnedByGuestCustomer(cart: CartCustomerLink): boolean {
  return !!cart.customer_id && cart.customer?.has_account === false;
}

/**
 * `true` si el carrito hay que transferir al customer logueado: o no tiene
 * customer, o el que tiene es un invitado DISTINTO del logueado. Quien llama
 * es responsable de chequear que HAYA sesión (headers de auth / customer en
 * props); esto sólo mira el carrito.
 *
 * `loggedInCustomerId` es opcional a propósito: no todos los llamadores lo
 * pueden resolver barato (ver `getLoggedInCustomerId` en `lib/data/cookies.ts`
 * para el camino server con sólo el JWT). Sin el id no se afirma "mismo
 * customer" y el criterio cae al comportamiento de antes — más falsos
 * positivos (algún transfer de más), nunca falsos negativos.
 */
export function shouldTransferCartToCustomer(
  cart: CartCustomerLink,
  loggedInCustomerId?: string | null,
): boolean {
  if (loggedInCustomerId && cart.customer_id === loggedInCustomerId) {
    // Mismo id: `transferCartCustomerWorkflow` lo resuelve como no-op, así que
    // no hay nada que transferir aunque `has_account` diga `false`.
    return false;
  }
  return !cart.customer_id || isCartOwnedByGuestCustomer(cart);
}
