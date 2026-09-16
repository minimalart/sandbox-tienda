import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SALE_ORDER_FIELDS, lineQuantityOf, lineTotalOf } from './build-sale-payload.ts';

/**
 * Estos tests existen por un comprobante emitido en CERO.
 *
 * El 10/09/2026, con la facturación recién prendida, la venta que salió a Zeus
 * llevaba `cantidad: 0` y `total: 0` sobre una orden de $186.262,84. No falló
 * nada: el ERP aceptó el pedido, el outbox lo dio por enviado y ninguna pantalla
 * mostró un error. El único rastro fue el `request_payload` guardado.
 *
 * La causa era una sola línea de la lista de campos —`items.quantity` en lugar
 * de `items.detail.quantity`— y **una lista de campos no se puede testear
 * ejecutándola**: `query.graph` devuelve `undefined` para un campo que no
 * existe, sin error. Por eso el test ata la LISTA, que es donde vive el bug.
 */

test('pide la cantidad por el detalle versionado, que es la única que llega', () => {
  assert.ok(
    SALE_ORDER_FIELDS.includes('items.detail.quantity'),
    'sin `items.detail.quantity` la cantidad llega undefined y el comprobante sale en 0'
  );
});

test('NO pide items.quantity: esa columna no existe y devuelve undefined', () => {
  // El mapeo interno de Medusa reescribe `items.<campo>` contra la LÍNEA, donde
  // `quantity` no existe. Pedirlo no falla — devuelve undefined, que es peor.
  assert.ok(!SALE_ORDER_FIELDS.includes('items.quantity'));
});

test('NO pide el total de la línea por ninguna de las dos vías', () => {
  // No es columna de `OrderLineItem` ni de `OrderItem`: lo calcula
  // `decorateCartTotals` después de la consulta y llega solo.
  assert.ok(!SALE_ORDER_FIELDS.includes('items.total'));
  assert.ok(!SALE_ORDER_FIELDS.includes('items.detail.total'));
});

test('sigue pidiendo los totales de la orden y la metadata del entonado', () => {
  // Los totales se CALCULAN sobre los items: con la cantidad arreglada vuelven
  // solos, pero si alguien saca estos campos vuelven a dar 0.
  for (const field of ['total', 'subtotal', 'shipping_total', 'discount_total', 'tax_total']) {
    assert.ok(SALE_ORDER_FIELDS.includes(field), `falta el total de orden \`${field}\``);
  }
  // `items.metadata` es de dónde sale el color entonado; `items.variant.metadata`,
  // la alícuota de IVA por artículo. Las dos ya se perdieron una vez.
  assert.ok(SALE_ORDER_FIELDS.includes('items.metadata'));
  assert.ok(SALE_ORDER_FIELDS.includes('items.variant.metadata'));
});

test('pide el título limpio del producto además del de la línea', () => {
  // Desde que el alta de una base entonada escribe el color DENTRO de `title`
  // (para que se vea en el resumen de orden del admin, que no renderiza ni
  // `subtitle` ni la metadata), mandarle `item.title` a Zeus le pegaría el
  // color dos veces: el adapter arma la descripción como
  // `<título> — Color <nombre>`. El título limpio vive en `product_title`.
  assert.ok(
    SALE_ORDER_FIELDS.includes('items.product_title'),
    'sin `items.product_title` el remito de una línea entonada repite el color'
  );
});

test('la lista no tiene campos repetidos', () => {
  assert.equal(new Set(SALE_ORDER_FIELDS).size, SALE_ORDER_FIELDS.length);
});

test('lineQuantityOf lee el detalle cuando la línea no trae cantidad', () => {
  assert.equal(lineQuantityOf({ detail: { quantity: 3 } }), 3);
  assert.equal(lineQuantityOf({ quantity: null, detail: { quantity: 3 } }), 3);
  assert.equal(lineQuantityOf({ quantity: 2, detail: { quantity: 3 } }), 2);
});

test('lineQuantityOf devuelve 0 cuando no hay cantidad por ningún lado', () => {
  // Es el estado que produjo el bug. Vale 0 acá, pero el ERP no debería ver
  // nunca este caso: si pasa, es que la lista de campos volvió a romperse.
  assert.equal(lineQuantityOf({}), 0);
  assert.equal(lineQuantityOf({ quantity: null, detail: null }), 0);
});

test('lineTotalOf usa el total calculado cuando está', () => {
  assert.equal(lineTotalOf({ total: 500, unit_price: 100, detail: { quantity: 2 } }), 500);
  assert.equal(lineTotalOf({ detail: { total: 500, quantity: 2 }, unit_price: 100 }), 500);
});

test('lineTotalOf reconstruye precio × cantidad si el total no llegó', () => {
  // Sin este respaldo, una línea sin total calculado le manda un 0 al ERP.
  assert.equal(lineTotalOf({ unit_price: 100, detail: { quantity: 3 } }), 300);
  assert.equal(lineTotalOf({ unit_price: 186262.84, detail: { quantity: 1 } }), 186262.84);
});

test('un total 0 explícito se respeta y no se recalcula', () => {
  // Una línea bonificada al 100% es legítima: no hay que "arreglarla".
  assert.equal(lineTotalOf({ total: 0, unit_price: 100, detail: { quantity: 2 } }), 0);
});

test('valores basura no propagan NaN al comprobante', () => {
  assert.equal(lineQuantityOf({ quantity: 'dos' as unknown as number }), 0);
  assert.equal(lineTotalOf({ total: 'mucho' as unknown as number, unit_price: 10 }), 0);
});
