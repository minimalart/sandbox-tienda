import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  inventoryItemIdsOf,
  netAvailableForVariant,
  variantTracksStock,
  type ReservationForStock,
} from './stock-availability';

/**
 * La aritmética que reemplaza al bug de DESDEELSUR-80: `location_levels.
 * available_quantity` es un campo COMPUTADO que llega `undefined` si no se pide
 * junto con `stocked_quantity`/`reserved_quantity`, y `Number(undefined) || 0`
 * volvía "Sin stock" una línea con stock real. Acá se prueba la cuenta ya
 * DESACOPLADA de esa lectura: se le pasa el disponible crudo (el que devolvería
 * `inventory.retrieveAvailableQuantity`, que sí lee bien) y se verifica que la
 * suma de la reserva propia y el mínimo de kit salgan correctos.
 */

// ─── ¿Participa del control? ──────────────────────────────────────────────────

test('gestiona inventario y no acepta backorder → participa', () => {
  assert.equal(variantTracksStock({ manage_inventory: true, allow_backorder: false }), true);
});

test('allow_backorder en true → no participa (aunque gestione inventario)', () => {
  // Gobierna el checkout, no el despacho: mostrar un número acá sería mentir
  // sobre algo que la tienda decidió no controlar.
  assert.equal(variantTracksStock({ manage_inventory: true, allow_backorder: true }), false);
});

test('manage_inventory en false o ausente → no participa', () => {
  assert.equal(variantTracksStock({ manage_inventory: false }), false);
  // `undefined` es "no se pidió el campo", no "sí gestiona": nunca hay que
  // inventar un valor a partir de un dato que no llegó.
  assert.equal(variantTracksStock({}), false);
});

// ─── El caso que falló: stocked 3 / reserved 0 → disponible ──────────────────

test('nivel con stock real → disponible, NO "Sin stock"', () => {
  // `rawAvailableByItem` ya es el número correcto (lo que devolvería el
  // SERVICIO de inventario, no el grafo): acá se prueba que la cuenta no lo
  // arruine, no la lectura en sí.
  const available = netAvailableForVariant({
    variant: { manage_inventory: true, allow_backorder: false, inventory_items: [{ inventory_item_id: 'ii_1' }] },
    lineItemId: 'item_1',
    locationId: 'sloc_elordi',
    rawAvailableByItem: new Map([['ii_1', 3]]),
    reservations: [],
  });
  assert.equal(available, 3);
});

// ─── La reserva propia se suma de vuelta ─────────────────────────────────────

test('reserva propia en la misma ubicación: stocked 1 / reserved 1 de esta orden, pide 1 → disponible', () => {
  // El servicio ya restó la reserva de esta orden: raw = 1 - 1 = 0.
  const reservations: ReservationForStock[] = [
    { line_item_id: 'item_1', inventory_item_id: 'ii_1', location_id: 'sloc_elordi', quantity: 1 },
  ];
  const available = netAvailableForVariant({
    variant: { manage_inventory: true, allow_backorder: false, inventory_items: [{ inventory_item_id: 'ii_1' }] },
    lineItemId: 'item_1',
    locationId: 'sloc_elordi',
    rawAvailableByItem: new Map([['ii_1', 0]]),
    reservations,
  });
  assert.equal(available, 1);
});

test('reserva AJENA (otra orden, u otra ubicación) no se suma', () => {
  const otraLinea: ReservationForStock[] = [
    { line_item_id: 'item_de_otra_orden', inventory_item_id: 'ii_1', location_id: 'sloc_elordi', quantity: 5 },
  ];
  const otraUbicacion: ReservationForStock[] = [
    { line_item_id: 'item_1', inventory_item_id: 'ii_1', location_id: 'sloc_km13', quantity: 5 },
  ];
  const paramsBase = {
    variant: { manage_inventory: true, allow_backorder: false, inventory_items: [{ inventory_item_id: 'ii_1' }] },
    lineItemId: 'item_1',
    locationId: 'sloc_elordi',
    rawAvailableByItem: new Map([['ii_1', 0]]),
  };
  assert.equal(netAvailableForVariant({ ...paramsBase, reservations: otraLinea }), 0);
  assert.equal(netAvailableForVariant({ ...paramsBase, reservations: otraUbicacion }), 0);
});

// ─── No tracked ───────────────────────────────────────────────────────────────

test('variante no trackeada devuelve null, no un número', () => {
  const available = netAvailableForVariant({
    variant: { manage_inventory: true, allow_backorder: true, inventory_items: [{ inventory_item_id: 'ii_1' }] },
    lineItemId: 'item_1',
    locationId: 'sloc_elordi',
    rawAvailableByItem: new Map([['ii_1', 0]]),
    reservations: [],
  });
  assert.equal(available, null);
});

// ─── Kits: mínimo, y por unidad ───────────────────────────────────────────────

test('kit: el mínimo de los componentes, dividido por lo que necesita cada uno', () => {
  // Componente A: 10 disponibles, se gasta de a 2 por unidad → 5 unidades.
  // Componente B: 3 disponibles, se gasta de a 1 por unidad → 3 unidades.
  // La variante vale lo del componente más escaso: 3.
  const available = netAvailableForVariant({
    variant: {
      manage_inventory: true,
      allow_backorder: false,
      inventory_items: [
        { inventory_item_id: 'a', required_quantity: 2 },
        { inventory_item_id: 'b', required_quantity: 1 },
      ],
    },
    lineItemId: 'item_1',
    locationId: 'sloc_elordi',
    rawAvailableByItem: new Map([
      ['a', 10],
      ['b', 3],
    ]),
    reservations: [],
  });
  assert.equal(available, 3);
});

test('sin inventory_items enlazados: gestiona inventario pero no hay de dónde sacar nada → 0', () => {
  const available = netAvailableForVariant({
    variant: { manage_inventory: true, allow_backorder: false, inventory_items: [] },
    lineItemId: 'item_1',
    locationId: 'sloc_elordi',
    rawAvailableByItem: new Map(),
    reservations: [],
  });
  assert.equal(available, 0);
});

// ─── inventoryItemIdsOf ────────────────────────────────────────────────────────

test('junta y deduplica los inventory_item_id de varias variantes', () => {
  const ids = inventoryItemIdsOf([
    { manage_inventory: true, inventory_items: [{ inventory_item_id: 'a' }, { inventory_item_id: 'b' }] },
    { manage_inventory: true, inventory_items: [{ inventory_item_id: 'b' }] },
    { manage_inventory: false, inventory_items: null },
  ]);
  assert.deepEqual([...ids].sort(), ['a', 'b']);
});
