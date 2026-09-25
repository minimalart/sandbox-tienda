import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  chosenStoreLocationId,
  depositoForStockLocation,
  deriveOrderBillingDeposito,
  isStorePickup,
  resolveBillingDeposito,
} from './billing-deposito.ts';
import type { ErpConfigSettings } from './types.ts';

/**
 * Depósito facturador derivado de la sucursal de retiro (DESDEELSUR-61).
 *
 * Las seis stock locations son las reales de desdeelsur; el mapeo deposito →
 * location es el que tiene la instalación en producción.
 */
const ELFLEIN = 'sloc_01KZXSAMJHJ4X17SA5906BCTYC';
const MELIPAL = 'sloc_01KZXSPMF3MY5SQ8FB1EEC759J';
const SIN_MAPEAR = 'sloc_de_una_sucursal_nueva';

const settings: ErpConfigSettings = {
  sales_notify: { trigger: 'fulfillment_created', billing_deposito: '1' },
  stock_sync: {
    deposito_map: [
      { deposito: '1', stock_location_id: ELFLEIN },
      { deposito: '2', stock_location_id: MELIPAL },
    ],
  },
} as ErpConfigSettings;

const retiroEnTienda = [{ data: { pickup_kind: 'store', store_id: 'store_melipal' } }];

describe('isStorePickup', () => {
  it('distingue nuestra sucursal de la sucursal de un carrier', () => {
    assert.equal(isStorePickup(retiroEnTienda), true);
    // Retiro en sucursal de Andreani/Correo: no es nuestra y no factura nada.
    assert.equal(isStorePickup([{ data: { pickup_kind: 'carrier' } }]), false);
    // Envío a domicilio: no trae pickup_kind.
    assert.equal(isStorePickup([{ data: {} }]), false);
    assert.equal(isStorePickup([]), false);
  });
});

describe('chosenStoreLocationId', () => {
  it('lee la sucursal de la metadata y, si no está, del shipping method', () => {
    assert.equal(chosenStoreLocationId({ store_id: 'store_a' }, []), 'store_a');
    assert.equal(chosenStoreLocationId({}, retiroEnTienda), 'store_melipal');
  });

  it('un store_id vacío significa "no eligió", no un id', () => {
    // El storefront LIMPIA el campo al cambiar de modo de entrega: escribe ''
    // en vez de borrarlo. Leerlo como id derivaría un depósito inexistente.
    assert.equal(chosenStoreLocationId({ store_id: '' }, []), null);
    assert.equal(chosenStoreLocationId({ store_id: '   ' }, []), null);
  });
});

describe('depositoForStockLocation', () => {
  it('traduce la stock location al depósito del ERP', () => {
    assert.equal(depositoForStockLocation(settings, ELFLEIN), '1');
    assert.equal(depositoForStockLocation(settings, MELIPAL), '2');
  });

  it('una location sin mapear no inventa depósito', () => {
    assert.equal(depositoForStockLocation(settings, SIN_MAPEAR), null);
    assert.equal(depositoForStockLocation(settings, null), null);
  });
});

describe('deriveOrderBillingDeposito', () => {
  it('retiro en MELIPAL factura desde MELIPAL, no desde el depósito de la config', () => {
    // El corazón del cambio: la config dice 1 (ELFLEIN) y la orden gana con 2.
    const decision = deriveOrderBillingDeposito({
      settings,
      orderMetadata: { store_id: 'store_melipal' },
      shippingMethods: retiroEnTienda,
      storeStockLocationId: MELIPAL,
    });

    assert.deepEqual(decision, { kind: 'derived', deposito: '2' });
  });

  it('lo derivado le gana a la config cuando lo lee resolveBillingDeposito', () => {
    // La prueba de que sirve de algo: sellar la orden cambia lo que factura.
    const sinSellar = resolveBillingDeposito(settings, {});
    assert.equal(sinSellar.ok && sinSellar.deposito, '1');

    const sellada = resolveBillingDeposito(settings, { erp_billing_deposito: '2' });
    assert.equal(sellada.ok && sellada.deposito, '2');
    assert.equal(sellada.ok && sellada.stock_location_id, MELIPAL);
    assert.equal(sellada.ok && sellada.source, 'order');
  });

  it('un override puesto a mano no se pisa', () => {
    const decision = deriveOrderBillingDeposito({
      settings,
      orderMetadata: { store_id: 'store_melipal', erp_billing_deposito: '1' },
      shippingMethods: retiroEnTienda,
      storeStockLocationId: MELIPAL,
    });

    assert.deepEqual(decision, { kind: 'skip', reason: 'already_set' });
  });

  it('envío a domicilio no deriva nada: el comprador no eligió sucursal', () => {
    const decision = deriveOrderBillingDeposito({
      settings,
      orderMetadata: { shipping_method: 'domicilio' },
      shippingMethods: [{ data: {} }],
      storeStockLocationId: null,
    });

    assert.deepEqual(decision, { kind: 'skip', reason: 'not_store_pickup' });
  });

  it('retiro en sucursal de un carrier tampoco deriva', () => {
    const decision = deriveOrderBillingDeposito({
      settings,
      orderMetadata: { store_id: 'branch_correo' },
      shippingMethods: [{ data: { pickup_kind: 'carrier', store_id: 'branch_correo' } }],
      storeStockLocationId: null,
    });

    assert.deepEqual(decision, { kind: 'skip', reason: 'not_store_pickup' });
  });

  it('sucursal todavía sin stock location: no deriva, no rompe', () => {
    const decision = deriveOrderBillingDeposito({
      settings,
      orderMetadata: { store_id: 'store_nueva' },
      shippingMethods: retiroEnTienda,
      storeStockLocationId: null,
    });

    assert.deepEqual(decision, { kind: 'skip', reason: 'no_location' });
  });

  it('sucursal con location que nadie mapeó a un depósito', () => {
    const decision = deriveOrderBillingDeposito({
      settings,
      orderMetadata: { store_id: 'store_nueva' },
      shippingMethods: retiroEnTienda,
      storeStockLocationId: SIN_MAPEAR,
    });

    assert.deepEqual(decision, { kind: 'skip', reason: 'not_mapped' });
  });
});
