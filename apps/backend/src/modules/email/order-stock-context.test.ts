import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { classifyOrderStock, shippingOptionIdsOf } from './order-stock-context';

/**
 * El generalizado de `pickup-context.ts` a CUALQUIER orden (DESDEELSUR-80,
 * pedido #81: envío a domicilio sin una sola palabra de stock porque
 * `buildPickupContext` devuelve `null` sin `store_id`).
 *
 * Lo que se prueba acá es la parte PURA: la clasificación de una línea y la
 * extracción de los `shipping_option_id`. La resolución de la ubicación
 * (`resolveStockLocation`, `buildOrderStockContext`) es I/O contra `query.graph`
 * y el servicio de inventario — se ata por SOURCE, igual que el resto del
 * módulo de mails (ver `order-placed-email.test.ts`), porque levantar un
 * container completo para esto es más frágil que el bug que se quiere cubrir.
 */

const SOURCE = readFileSync(join(import.meta.dirname, 'order-stock-context.ts'), 'utf8');

// ─── classifyOrderStock ────────────────────────────────────────────────────────

test('alcanza para lo pedido → disponible (empate incluido)', () => {
  assert.equal(classifyOrderStock(2, { kind: 'tracked', available: 5 }), 'available');
  assert.equal(classifyOrderStock(5, { kind: 'tracked', available: 5 }), 'available');
});

test('hay algo pero no lo suficiente → insuficiente', () => {
  assert.equal(classifyOrderStock(5, { kind: 'tracked', available: 2 }), 'insufficient');
});

test('0 o negativo → sin stock', () => {
  assert.equal(classifyOrderStock(3, { kind: 'tracked', available: 0 }), 'none');
  assert.equal(classifyOrderStock(3, { kind: 'tracked', available: -1 }), 'none');
});

test('variante no trackeada (manage_inventory false / allow_backorder true) → not_tracked, NUNCA "Sin stock"', () => {
  const status = classifyOrderStock(3, { kind: 'not_tracked' });
  assert.equal(status, 'not_tracked');
  assert.notEqual(status, 'none');
});

test('ubicación no resoluble → unknown con label "—", NUNCA "Sin stock"', () => {
  const status = classifyOrderStock(3, { kind: 'unknown' });
  assert.equal(status, 'unknown');
  assert.notEqual(status, 'none');
});

// ─── shippingOptionIdsOf ────────────────────────────────────────────────────────

test('junta los shipping_option_id de los métodos de envío, en orden', () => {
  assert.deepEqual(
    shippingOptionIdsOf([{ shipping_option_id: 'so_1' }, { shipping_option_id: 'so_2' }]),
    ['so_1', 'so_2'],
  );
});

test('descarta métodos sin shipping_option_id, sin romper el orden de los demás', () => {
  assert.deepEqual(
    shippingOptionIdsOf([{ shipping_option_id: null }, { shipping_option_id: 'so_2' }, {}]),
    ['so_2'],
  );
});

test('sin métodos de envío devuelve vacío, no rompe', () => {
  assert.deepEqual(shippingOptionIdsOf(null), []);
  assert.deepEqual(shippingOptionIdsOf(undefined), []);
  assert.deepEqual(shippingOptionIdsOf([]), []);
});

// ─── La cadena de resolución de ubicación por envío, atada por SOURCE ─────────
//
// "Orden de envío resuelve ubicación por shipping option": la ruta real es
// shipping_option → service_zone.fulfillment_set_id → location_fulfillment_set.
// stock_location_id (el mismo link que crea `link.create({ [STOCK_LOCATION]:
// {...}, [FULFILLMENT]: {...} })` en `scripts/seed-operational.ts`, y el mismo
// campo — `service_zone.fulfillment_set_id` — que usa el core para filtrar
// `/admin/shipping-options` por ubicación). Un cambio que rompa esta cadena no
// se ve reflejado en ningún test de arriba porque requiere un container real;
// éste es el guardrail barato.

test('resuelve la ubicación de envío por la cadena shipping_option → service_zone → location_fulfillment_set', () => {
  assert.match(SOURCE, /entity:\s*'shipping_option'/);
  assert.match(SOURCE, /'service_zone\.fulfillment_set_id'/);
  assert.match(SOURCE, /entity:\s*'location_fulfillment_set'/);
  assert.match(SOURCE, /filters:\s*\{\s*fulfillment_set_id:\s*fulfillmentSetId\s*\}/);
});

test('lee la disponibilidad del SERVICIO de inventario, no del computed field de query.graph', () => {
  assert.match(SOURCE, /inventory\.retrieveAvailableQuantity/);
  assert.doesNotMatch(SOURCE, /location_levels\.available_quantity/);
});

test('pide manage_inventory y allow_backorder: sin ellos, not_tracked no se puede decidir', () => {
  assert.match(SOURCE, /'manage_inventory'/);
  assert.match(SOURCE, /'allow_backorder'/);
});
