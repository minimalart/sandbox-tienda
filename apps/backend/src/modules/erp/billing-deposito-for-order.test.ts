import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { lookupOrderBillingDeposito } from './billing-deposito-for-order.ts';
import type { ErpConfigSettings } from './types.ts';

/**
 * El puente que faltaba (DESDEELSUR-61).
 *
 * Los pedidos #70 y #71 entraron a Zeus el 15/09/2026 con depósito 1 aunque
 * decían "retiro en Melipal": el camino de `payment_captured` mandaba siempre
 * `billing_deposito: null` y el adapter caía a la única constante de la config.
 * Estos tests atan la derivación por orden que lo reemplaza.
 */
const ELFLEIN = 'sloc_01KZXSAMJHJ4X17SA5906BCTYC';
const MELIPAL = 'sloc_01KZXSPMF3MY5SQ8FB1EEC759J';

const settings: ErpConfigSettings = {
  sales_notify: { trigger: 'payment_captured', billing_deposito: null },
  stock_sync: {
    deposito_map: [
      { deposito: '1', stock_location_id: ELFLEIN },
      { deposito: '2', stock_location_id: MELIPAL },
    ],
  },
} as ErpConfigSettings;

/**
 * Container falso: sólo sirve `query`. `lookupOrderBillingDeposito` no resuelve
 * ningún otro registro a propósito — si alguien le agrega uno, este doble lo
 * delata en vez de dejarlo pasar.
 */
function fakeContainer(graph: (args: { entity: string; filters?: Record<string, unknown> }) => unknown) {
  return {
    resolve: (key: string) => {
      if (key !== 'query') throw new Error(`no esperaba resolve('${key}')`);
      return { graph: async (args: never) => graph(args) };
    },
  } as never;
}

/** Una orden con su sucursal, y la sucursal con su stock location. */
function stubGraph(opts: {
  order?: { metadata?: Record<string, unknown> | null; shipping_methods?: unknown[] } | null;
  stockLocationId?: string | null;
  storeLocationThrows?: boolean;
}) {
  return ({ entity }: { entity: string }) => {
    if (entity === 'order') {
      return { data: opts.order === null ? [] : [{ id: 'order_1', ...(opts.order ?? {}) }] };
    }
    if (entity === 'store_location') {
      if (opts.storeLocationThrows) throw new Error('extensión de sucursales no instalada');
      return { data: [{ stock_location_id: opts.stockLocationId ?? null }] };
    }
    throw new Error(`entidad inesperada: ${entity}`);
  };
}

const retiroEnMelipal = {
  metadata: { store_id: 'store_melipal' },
  shipping_methods: [{ data: { pickup_kind: 'store', store_id: 'store_melipal' } }],
};

describe('lookupOrderBillingDeposito', () => {
  it('deriva el depósito de la sucursal donde la persona retira', async () => {
    const lookup = await lookupOrderBillingDeposito(
      fakeContainer(stubGraph({ order: retiroEnMelipal, stockLocationId: MELIPAL })),
      { orderId: 'order_1', settings }
    );
    // Esto es lo que Camila no veía: Melipal factura 2, no 1.
    assert.equal(lookup?.deposito, '2');
    assert.equal(lookup?.source, 'store_pickup');
  });

  it('el envío a domicilio NO deriva: cae a la config, y eso está bien', async () => {
    const lookup = await lookupOrderBillingDeposito(
      fakeContainer(stubGraph({ order: { metadata: {}, shipping_methods: [{ data: {} }] } })),
      { orderId: 'order_1', settings }
    );
    assert.equal(lookup?.deposito, null);
    assert.equal(lookup?.source, null);
    assert.deepEqual(lookup?.derivation, { kind: 'skip', reason: 'not_store_pickup' });
  });

  it('el retiro en sucursal de un carrier tampoco deriva', async () => {
    // Andreani/Correo no son nuestras y no facturan nada; sin este filtro
    // derivaríamos un depósito inexistente.
    const lookup = await lookupOrderBillingDeposito(
      fakeContainer(
        stubGraph({
          order: {
            metadata: {},
            shipping_methods: [{ data: { pickup_kind: 'carrier', store_id: 'suc_andreani' } }],
          },
        })
      ),
      { orderId: 'order_1', settings }
    );
    assert.equal(lookup?.deposito, null);
    assert.deepEqual(lookup?.derivation, { kind: 'skip', reason: 'not_store_pickup' });
  });

  it('un override cargado a mano le gana a la derivación', async () => {
    const lookup = await lookupOrderBillingDeposito(
      fakeContainer(
        stubGraph({
          order: {
            metadata: { ...retiroEnMelipal.metadata, erp_billing_deposito: '1' },
            shipping_methods: retiroEnMelipal.shipping_methods,
          },
          stockLocationId: MELIPAL,
        })
      ),
      { orderId: 'order_1', settings }
    );
    assert.equal(lookup?.deposito, '1');
    assert.equal(lookup?.source, 'order_override');
  });

  it('una sucursal sin mapear cae a la config en vez de inventar un depósito', async () => {
    const lookup = await lookupOrderBillingDeposito(
      fakeContainer(
        stubGraph({ order: retiroEnMelipal, stockLocationId: 'sloc_sucursal_nueva' })
      ),
      { orderId: 'order_1', settings }
    );
    assert.equal(lookup?.deposito, null);
    assert.deepEqual(lookup?.derivation, { kind: 'skip', reason: 'not_mapped' });
    assert.equal(lookup?.storeId, 'store_melipal');
  });

  it('si la extensión de sucursales no está, no lanza: cae a la config', async () => {
    const lookup = await lookupOrderBillingDeposito(
      fakeContainer(stubGraph({ order: retiroEnMelipal, storeLocationThrows: true })),
      { orderId: 'order_1', settings }
    );
    assert.equal(lookup?.deposito, null);
    assert.deepEqual(lookup?.derivation, { kind: 'skip', reason: 'no_location' });
  });

  it('un store_id vacío es "no eligió", no un id', async () => {
    // El storefront LIMPIA el campo escribiendo '' al cambiar de modo de entrega.
    const lookup = await lookupOrderBillingDeposito(
      fakeContainer(
        stubGraph({
          order: { metadata: { store_id: '' }, shipping_methods: [{ data: { pickup_kind: 'store' } }] },
        })
      ),
      { orderId: 'order_1', settings }
    );
    assert.equal(lookup?.deposito, null);
    assert.deepEqual(lookup?.derivation, { kind: 'skip', reason: 'no_store' });
  });

  it('devuelve null si la orden no existe', async () => {
    const lookup = await lookupOrderBillingDeposito(
      fakeContainer(stubGraph({ order: null })),
      { orderId: 'order_fantasma', settings }
    );
    assert.equal(lookup, null);
  });

  it('sin deposito_map cargado no deriva nada y no rompe', async () => {
    const lookup = await lookupOrderBillingDeposito(
      fakeContainer(stubGraph({ order: retiroEnMelipal, stockLocationId: MELIPAL })),
      { orderId: 'order_1', settings: {} as ErpConfigSettings }
    );
    assert.equal(lookup?.deposito, null);
    assert.deepEqual(lookup?.derivation, { kind: 'skip', reason: 'not_mapped' });
  });
});
