import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CART_CUSTOMER_ACCOUNT_FIELD,
  isCartOwnedByGuestCustomer,
  shouldTransferCartToCustomer,
} from "./cart-customer-transfer";

/**
 * Regresión de un bug vivo en producción: /account/orders salía VACÍO para
 * usuarios logueados. En la base de desdeelsur, de 4 órdenes 0 estaban atadas a
 * una cuenta registrada — todas colgaban de un customer invitado, y
 * `GET /store/orders` filtra por el customer_id autenticado.
 *
 * El mecanismo: sobre un carrito anónimo, el update de setAddresses guarda el
 * email y Medusa (`findOrCreateCustomerStep`) crea un customer `has_account:
 * false` y lo pincha en `cart.customer_id`. Desde ese momento el guard viejo
 * (`!cart.customer_id`) daba false y NINGUNO de los tres caminos que re-asocian
 * el carrito volvía a dispararse: agregar al carrito sin loguearse → pasar
 * direcciones → loguearse dejaba la orden a nombre del invitado, en silencio.
 *
 * Lo que se fija acá es el criterio: "atado a una CUENTA" ≠ "tiene customer_id".
 */

const anonymousCart = { customer_id: null };
const guestOwnedCart = {
  customer_id: "cus_guest",
  customer: { id: "cus_guest", has_account: false },
};
const accountOwnedCart = {
  customer_id: "cus_registrado",
  customer: { id: "cus_registrado", has_account: true },
};

test("un carrito sin customer se transfiere", () => {
  assert.equal(shouldTransferCartToCustomer(anonymousCart), true);
  assert.equal(shouldTransferCartToCustomer({}), true);
});

test("un carrito con customer INVITADO también se transfiere", () => {
  // El caso del bug: tiene customer_id, pero de un invitado. El core lo permite
  // (transferCartCustomerWorkflow no valida nada y saltea sólo si es el mismo
  // customer), así que el storefront no tiene por qué ser más estricto.
  assert.equal(isCartOwnedByGuestCustomer(guestOwnedCart), true);
  assert.equal(shouldTransferCartToCustomer(guestOwnedCart), true);
});

test("un carrito que ya es de la cuenta NO se toca", () => {
  assert.equal(isCartOwnedByGuestCustomer(accountOwnedCart), false);
  assert.equal(shouldTransferCartToCustomer(accountOwnedCart), false);
});

/**
 * El otro extremo del mismo bug: el cart YA cuelga del customer logueado,
 * pero `has_account` sigue en `false` (un invitado que se logueó sin que ese
 * flag se actualizara). `transferCartCustomerWorkflow` compara ids y hace un
 * no-op, así que insistir acá sólo dispara requests al pedo en cada lectura
 * del carrito. Por eso el criterio recibe el id del logueado.
 */
test("un carrito de un invitado con el MISMO id que el logueado NO se transfiere", () => {
  assert.equal(
    shouldTransferCartToCustomer(guestOwnedCart, "cus_guest"),
    false,
  );
});

test("un carrito de un invitado con OTRO id sigue transfiriéndose", () => {
  assert.equal(
    shouldTransferCartToCustomer(guestOwnedCart, "cus_otro"),
    true,
  );
});

test("un carrito sin customer se transfiere aunque se conozca el id logueado", () => {
  assert.equal(
    shouldTransferCartToCustomer(anonymousCart, "cus_registrado"),
    true,
  );
});

test("sin id logueado conocido, el criterio no cambia (comportamiento previo)", () => {
  // `loggedInCustomerId` es undefined cuando el llamador no lo pudo resolver
  // (p.ej. JWT sin claim `actor_id`). No afirmar "mismo customer" en ese caso
  // es más seguro que negarlo: un falso positivo dispara un transfer de más
  // (no-op si de verdad eran el mismo), un falso negativo dejaría un cart de
  // invitado sin transferir nunca.
  assert.equal(
    shouldTransferCartToCustomer(guestOwnedCart, undefined),
    true,
  );
  assert.equal(
    shouldTransferCartToCustomer(accountOwnedCart, undefined),
    false,
  );
});

test("sin el flag pedido no se afirma que sea invitado", () => {
  // `has_account` es boolean con default false en el módulo customer: nunca es
  // null en la base. Entonces `undefined` significa "no pedimos el campo", y
  // asumir invitado ahí haría que el banner de mismatch se muestre a TODO
  // usuario logueado y que cada request dispare un transfer al aire.
  const sinFlag = {
    customer_id: "cus_registrado",
    customer: { id: "cus_registrado" },
  };

  assert.equal(isCartOwnedByGuestCustomer(sinFlag), false);
  assert.equal(shouldTransferCartToCustomer(sinFlag), false);
  assert.equal(
    shouldTransferCartToCustomer({
      customer_id: "cus_registrado",
      customer: null,
    }),
    false,
  );
});

test("el campo del expand es el que espera la Store API", () => {
  // Si esto cambia hay que revisar los fetch de cart.ts: sin el campo en
  // `fields`, el criterio se queda ciego y el bug vuelve sin ningún error.
  assert.equal(CART_CUSTOMER_ACCOUNT_FIELD, "customer.has_account");
});
