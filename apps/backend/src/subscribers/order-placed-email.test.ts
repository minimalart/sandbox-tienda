import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { mapOrderItem, quantityOf } from './order-placed-email';

/**
 * El mail de confirmación salía con "0 x $precio" y TOTAL $0 en todas las líneas.
 *
 * La causa no era la orden ni el timing: era UN campo mal pedido. `quantity` no
 * existe en `OrderLineItem` — vive en `OrderItem`, el detalle versionado — y el
 * mapeo interno de Medusa (`transform-order.js mapRepositoryToOrderModel`) reescribe
 * `items.<campo>` a `items.item.<campo>`, contra la línea. Así, `items.quantity`
 * terminaba consultando una columna inexistente y devolvía `undefined` sin error.
 * Sólo `items.detail.<campo>` esquiva esa reescritura.
 *
 * Y de ahí se caían los totales de la orden, que no son columnas: los calcula
 * `decorateCartTotals` SOBRE los items. Cantidad en `undefined` ⇒ total $0. Por eso
 * el síntoma reportado fue "no aparecen los precios" y no "falta la cantidad".
 */

const SOURCE = readFileSync(join(import.meta.dirname, 'order-placed-email.ts'), 'utf8');

test('pide la cantidad al DETALLE, no a la línea', () => {
  // Este es el assert que falla con el código viejo. `items.quantity` se ve
  // razonable y es exactamente lo que no anda: apunta a una columna que no existe.
  assert.match(
    SOURCE,
    /'items\.detail\.quantity'/,
    'sin el campo del detalle la cantidad vuelve undefined y el mail sale con precios en $0',
  );
  assert.doesNotMatch(
    SOURCE,
    /'items\.quantity'/,
    "`items.quantity` se remapea a `items.item.quantity`, que no es una columna",
  );
});

test('no pide totales de línea a columnas que no existen', () => {
  // Ni `OrderLineItem` ni `OrderItem` tienen `total`: lo calcula el decorador de
  // totales después de la consulta. Pedirlo es la MISMA clase de error que se arregló.
  assert.doesNotMatch(SOURCE, /'items\.total'/);
  assert.doesNotMatch(SOURCE, /'items\.detail\.total'/);
});

test('la cantidad se lee de las dos formas en que Medusa la devuelve', () => {
  // Arriba, que es la copia que hace `formatOrder`…
  assert.equal(quantityOf({ quantity: 3 }), 3);
  // …y el detalle crudo, porque esa copia tiene una salida temprana y no está garantizada.
  assert.equal(quantityOf({ detail: { quantity: 2 } }), 2);
  // La de arriba gana cuando están las dos.
  assert.equal(quantityOf({ quantity: 5, detail: { quantity: 9 } }), 5);
});

test('un `quantity` nulo arriba NO tapa el valor bueno del detalle', () => {
  // `Number(null)` es 0, así que un `??` mal puesto acá reintroduce el bug entero
  // devolviendo 0 con la cantidad correcta a la vista.
  assert.equal(quantityOf({ quantity: null, detail: { quantity: 4 } }), 4);
  assert.equal(quantityOf({ quantity: undefined, detail: { quantity: 7 } }), 7);
});

test('sin cantidad por ningún lado devuelve 0, no NaN', () => {
  // Un NaN se formatearía como "NaN" en el mail del cliente.
  assert.equal(quantityOf({}), 0);
  assert.equal(quantityOf({ detail: null }), 0);
});

test('la línea multiplica precio por cantidad cuando no hay total calculado', () => {
  // El caso exacto del bug: precio correcto, cantidad del detalle, total derivado.
  const line = mapOrderItem({
    id: 'item_1',
    title: 'Base coat monocomponente x25 kg',
    unit_price: 23512.38,
    detail: { quantity: 2 },
  });
  assert.equal(line.quantity, 2);
  assert.equal(line.line_total_formatted, formatArs(47024.76));
});

test('un total de línea en 0 legítimo no cae al respaldo', () => {
  // Una línea bonificada tiene total 0 de verdad. Con `||` en vez de `??` acá, el
  // respaldo la volvería a cobrar en el mail.
  const line = mapOrderItem({ id: 'i', unit_price: 1000, total: 0, detail: { quantity: 2 } });
  assert.equal(line.line_total_formatted, formatArs(0));
});

test('el total calculado gana sobre la multiplicación', () => {
  // Con descuentos o impuestos, precio × cantidad NO es el total de la línea.
  const line = mapOrderItem({ id: 'i', unit_price: 1000, total: 1800, detail: { quantity: 2 } });
  assert.equal(line.line_total_formatted, formatArs(1800));
});

/** El mismo formato que usa el subscriber, para no acoplar el test a un literal. */
function formatArs(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
