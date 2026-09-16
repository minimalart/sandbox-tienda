import assert from "node:assert/strict";
import { test } from "node:test";
import { CART_COMPLETED_AT_FIELD, isCompletedCart } from "./completed-cart";

/**
 * Regresión de DESDEELSUR-61 / BUG-08 (crítico, bloqueante).
 *
 * Tras completar una compra, los productos comprados seguían apareciendo en el
 * carrito etiquetados "Sin stock", y el drawer bloqueaba "Finalizar compra" con
 * "Eliminá los productos sin stock para continuar". El stock mostrado era
 * correcto: lo había consumido esa misma compra. El carrito mostrado era el que
 * estaba mal — la cookie seguía apuntando al carrito ya convertido en orden.
 *
 * La causa estructural: había DOS `retrieveCart` en el storefront.
 * `repositories/cart.repository.ts` pedía `+completed_at` y descartaba el
 * carrito; `data/cart.ts` — la que alimenta el layout, `/cart` y el botón del
 * header — ni pedía el campo. Escribir la regla dos veces es cómo una de las dos
 * copias se queda vieja, así que ahora vive en un solo módulo y los dos caminos
 * la consumen.
 */

test("un carrito con completed_at ya es una orden", () => {
  assert.equal(isCompletedCart({ id: "cart_1", completed_at: "2026-09-09T12:00:00Z" }), true);
  // Medusa puede devolverlo como Date según el camino de serialización.
  assert.equal(isCompletedCart({ id: "cart_1", completed_at: new Date() }), true);
});

test("un carrito activo no se descarta", () => {
  assert.equal(isCompletedCart({ id: "cart_1", completed_at: null }), false);
  assert.equal(isCompletedCart({ id: "cart_1", completed_at: undefined }), false);
  // Sin el campo pedido en `fields` la propiedad no viene: no se puede afirmar
  // que esté completado, y dar por completado un carrito vivo lo vaciaría.
  assert.equal(isCompletedCart({ id: "cart_1" }), false);
});

test("nada que no sea un objeto es un carrito completado", () => {
  for (const value of [null, undefined, "", 0, false, "completed"]) {
    assert.equal(isCompletedCart(value), false, String(value));
  }
});

test("el nombre del campo es el que hay que pedir en `fields`", () => {
  // Si esto cambia, los dos `retrieveCart` y el guard de `transferCart` dejan de
  // recibir el dato y el bug vuelve en silencio: el carrito completado se
  // muestra como activo, sin error.
  assert.equal(CART_COMPLETED_AT_FIELD, "completed_at");
});
