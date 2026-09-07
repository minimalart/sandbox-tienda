import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mergeErpSettings } from './settings-merge.ts';

describe('mergeErpSettings', () => {
  const existing = {
    stock_location_id: 'sloc_1',
    catalog_sync: {
      currency_code: 'ars',
      last_synced_at: '2026-07-27 10:00:00',
      category_map: { '020B': 'pcat_1' },
      price_lists: [{ zeus_index: 4, title: 'Mayorista' }],
    },
    zeus: { sucursal: 1, deposito_id: 2 },
  };

  it('preserva el watermark y el mapa cuando el admin guarda sin ellos', () => {
    // Esto es exactamente lo que manda `buildCatalogSyncSettings()` del admin.
    const merged = mergeErpSettings(existing, {
      catalog_sync: { currency_code: 'usd', base_list_index: 1 },
    });
    const catalog = merged.catalog_sync as Record<string, unknown>;

    assert.equal(catalog.last_synced_at, '2026-07-27 10:00:00');
    assert.deepEqual(catalog.category_map, { '020B': 'pcat_1' });
    assert.equal(catalog.currency_code, 'usd');
    assert.equal(catalog.base_list_index, 1);
  });

  it('guardar sólo el trigger conserva el depósito facturador', () => {
    // La UI reconstruye el bloque `sales_notify` entero. Sin `sales_notify` en
    // NESTED_KEYS, cambiar el trigger borraría el depósito facturador, y el gate
    // pasaría a rechazar TODOS los despachos con un 400 que no explica nada.
    const merged = mergeErpSettings(
      { ...existing, sales_notify: { trigger: 'fulfillment_created', billing_deposito: '1' } },
      { sales_notify: { trigger: 'payment_captured' } }
    );
    const salesNotify = merged.sales_notify as Record<string, unknown>;

    assert.equal(salesNotify.trigger, 'payment_captured');
    assert.equal(salesNotify.billing_deposito, '1');
  });

  it('un null explícito limpia el depósito facturador', () => {
    // Es lo que manda la UI cuando el select queda vacío: "borrar", no "no tocar".
    const merged = mergeErpSettings(
      { sales_notify: { trigger: 'fulfillment_created', billing_deposito: '1' } },
      { sales_notify: { billing_deposito: null } }
    );
    const salesNotify = merged.sales_notify as Record<string, unknown>;

    assert.equal(salesNotify.billing_deposito, null);
    assert.equal(salesNotify.trigger, 'fulfillment_created');
  });

  it('reemplaza los arrays enteros (hay que poder borrar una price list)', () => {
    const merged = mergeErpSettings(existing, { catalog_sync: { price_lists: [] } });
    assert.deepEqual((merged.catalog_sync as Record<string, unknown>).price_lists, []);
  });

  it('un null explícito pisa el valor guardado', () => {
    const merged = mergeErpSettings(existing, { catalog_sync: { last_synced_at: null } });
    assert.equal((merged.catalog_sync as Record<string, unknown>).last_synced_at, null);
  });

  it('una sección en null pisa la sección completa', () => {
    const merged = mergeErpSettings(existing, { zeus: null });
    assert.equal(merged.zeus, null);
  });

  it('no toca las secciones que el patch no menciona', () => {
    const merged = mergeErpSettings(existing, { catalog_sync: { currency_code: 'usd' } });
    assert.deepEqual(merged.zeus, { sucursal: 1, deposito_id: 2 });
    assert.equal(merged.stock_location_id, 'sloc_1');
  });

  it('preserva el flag de backfill que escribe el motor', () => {
    const withFlag = {
      catalog_sync: { categories_sync: true, categories_backfill_pending: true },
    };
    const merged = mergeErpSettings(withFlag, { catalog_sync: { categories_sync: true } });
    assert.equal((merged.catalog_sync as Record<string, unknown>).categories_backfill_pending, true);
  });

  it('sin settings previos devuelve el patch tal cual', () => {
    const merged = mergeErpSettings(null, { catalog_sync: { currency_code: 'ars' } });
    assert.deepEqual(merged, { catalog_sync: { currency_code: 'ars' } });
  });

  it('agrega claves de primer nivel desconocidas sin perder las viejas', () => {
    const merged = mergeErpSettings(existing, { nuevo_bloque: { a: 1 } });
    assert.deepEqual(merged.nuevo_bloque, { a: 1 });
    assert.equal((merged.catalog_sync as Record<string, unknown>).last_synced_at, '2026-07-27 10:00:00');
  });
});

describe('mergeErpSettings — catalog_sync.images', () => {
  /**
   * El caso real: la UI del admin reconstruye `images` con `enabled` y nunca
   * manda `failures`. Con el merge de un solo nivel, cada guardado de la config
   * borraba el registro de artículos rotos y el backfill volvía a trabarse.
   */
  it('un guardado del admin no borra el registro de fallos', () => {
    const merged = mergeErpSettings(
      {
        catalog_sync: {
          images: {
            enabled: true,
            failures: { '114': { count: 3, last_failed_at: '2026-08-25T12:00:00.000Z' } },
          },
        },
      },
      { catalog_sync: { images: { enabled: true } } }
    );

    const images = (merged.catalog_sync as Record<string, unknown>).images as Record<
      string,
      unknown
    >;
    assert.deepEqual(images.failures, {
      '114': { count: 3, last_failed_at: '2026-08-25T12:00:00.000Z' },
    });
    assert.equal(images.enabled, true);
  });

  it('tampoco borra el umbral de resolución', () => {
    const merged = mergeErpSettings(
      { catalog_sync: { images: { enabled: true, min_dimension_px: 800 } } },
      { catalog_sync: { images: { enabled: false } } }
    );

    const images = (merged.catalog_sync as Record<string, unknown>).images as Record<
      string,
      unknown
    >;
    assert.equal(images.min_dimension_px, 800);
    assert.equal(images.enabled, false);
  });

  /** Lo que SÍ manda la UI tiene que pisar: si no, no se podría cambiar nada. */
  it('las claves que vienen en el patch pisan', () => {
    const merged = mergeErpSettings(
      { catalog_sync: { images: { enabled: false, min_dimension_px: 500 } } },
      { catalog_sync: { images: { enabled: true, min_dimension_px: 0 } } }
    );

    const images = (merged.catalog_sync as Record<string, unknown>).images as Record<
      string,
      unknown
    >;
    assert.equal(images.enabled, true);
    assert.equal(images.min_dimension_px, 0);
  });

  /** Un `null` explícito sigue significando "limpiar la sub-sección entera". */
  it('un null explícito pisa el objeto completo', () => {
    const merged = mergeErpSettings(
      { catalog_sync: { images: { enabled: true, failures: { '114': { count: 3 } } } } },
      { catalog_sync: { images: null } }
    );

    assert.equal((merged.catalog_sync as Record<string, unknown>).images, null);
  });

  /** El resto de `catalog_sync` no cambia de comportamiento. */
  it('no altera el merge del resto de la sección', () => {
    const merged = mergeErpSettings(
      { catalog_sync: { currency_code: 'ars', last_synced_at: '2026-08-25' } },
      { catalog_sync: { currency_code: 'usd' } }
    );

    assert.deepEqual(merged.catalog_sync, {
      currency_code: 'usd',
      last_synced_at: '2026-08-25',
    });
  });
});
