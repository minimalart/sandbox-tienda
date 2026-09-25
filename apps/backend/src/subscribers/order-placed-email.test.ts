import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { mapOrderItem, quantityOf, withStockStatus } from './order-placed-email';

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

/**
 * El color entonado.
 *
 * La línea del carrito ya guardaba `metadata.tint` Y un `subtitle` "Color: X",
 * escrito — según su propio comentario — "para que cualquier cosa que ya
 * renderice subtitle (mails, panel de admin, remitos) muestre el color sin
 * tocar nada". Ninguna de esas tres lo renderiza, y el mail ni siquiera pedía
 * `items.metadata` al grafo: la orden mostraba el recargo de entonado cobrado
 * sin decir nunca de qué color era.
 */

test('pide la metadata de la línea, que es donde vive el color', () => {
  assert.match(
    SOURCE,
    /'items\.metadata'/,
    'sin este campo `metadata` llega undefined y ninguna línea sale entonada',
  );
});

test('la línea entonada expone el color ya armado', () => {
  const line = mapOrderItem({
    id: 'i',
    unit_price: 104426,
    detail: { quantity: 1 },
    metadata: {
      tint: {
        version: 1,
        cod_base: '661',
        cod_formula: 'F 1234',
        color_code: '82YR 83/056',
        color_name: 'Brisa Chic',
        color_hex: '#F2E2D8',
      },
    },
  });
  assert.equal(line.color_label, 'Brisa Chic (82YR 83/056)');
  assert.equal(line.color_name, 'Brisa Chic');
  assert.equal(line.color_code, '82YR 83/056');
  assert.equal(line.color_hex, '#F2E2D8');
});

test('la línea entonada usa el título LIMPIO, sin el color pegado', () => {
  // `title` de una línea entonada trae el color adentro — lo escribe
  // `POST /store/tinting/line-items` para que se vea en el resumen de orden del
  // admin, que no renderiza ni `subtitle` ni la metadata. Pero la plantilla ya
  // pinta el color aparte con `color_label`, así que acá va `product_title`: si
  // no, el mail diría "Vino Clásico" dos veces en la misma fila.
  const line = mapOrderItem({
    id: 'i',
    title: 'Marble color fino x25 kg — Vino Clásico (09YR 05/305)',
    product_title: 'Marble color fino x25 kg',
    unit_price: 104426,
    detail: { quantity: 1 },
    metadata: {
      tint: { version: 1, cod_base: 'RV60', cod_formula: 'F 1', color_code: '09YR 05/305', color_name: 'Vino Clásico' },
    },
  });
  assert.equal(line.title, 'Marble color fino x25 kg');
  assert.equal(line.color_label, 'Vino Clásico (09YR 05/305)');
});

test('el campo del título limpio se pide en la consulta', () => {
  assert.match(
    SOURCE,
    /'items\.product_title'/,
    'sin este campo el título llega sin `product_title` y el mail repite el color',
  );
});

test('una orden entonada VIEJA, sin product_title, cae al título de la línea', () => {
  // Las órdenes anteriores a este cambio tienen el título sin el color, así que
  // caer a `title` es exactamente lo correcto. Lo que no puede pasar es que el
  // mail salga con el título vacío.
  const line = mapOrderItem({
    id: 'i',
    title: 'Marble color fino x25 kg',
    unit_price: 104426,
    detail: { quantity: 1 },
    metadata: {
      tint: { version: 1, cod_base: 'RV60', cod_formula: 'F 1', color_code: '09YR 05/305', color_name: 'Vino Clásico' },
    },
  });
  assert.equal(line.title, 'Marble color fino x25 kg');
});

test('una línea sin entonar no trae ningún campo de color', () => {
  // Las plantillas deciden con un `{{#if this.color_label}}`: si el campo
  // llegara vacío en vez de ausente, toda línea común dibujaría el bloque.
  const line = mapOrderItem({ id: 'i', unit_price: 4235, detail: { quantity: 1 } });
  assert.equal(line.color_label, undefined);
  assert.equal(line.color_hex, undefined);
});

test('una orden vieja sin nombre de color cae al código', () => {
  const line = mapOrderItem({
    id: 'i',
    unit_price: 1000,
    detail: { quantity: 1 },
    metadata: { tint: { color_code: '82YR 83/056' } },
  });
  // No se repite el código entre paréntesis cuando ya es la etiqueta.
  assert.equal(line.color_label, '82YR 83/056');
});

test('un hex que no es un hex no llega a la plantilla', () => {
  // El valor termina dentro de un atributo `style` del HTML del mail. Handlebars
  // escapa, pero un hex inválido tampoco pinta nada útil: mejor el gris neutro.
  const line = mapOrderItem({
    id: 'i',
    unit_price: 1000,
    detail: { quantity: 1 },
    metadata: { tint: { color_name: 'Brisa Chic', color_hex: 'rojo; background:url(x)' } },
  });
  assert.equal(line.color_label, 'Brisa Chic');
  assert.equal(line.color_hex, undefined);
});

test('un `tint` que no es un objeto no rompe el mapeo', () => {
  const line = mapOrderItem({
    id: 'i',
    unit_price: 1000,
    detail: { quantity: 1 },
    metadata: { tint: 'Brisa Chic' as unknown as Record<string, unknown> },
  });
  assert.equal(line.color_label, undefined);
});

/**
 * DESDEELSUR-80/81: el mail admin necesita `shipping_methods.shipping_option_id`
 * para resolver la ubicación de stock en una orden que NO es de retiro
 * (`shipping_option → service_zone.fulfillment_set_id →
 * location_fulfillment_set.stock_location_id`, ver
 * `modules/email/order-stock-context.ts`). Sin este campo el pedido #81 (envío a
 * domicilio) queda sin forma de saber de qué sucursal es el stock.
 */
test('pide shipping_methods.shipping_option_id, el eje para resolver stock en envíos', () => {
  assert.match(SOURCE, /'shipping_methods\.shipping_option_id'/);
});

/**
 * El IVA se cobraba DOS VECES (desdeelsur, orden #81): `getLineItemTotals` decide
 * si `unit_price` ya incluye el impuesto con `item.is_tax_inclusive ?? context.
 * includeTax`. Sin pedir el campo llega `undefined`, cae al default del contexto,
 * y una línea con precio CON IVA se trata como si no lo tuviera: el 21% se suma
 * una segunda vez. Mismo mecanismo del lado del envío
 * (`shippingMethod.is_tax_inclusive`), que además necesita `amount` para poder
 * calcular algo.
 */
test('pide items.is_tax_inclusive: sin esto el IVA se cobra dos veces', () => {
  assert.match(SOURCE, /'items\.is_tax_inclusive'/);
});

test('pide shipping_methods.is_tax_inclusive y shipping_methods.amount', () => {
  assert.match(SOURCE, /'shipping_methods\.is_tax_inclusive'/);
  assert.match(SOURCE, /'shipping_methods\.amount'/);
});

test('el mail del CLIENTE no manda order_items con stock (sharedData tal cual)', () => {
  const customerBlock = SOURCE.slice(SOURCE.indexOf("recipient_type: 'customer'") - 40, SOURCE.indexOf("recipient_type: 'customer'") + 40);
  assert.match(customerBlock, /\{ \.\.\.sharedData, recipient_type: 'customer' \}/);
});

test('el mail ADMIN pisa order_items con la versión que lleva stock', () => {
  const adminIndex = SOURCE.indexOf("recipient_type: 'creator'");
  assert.ok(adminIndex > -1, 'no se encontró el bloque del mail admin');
  const adminBlock = SOURCE.slice(adminIndex, adminIndex + 400);
  assert.match(adminBlock, /order_items:\s*adminOrderItems/);
});

// ─── withStockStatus: el stock NUNCA viaja al mail del cliente ────────────────

test('sin estado de stock, el ítem vuelve intacto (no agrega campos undefined)', () => {
  const item = { title: 'Yerba Mate 1kg', quantity: 1 };
  assert.deepEqual(withStockStatus(item, undefined), item);
});

test('con estado de stock, agrega los CUATRO campos que la plantilla admin pinta', () => {
  const item = { title: 'Yerba Mate 1kg', quantity: 1 };
  const merged = withStockStatus(item, {
    status: 'insufficient',
    status_label: 'Stock insuficiente',
    status_color: '#b45309',
    available_label: '1',
  });
  assert.equal(merged.title, 'Yerba Mate 1kg');
  assert.equal(merged.stock_status, 'insufficient');
  assert.equal(merged.stock_status_label, 'Stock insuficiente');
  assert.equal(merged.stock_status_color, '#b45309');
  assert.equal(merged.stock_available_label, '1');
});

/** El mismo formato que usa el subscriber, para no acoplar el test a un literal. */
function formatArs(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
