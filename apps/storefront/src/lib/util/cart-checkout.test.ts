import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getCartCheckoutEligibility,
  getCartMinimumPurchaseTotal,
} from "./cart-checkout";

/**
 * Regresión de TC-001 (DESDEELSUR-33): el cartel del carrito pedía de más.
 *
 * QA agregó un producto de $1330 cuando faltaban $1328 para el mínimo y el
 * cartel siguió diciendo "faltan $229". La cuenta cierra sola: 1328 - 229 =
 * 1099, y 1330 / 1,21 = 1099,17. Ese 21% es el IVA.
 *
 * El mecanismo: con precios tax-inclusive Medusa deja en `item.subtotal` el
 * neto SIN impuestos, y el cálculo del mínimo lo sumaba tal cual — mientras
 * que el precio que el comprador ve en la góndola, y el subtotal que el propio
 * drawer muestra, salen de `item.original_total` (CON impuestos). Dos bases
 * distintas para el mismo número: el umbral se medía en pesos de góndola y el
 * acumulado en pesos netos, así que el mínimo era ~21% más alto de lo anunciado.
 */

// Línea tal como la devuelve Medusa con precios tax-inclusive: `subtotal` es el
// neto y `original_total` el bruto que ve el comprador.
const taxInclusiveLine = (grossTotal: number, id = "prod_x") => ({
  id: `li_${id}`,
  product_id: id,
  quantity: 1,
  unit_price: grossTotal,
  subtotal: grossTotal / 1.21,
  original_total: grossTotal,
  total: grossTotal,
});

test("suma el monto CON impuestos, no el neto", () => {
  const items = [taxInclusiveLine(1330)] as never;
  assert.equal(getCartMinimumPurchaseTotal(items), 1330);
});

test("TC-001: alcanzar el umbral con precios de góndola habilita el checkout", () => {
  // Carrito de QA: $18.670 acumulados + el producto de $1330 = $20.000 justos.
  const items = [
    taxInclusiveLine(18670, "acumulado"),
    taxInclusiveLine(1330, "ultimo"),
  ] as never;

  const eligibility = getCartCheckoutEligibility({
    items,
    minimumPurchaseAmount: 20000,
  });

  assert.equal(eligibility.remaining, 0);
  assert.equal(eligibility.hasMinimumPurchase, true);
  assert.equal(eligibility.canCheckout, true);
});

test("un ítem regalado por promo no aporta al mínimo", () => {
  const items = [
    { ...taxInclusiveLine(5000, "pago") },
    { ...taxInclusiveLine(3000, "regalo"), total: 0 },
  ] as never;

  const promotions = [
    {
      application_method: {
        target_rules: [
          { attribute: "items.product.id", values: [{ value: "regalo" }] },
        ],
      },
    },
  ] as never;

  assert.equal(getCartMinimumPurchaseTotal(items, promotions), 5000);
});

test("sin original_total cae al subtotal y después a unit_price × quantity", () => {
  const soloSubtotal = [
    { id: "li_a", product_id: "a", subtotal: 900, quantity: 1 },
  ] as never;
  assert.equal(getCartMinimumPurchaseTotal(soloSubtotal), 900);

  const soloUnitPrice = [
    { id: "li_b", product_id: "b", unit_price: 250, quantity: 4 },
  ] as never;
  assert.equal(getCartMinimumPurchaseTotal(soloUnitPrice), 1000);
});
