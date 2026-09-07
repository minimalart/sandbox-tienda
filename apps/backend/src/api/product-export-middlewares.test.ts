import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recoverFiltersFromReferer } from './product-export-middlewares';

/**
 * El drawer de export del admin lee los filtros con el prefijo equivocado y los
 * pierde (bug upstream, ver product-export-middlewares.ts). Los recuperamos del
 * `Referer`, así que este test fija el contrato de ese parseo con URLs reales
 * del dashboard.
 */

const BASE = 'https://mercatto-backend.minimalart.studio/app/products/export';

test('recupera el filtro de canal de venta del listado', () => {
  const filters = recoverFiltersFromReferer(
    `${BASE}?sales_channel_id=sc_01KYBDZ85NFZK0F66T1G6ZBAHC`
  );

  assert.deepEqual(filters, {
    sales_channel_id: ['sc_01KYBDZ85NFZK0F66T1G6ZBAHC'],
  });
});

test('separa las listas por coma y acepta varios filtros a la vez', () => {
  const filters = recoverFiltersFromReferer(
    `${BASE}?sales_channel_id=sc_1,sc_2&status=published,draft&q=lija`
  );

  assert.deepEqual(filters, {
    sales_channel_id: ['sc_1', 'sc_2'],
    status: ['published', 'draft'],
    q: 'lija',
  });
});

test('acepta las claves con el prefijo p_ por si upstream alinea el drawer', () => {
  const filters = recoverFiltersFromReferer(`${BASE}?p_collection_id=pcol_1`);

  assert.deepEqual(filters, { collection_id: ['pcol_1'] });
});

test('parsea los filtros de fecha, que vienen como JSON', () => {
  const filters = recoverFiltersFromReferer(
    `${BASE}?created_at=${encodeURIComponent('{"$gte":"2026-07-01"}')}`
  );

  assert.deepEqual(filters, { created_at: { $gte: '2026-07-01' } });
});

test('ignora una fecha ilegible en vez de romper el export', () => {
  const filters = recoverFiltersFromReferer(`${BASE}?created_at=nada&status=published`);

  assert.deepEqual(filters, { status: ['published'] });
});

test('ignora valores vacíos', () => {
  assert.deepEqual(recoverFiltersFromReferer(`${BASE}?sales_channel_id=&q=`), {});
});

test('no toca nada si el referer no es el listado de productos', () => {
  assert.deepEqual(
    recoverFiltersFromReferer(
      'https://mercatto-backend.minimalart.studio/app/orders?sales_channel_id=sc_1'
    ),
    {}
  );
});

test('tolera referer ausente o ilegible', () => {
  assert.deepEqual(recoverFiltersFromReferer(undefined), {});
  assert.deepEqual(recoverFiltersFromReferer('no-es-una-url'), {});
});
