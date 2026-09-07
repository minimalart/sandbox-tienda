import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { ErpCatalogRow } from '../adapters/types.ts';
import {
  planPriceUpdate,
  roundAmount,
  type ExistingPrice,
  type PriceListTarget,
  type VariantCatalogEntry,
} from './plan-price-updates.ts';

/**
 * Los montos de los fixtures son los del catálogo real del cliente:
 * `010/50` vale 2526.12 en la lista 1 (retail) y 1768.28 en la 4 (mayorista,
 * = 2526.12 × 0.70). Los precios ya vienen con IVA incluido desde Zeus.
 */
const row = (over: Partial<ErpCatalogRow> = {}): ErpCatalogRow => ({
  code: '010/50',
  title: 'EQ ARTE - ACRILICO G2 010 PLATEADO X 50 CC',
  description: null,
  prices: { 0: null, 1: 2526.12, 2: 2526.12, 3: 2526.12, 4: 1768.28 },
  tax_rate: 21,
  published: true,
  active: true,
  category_code: '020B',
  brand: 'EQ ARTE',
  family: 'ARTISTICA ACRILICOS',
  barcode: null,
  weight: null,
  length: null,
  height: null,
  width: null,
  modified_at: '2026-07-24 10:00:00.000',
  ...over,
});

const entry = (over: Partial<VariantCatalogEntry> = {}): VariantCatalogEntry => ({
  sku: '010/50',
  variant_ids: ['variant_1'],
  price_set_id: 'pset_1',
  product_id: 'prod_1',
  ...over,
});

const MAYORISTA: PriceListTarget = { zeus_index: 4, price_list_id: 'plist_may', title: 'Mayorista' };

const plan = (over: Partial<Parameters<typeof planPriceUpdate>[0]> = {}) =>
  planPriceUpdate({
    row: row(),
    entry: entry(),
    currencyCode: 'ars',
    baseListIndex: 1,
    priceLists: [MAYORISTA],
    currentBase: null,
    currentByPriceList: new Map<string, ExistingPrice>(),
    onlyPublished: true,
    pricesIncludeTax: true,
    ...over,
  });

describe('planPriceUpdate — máquina de estados por artículo', () => {
  it('variante inexistente → variant_not_found sin writes', () => {
    const result = plan({ entry: undefined });
    assert.equal(result.status, 'variant_not_found');
    assert.deepEqual(result.writes, []);
  });

  it('SKU duplicado en Medusa → duplicate_sku sin writes', () => {
    const result = plan({ entry: entry({ variant_ids: ['v1', 'v2'] }) });
    assert.equal(result.status, 'duplicate_sku');
    assert.deepEqual(result.writes, []);
    assert.match(result.error ?? '', /repetido/i);
  });

  it('artículo inactivo o no publicable → not_published cuando only_published', () => {
    assert.equal(plan({ row: row({ active: false }) }).status, 'not_published');
    assert.equal(plan({ row: row({ published: false }) }).status, 'not_published');
    // Con el filtro apagado sí se procesa
    assert.equal(plan({ row: row({ published: false }), onlyPublished: false }).status, 'updated');
  });

  it('sin precio en la lista base → skipped(no_base_price)', () => {
    const result = plan({ row: row({ prices: { 1: null, 4: 1768.28 } }) });
    assert.equal(result.status, 'skipped');
    assert.equal(result.response_payload.reason, 'no_base_price');
    assert.deepEqual(result.writes, []);
  });

  it('precio negativo o no numérico → invalid_quantity', () => {
    assert.equal(plan({ row: row({ prices: { 1: -5 } }) }).status, 'invalid_quantity');
    assert.equal(
      plan({ row: row({ prices: { 1: Number.NaN as unknown as number } }) }).status,
      'invalid_quantity'
    );
  });

  it('variante sin price set → no_price_set (no hay dónde escribir)', () => {
    const result = plan({ entry: entry({ price_set_id: null }) });
    assert.equal(result.status, 'no_price_set');
    assert.deepEqual(result.writes, []);
    assert.match(result.error ?? '', /price set/i);
  });

  it('alta: escribe precio base y crea la fila de la price list', () => {
    const result = plan();
    assert.equal(result.status, 'updated');
    assert.deepEqual(result.writes, [
      { kind: 'base', price_set_id: 'pset_1', currency_code: 'ars', amount: 2526.12 },
      {
        kind: 'price_list_create',
        price_list_id: 'plist_may',
        variant_id: 'variant_1',
        currency_code: 'ars',
        amount: 1768.28,
      },
    ]);
    assert.equal(result.product_id, 'prod_1');
  });

  it('precio idéntico al actual → price_unchanged y CERO writes', () => {
    const result = plan({
      currentBase: { id: 'price_base', amount: 2526.12 },
      currentByPriceList: new Map([['plist_may', { id: 'price_may', amount: 1768.28 }]]),
    });
    assert.equal(result.status, 'price_unchanged');
    assert.deepEqual(result.writes, []);
  });

  it('tolera el ruido de coma flotante del bigNumber al comparar', () => {
    // `amount` vuelve como string/float; 2526.1200000001 no es un cambio real.
    const result = plan({
      currentBase: { id: 'price_base', amount: 2526.1200000001 },
      currentByPriceList: new Map([['plist_may', { id: 'price_may', amount: 1768.2799999998 }]]),
    });
    assert.equal(result.status, 'price_unchanged');
  });

  it('cambio solo en la price list → un único update por id de precio', () => {
    const result = plan({
      currentBase: { id: 'price_base', amount: 2526.12 },
      currentByPriceList: new Map([['plist_may', { id: 'price_may', amount: 1700 }]]),
    });
    assert.equal(result.status, 'updated');
    assert.deepEqual(result.writes, [
      { kind: 'price_list_update', price_list_id: 'plist_may', price_id: 'price_may', amount: 1768.28 },
    ]);
  });

  it('lista sin precio en el ERP → NO borra la fila existente, la deja registrada', () => {
    // Un 0 en Zeus significa "sin precio en esa lista". Borrar dejaría al
    // mayorista comprando al precio de lista sin querer.
    const result = plan({
      row: row({ prices: { 1: 2526.12, 4: null } }),
      currentBase: { id: 'price_base', amount: 2526.12 },
      currentByPriceList: new Map([['plist_may', { id: 'price_may', amount: 1700 }]]),
    });
    assert.equal(result.status, 'price_unchanged');
    assert.deepEqual(result.writes, []);
    const detail = (result.response_payload.price_lists as Array<Record<string, unknown>>)[0]!;
    assert.equal(detail.skipped, 'no_price_in_erp');
    assert.equal(detail.kept, 1700);
  });

  it('mayorista = base × 0.70, la relación real del catálogo', () => {
    const result = plan();
    const base = result.writes.find((w) => w.kind === 'base')!;
    const lista = result.writes.find((w) => w.kind === 'price_list_create')!;
    assert.equal(roundAmount(base.amount * 0.7), roundAmount(lista.amount));
  });

  it('varias price lists se resuelven en la misma pasada', () => {
    const result = plan({
      priceLists: [
        MAYORISTA,
        { zeus_index: 2, price_list_id: 'plist_dist', title: 'Distribuidor' },
      ],
      currentBase: { id: 'price_base', amount: 2526.12 },
    });
    assert.equal(result.status, 'updated');
    assert.equal(result.writes.length, 2);
    assert.deepEqual(
      result.writes.map((w) => (w.kind === 'price_list_create' ? w.price_list_id : w.kind)).sort(),
      ['plist_dist', 'plist_may']
    );
  });

  it('ERP que devuelve netos: se le suma la alícuota de la fila', () => {
    // Contrafáctico del contrato de Zeus (que ya entrega con IVA): con
    // pricesIncludeTax=false el planner aplica por_iva por artículo.
    const al21 = plan({ row: row({ prices: { 1: 1000 }, tax_rate: 21 }), pricesIncludeTax: false });
    assert.equal((al21.writes[0] as { amount: number }).amount, 1210);

    const al105 = plan({ row: row({ prices: { 1: 1000 }, tax_rate: 10.5 }), pricesIncludeTax: false });
    assert.equal((al105.writes[0] as { amount: number }).amount, 1105);
  });

  it('precios con IVA incluido se guardan tal cual, sin tocar', () => {
    const result = plan({ row: row({ prices: { 1: 2526.12 }, tax_rate: 10.5 }) });
    // La alícuota NO altera el monto: Zeus ya lo entrega final.
    assert.equal((result.writes[0] as { amount: number }).amount, 2526.12);
  });
});

describe('roundAmount', () => {
  it('redondea a 2 decimales', () => {
    assert.equal(roundAmount(2526.1249), 2526.12);
    assert.equal(roundAmount(2526.125), 2526.13);
    assert.equal(roundAmount(1768.2799999998), 1768.28);
  });
});
