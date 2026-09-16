import assert from "node:assert/strict";
import { test } from "node:test";
import { parseLiters, pricePerLiter } from "./price-per-liter";

/**
 * DESDEELSUR-61 / BUG-09: el comparador comparaba atributos de identificación
 * (SKU, categoría) en vez de algo con lo que decidir.
 *
 * Lo que se fija acá es el criterio conservador: ante una etiqueta que no se
 * puede leer con una única lectura, NO se devuelve un número. Un precio por
 * litro equivocado tiene aspecto de dato duro y manda a comprar mal.
 */

test("etiquetas reales del catálogo de desdeelsur", () => {
  assert.equal(parseLiters("1 lt"), 1);
  assert.equal(parseLiters("4 lt"), 4);
  assert.equal(parseLiters("20 lts"), 20);
  assert.equal(parseLiters("x 1 lt"), 1);
  // Litraje de las bases entonables: coma decimal, es-AR.
  assert.equal(parseLiters("8,7 lt"), 8.7);
  assert.equal(parseLiters("17,4 litros"), 17.4);
  assert.equal(parseLiters("0.5 L"), 0.5);
});

test("mililitros y centímetros cúbicos se normalizan a litros", () => {
  assert.equal(parseLiters("500 ml"), 0.5);
  assert.equal(parseLiters("250 cc"), 0.25);
});

test("el peso NO es volumen: no se inventan litros", () => {
  // Masillas y cementos vienen en kilos. Dividir por kilos y rotular "por
  // litro" sería fabricar el dato.
  for (const label of ["30 kg", "1 kg", "500 gr", "25 kilos"]) {
    assert.equal(parseLiters(label), null, label);
  }
});

test("sin una única lectura posible devuelve null", () => {
  for (const label of [
    "Pack 2 x 4 lt", // dos cantidades: no hay una sola respuesta
    "de 1 a 4 lt", // rango
    "lt", // sin número
    "Blanco", // sin cantidad ni unidad
    "",
    null,
    undefined,
  ]) {
    assert.equal(parseLiters(label as string), null, String(label));
  }
});

test("BUG-09: el caso que motivó la fila, con precios reales", () => {
  // Mismo producto, dos envases. Con el precio absoluto al lado no se decide;
  // con el precio por litro sí — el de 4 lt es ~19% más barato por litro.
  const unLitro = pricePerLiter(16534.87, "1 lt");
  const cuatroLitros = pricePerLiter(53988.58, "4 lt");

  assert.ok(unLitro !== null && cuatroLitros !== null);
  assert.equal(Math.round(unLitro), 16535);
  assert.equal(Math.round(cuatroLitros), 13497);
  assert.ok(cuatroLitros < unLitro);
});

test("falta cualquiera de las dos mitades y no hay fila", () => {
  assert.equal(pricePerLiter(16534.87, "30 kg"), null);
  assert.equal(pricePerLiter(null, "1 lt"), null);
  assert.equal(pricePerLiter(0, "1 lt"), null);
  assert.equal(pricePerLiter(-100, "1 lt"), null);
  assert.equal(pricePerLiter(Number.NaN, "1 lt"), null);
});

test("un envase absurdamente chico se descarta en vez de inflar el precio", () => {
  // "50 ml" en una pinturería es casi seguro una etiqueta mal cargada, y el
  // precio por litro saldría 20x.
  assert.equal(pricePerLiter(16534.87, "50 ml"), null);
});
