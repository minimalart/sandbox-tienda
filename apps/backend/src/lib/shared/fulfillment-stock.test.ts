import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  type OrderLineForStock,
  type ReservationForStock,
  describeShortfalls,
  findStockShortfalls,
  participatesInStockCheck,
  planStockDemand,
} from './fulfillment-stock';

/**
 * DESDEELSUR-61: el admin dejaba crear un fulfillment desde una sucursal sin
 * mercadería y el nivel quedaba en -1, sin error.
 *
 * Lo que se fija acá es la aritmética, que es la parte que puede equivocarse en
 * silencio y en las dos direcciones: de más, y todo despacho normal se traba; de
 * menos, y vuelve el stock negativo.
 */

const ELFLEIN = 'sloc_elflein';
const ELORDI = 'sloc_elordi';
const ITEM = 'iitem_base_659';

const line = (overrides: Partial<OrderLineForStock> = {}): OrderLineForStock => ({
  id: 'ordli_1',
  title: 'Satinol esmalte satinado x1 lt',
  variant: {
    manage_inventory: true,
    allow_backorder: false,
    inventory_items: [{ inventory_item_id: ITEM, required_quantity: 1 }],
  },
  ...overrides,
});

const reservation = (overrides: Partial<ReservationForStock> = {}): ReservationForStock => ({
  line_item_id: 'ordli_1',
  inventory_item_id: ITEM,
  location_id: ELFLEIN,
  quantity: 1,
  ...overrides,
});

test('el caso normal no pide nada: la reserva está en la ubicación elegida', () => {
  const demands = planStockDemand([line()], [{ id: 'ordli_1', quantity: 1 }], [reservation()], ELFLEIN);
  assert.deepEqual(demands, []);
});

test('el bug: despachar desde otra sucursal descubre la unidad entera', () => {
  const demands = planStockDemand([line()], [{ id: 'ordli_1', quantity: 1 }], [reservation()], ELORDI);
  assert.equal(demands.length, 1);
  assert.equal(demands[0]?.uncovered, 1);
  assert.equal(demands[0]?.covered, 0);
});

test('y si esa sucursal no tiene nada, el nivel quedaría en -1', () => {
  const demands = planStockDemand([line()], [{ id: 'ordli_1', quantity: 1 }], [reservation()], ELORDI);
  const shortfalls = findStockShortfalls(demands, new Map([[ITEM, 0]]));
  assert.equal(shortfalls.length, 1);
  assert.equal(shortfalls[0]?.missing, 1);
});

test('con stock propio en la otra sucursal, el despacho es válido y no se frena', () => {
  const demands = planStockDemand([line()], [{ id: 'ordli_1', quantity: 1 }], [reservation()], ELORDI);
  assert.deepEqual(findStockShortfalls(demands, new Map([[ITEM, 5]])), []);
});

test('un inventory item sin nivel en esa ubicación cuenta como cero, no como desconocido', () => {
  const demands = planStockDemand([line()], [{ id: 'ordli_1', quantity: 1 }], [reservation()], ELORDI);
  assert.equal(findStockShortfalls(demands, new Map()).length, 1);
});

test('varias líneas sobre el mismo inventory item se suman (el caso del tintométrico)', () => {
  // Cinco colores entonados sobre la MISMA base: cinco líneas, un solo inventory item.
  const lines = [1, 2, 3, 4, 5].map((n) => line({ id: `ordli_${n}`, title: `Color ${n}` }));
  const requested = lines.map((l) => ({ id: l.id, quantity: 1 }));
  const reservations = lines.map((l) => reservation({ line_item_id: l.id }));

  const demands = planStockDemand(lines, requested, reservations, ELORDI);
  assert.equal(demands.length, 1);
  assert.equal(demands[0]?.uncovered, 5);
  assert.equal(demands[0]?.titles.length, 5);

  const shortfalls = findStockShortfalls(demands, new Map([[ITEM, 3]]));
  assert.equal(shortfalls[0]?.missing, 2);
});

test('required_quantity multiplica: un kit de 3 descuenta 3 por unidad pedida', () => {
  const kit = line({
    variant: {
      manage_inventory: true,
      allow_backorder: false,
      inventory_items: [{ inventory_item_id: ITEM, required_quantity: 3 }],
    },
  });
  const demands = planStockDemand([kit], [{ id: 'ordli_1', quantity: 2 }], [], ELORDI);
  assert.equal(demands[0]?.needed, 6);
  assert.equal(demands[0]?.uncovered, 6);
});

test('una reserva parcial en la ubicación cubre sólo su parte', () => {
  const demands = planStockDemand(
    [line()],
    [{ id: 'ordli_1', quantity: 3 }],
    [reservation({ quantity: 1 })],
    ELFLEIN,
  );
  assert.equal(demands[0]?.covered, 1);
  assert.equal(demands[0]?.uncovered, 2);
});

test('una reserva más grande que lo pedido no genera crédito de más', () => {
  const demands = planStockDemand(
    [line()],
    [{ id: 'ordli_1', quantity: 1 }],
    [reservation({ quantity: 10 })],
    ELFLEIN,
  );
  assert.deepEqual(demands, []);
});

test('sólo cuentan las líneas incluidas en el body: un parcial no descuenta el resto', () => {
  const lines = [line({ id: 'ordli_1' }), line({ id: 'ordli_2' })];
  const demands = planStockDemand(lines, [{ id: 'ordli_1', quantity: 1 }], [], ELORDI);
  assert.equal(demands[0]?.uncovered, 1);
});

test('cantidad ausente o basura no inventa un descuento', () => {
  assert.deepEqual(planStockDemand([line()], [{ id: 'ordli_1' }], [], ELORDI), []);
  assert.deepEqual(
    planStockDemand([line()], [{ id: 'ordli_1', quantity: Number.NaN }], [], ELORDI),
    [],
  );
});

// ── El escape hatch, que es del core y no nuestro ──────────────────────────────

test('allow_backorder es la opción de la tienda que despacha sin stock a propósito', () => {
  const backorder = line({
    variant: {
      manage_inventory: true,
      allow_backorder: true,
      inventory_items: [{ inventory_item_id: ITEM, required_quantity: 1 }],
    },
  });
  assert.equal(participatesInStockCheck(backorder), false);
  assert.deepEqual(planStockDemand([backorder], [{ id: 'ordli_1', quantity: 1 }], [], ELORDI), []);
});

test('una variante sin gestión de inventario no participa', () => {
  const unmanaged = line({
    variant: { manage_inventory: false, inventory_items: [{ inventory_item_id: ITEM }] },
  });
  assert.equal(participatesInStockCheck(unmanaged), false);
});

test('manage_inventory ausente se saltea: significa "no pedimos el campo", no "no gestiona"', () => {
  const noField = line({ variant: { inventory_items: [{ inventory_item_id: ITEM }] } });
  assert.equal(participatesInStockCheck(noField), false);
  assert.equal(participatesInStockCheck(line({ variant: null })), false);
});

// ── El mensaje ────────────────────────────────────────────────────────────────

test('el mensaje dice qué pasó y qué hacer, sin detalle técnico (DESDEELSUR-80)', () => {
  const message = describeShortfalls('Sucursal ELFLEIN', 'Zeus');

  assert.equal(
    message,
    [
      'No podés preparar este pedido desde Sucursal ELFLEIN',
      'Hay productos que todavía no tienen stock suficiente en esta sucursal.',
      'Transferí en Zeus los productos faltantes a Sucursal ELFLEIN. Una vez actualizado el stock, volvé a intentar preparar el pedido.',
    ].join('\n'),
  );
});

test('la primera línea es el título del toast: el patch del dashboard parte en el primer salto', () => {
  const [title, ...detail] = describeShortfalls('Sucursal ELFLEIN', 'Zeus').split('\n');

  assert.equal(title, 'No podés preparar este pedido desde Sucursal ELFLEIN');
  assert.equal(detail.length, 2);
  assert.doesNotMatch(detail.join(' '), /faltan \d|disponible \d|iitem_|ordli_/);
});

test('sin ERP activo la instrucción no nombra ningún sistema', () => {
  const message = describeShortfalls('Sucursal ELFLEIN', null);
  assert.match(message, /^Transferí los productos faltantes a Sucursal ELFLEIN\./m);
  assert.doesNotMatch(message, /Zeus|ERP/);
});

test('sin nombre de ubicación el mensaje sigue siendo legible', () => {
  assert.match(describeShortfalls(null, 'Zeus'), /^No podés preparar este pedido desde la ubicación elegida$/m);
});
