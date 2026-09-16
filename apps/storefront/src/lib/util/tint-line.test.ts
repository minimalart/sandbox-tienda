import assert from "node:assert/strict";
import { test } from "node:test";

import { readTintLine, tintLineText } from "./tint-line";

/**
 * El color entonado se elegía en el PDP, se cobraba como recargo, y desaparecía
 * en cuanto la compra terminaba: el carrito lo mostraba y la orden confirmada,
 * el detalle de la cuenta, el admin y los mails no. El dato SIEMPRE estuvo en
 * `metadata.tint` de la línea — lo que faltaba era leerlo.
 */

const TINT = {
  version: 1,
  cod_base: "661",
  cod_formula: "F 1234",
  color_code: "82YR 83/056",
  color_name: "Brisa Chic",
  color_hex: "#F2E2D8",
};

test("lee el color de una línea entonada", () => {
  const tint = readTintLine({ tint: TINT });
  assert.deepEqual(tint, {
    label: "Brisa Chic",
    code: "82YR 83/056",
    hex: "#F2E2D8",
  });
  assert.equal(tintLineText(tint!), "Color: Brisa Chic (82YR 83/056)");
});

test("una línea común no es entonada", () => {
  assert.equal(readTintLine(null), null);
  assert.equal(readTintLine(undefined), null);
  assert.equal(readTintLine({}), null);
  assert.equal(readTintLine({ checkout_line_key: "abc" }), null);
});

test("un `tint` que no es objeto no rompe la card", () => {
  // Viene de una orden guardada, no de nosotros: puede ser cualquier cosa.
  assert.equal(readTintLine({ tint: "Brisa Chic" }), null);
  assert.equal(readTintLine({ tint: 42 }), null);
  assert.equal(readTintLine({ tint: {} }), null);
});

test("una orden vieja sin nombre cae al código, y no lo repite", () => {
  const tint = readTintLine({ tint: { color_code: "82YR 83/056" } });
  assert.equal(tint?.label, "82YR 83/056");
  assert.equal(tintLineText(tint!), "Color: 82YR 83/056");
});

test("un hex inválido se descarta y queda el gris neutro", () => {
  // Sin hex el componente pinta `--ui-bg-component`. Inventar un color sería
  // mostrarle al cliente una pintura que no es la que va a recibir.
  assert.equal(readTintLine({ tint: { ...TINT, color_hex: "rojo" } })?.hex, null);
  assert.equal(readTintLine({ tint: { ...TINT, color_hex: "#FFF" } })?.hex, null);
  assert.equal(readTintLine({ tint: { ...TINT, color_hex: 16777215 } })?.hex, null);
});
