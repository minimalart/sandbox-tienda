import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  activeDepositoMappings,
  findDepositoMapping,
  readBillingConfirmation,
  readOrderBillingDeposito,
  resolveBillingDeposito,
  resolveSalesTrigger,
} from './billing-deposito.ts';
import type { ErpConfigSettings } from './types.ts';

const settings: ErpConfigSettings = {
  stock_sync: {
    deposito_map: [
      { deposito: '1', stock_location_id: 'sloc_a' },
      { deposito: '2', stock_location_id: 'sloc_b' },
      { deposito: '9', stock_location_id: 'sloc_off', enabled: false },
    ],
  },
  sales_notify: { trigger: 'fulfillment_created', billing_deposito: '1' },
};

describe('resolveSalesTrigger', () => {
  it('cae a payment_captured sin config: no cambia lo ya instalado', () => {
    assert.equal(resolveSalesTrigger(null), 'payment_captured');
    assert.equal(resolveSalesTrigger({}), 'payment_captured');
    assert.equal(resolveSalesTrigger({ sales_notify: {} }), 'payment_captured');
  });

  it('respeta el trigger guardado', () => {
    assert.equal(resolveSalesTrigger(settings), 'fulfillment_created');
  });
});

describe('activeDepositoMappings', () => {
  it('descarta las filas apagadas y las incompletas', () => {
    const rows = activeDepositoMappings({
      stock_sync: {
        deposito_map: [
          { deposito: '1', stock_location_id: 'sloc_a' },
          { deposito: '9', stock_location_id: 'sloc_off', enabled: false },
          { deposito: '', stock_location_id: 'sloc_c' },
          { deposito: '3', stock_location_id: '' },
        ],
      },
    });
    assert.deepEqual(
      rows.map((row) => row.deposito),
      ['1']
    );
  });

  it('no encuentra un depósito apagado', () => {
    assert.equal(findDepositoMapping(settings, '9'), null);
  });
});

describe('resolveBillingDeposito', () => {
  it('usa el default de la config', () => {
    const result = resolveBillingDeposito(settings, null);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.deposito, '1');
    assert.equal(result.stock_location_id, 'sloc_a');
    assert.equal(result.source, 'config');
  });

  it('el override de la orden le gana al default', () => {
    const result = resolveBillingDeposito(settings, { erp_billing_deposito: '2' });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.deposito, '2');
    assert.equal(result.stock_location_id, 'sloc_b');
    assert.equal(result.source, 'order');
  });

  it('sin depósito elegido informa not_configured (no adivina uno)', () => {
    // Adivinar acá emitiría el comprobante desde un depósito que nadie eligió.
    const result = resolveBillingDeposito({ stock_sync: settings.stock_sync }, null);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, 'not_configured');
  });

  it('un depósito sin mapeo informa not_mapped, con el código', () => {
    const result = resolveBillingDeposito(settings, { erp_billing_deposito: '7' });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, 'not_mapped');
    assert.equal(result.deposito, '7');
  });

  it('ignora un override que no es string usable', () => {
    assert.equal(readOrderBillingDeposito({ erp_billing_deposito: 42 }), null);
    assert.equal(readOrderBillingDeposito({ erp_billing_deposito: '' }), null);
    assert.equal(readOrderBillingDeposito(null), null);
  });
});

describe('readBillingConfirmation', () => {
  it('lee una marca completa', () => {
    const confirmation = readBillingConfirmation({
      erp_billing: {
        deposito: '1',
        stock_location_id: 'sloc_a',
        confirmed_at: '2026-08-20T10:00:00.000Z',
        confirmed_by: 'usr_1',
      },
    });
    assert.equal(confirmation?.deposito, '1');
    assert.equal(confirmation?.confirmed_by, 'usr_1');
  });

  it('rechaza marcas incompletas o basura: sin marca válida NO se factura', () => {
    // Es el filtro que separa un fulfillment humano de uno creado por el
    // auto-fulfill de un carrier. Si esto pasara de largo, se facturaría a los
    // segundos del checkout desde un depósito arbitrario.
    assert.equal(readBillingConfirmation(null), null);
    assert.equal(readBillingConfirmation({}), null);
    assert.equal(readBillingConfirmation({ erp_billing: 'sí' }), null);
    assert.equal(readBillingConfirmation({ erp_billing: [] }), null);
    assert.equal(readBillingConfirmation({ erp_billing: { deposito: '1' } }), null);
    assert.equal(
      readBillingConfirmation({ erp_billing: { deposito: '1', stock_location_id: 'sloc_a' } }),
      null
    );
  });
});
