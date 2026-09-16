import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveCartHydration } from "./cart-hydration";

/**
 * Regresión: vaciar el carrito en el checkout y volver a la tienda lo
 * "resucitaba" con los ítems viejos hasta un refresh duro. El layout `(main)`
 * llegaba desde el Router Cache (30 s) con el carrito anterior y el
 * `StoreProvider` nuevo pisaba el store con él.
 */

test("el primer provider de la sesión hidrata con el carrito del server", () => {
  assert.equal(
    resolveCartHydration({ isHydrated: false, hasServerCart: true, hasPendingMutations: false }),
    "hydrate-server-cart",
  );
});

test("sin carrito del server en el primer montaje, lo pide al cliente", () => {
  assert.equal(
    resolveCartHydration({ isHydrated: false, hasServerCart: false, hasPendingMutations: false }),
    "fetch-initial",
  );
});

test("con el store ya vivo, un carrito del server (posiblemente cacheado) NO lo pisa", () => {
  // Es exactamente el caso del bug: store en null tras vaciar, payload viejo con ítems.
  assert.equal(
    resolveCartHydration({ isHydrated: true, hasServerCart: true, hasPendingMutations: false }),
    "reconcile",
  );
  assert.equal(
    resolveCartHydration({ isHydrated: true, hasServerCart: false, hasPendingMutations: false }),
    "reconcile",
  );
});

test("con mutaciones optimistas en vuelo no se reconcilia: ganaría una respuesta vieja", () => {
  assert.equal(
    resolveCartHydration({ isHydrated: true, hasServerCart: true, hasPendingMutations: true }),
    "keep-store",
  );
});
