/**
 * El auto-fulfillment tiene una asimetría de costos brutal: un falso NEGATIVO
 * cuesta que el admin cree el fulfillment a mano; un falso POSITIVO dispara
 * `createOrderFulfillmentWorkflow` sobre una orden de OTRO carrier, y en Andreani
 * eso genera el envío real con su flete. Por eso la detección es estricta y por
 * eso está pineada acá.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isCorreoAutoFulfillEnabled,
  isCorreoAutoFulfillOrder,
} from './correo-order.ts';

describe('isCorreoAutoFulfillEnabled', () => {
  it('solo el string "true" habilita (default: apagado)', () => {
    assert.equal(isCorreoAutoFulfillEnabled({}), false);
    assert.equal(
      isCorreoAutoFulfillEnabled({ CORREO_ARGENTINO_AUTO_FULFILL: 'false' }),
      false,
    );
    assert.equal(
      isCorreoAutoFulfillEnabled({ CORREO_ARGENTINO_AUTO_FULFILL: '1' }),
      false,
    );
    assert.equal(
      isCorreoAutoFulfillEnabled({ CORREO_ARGENTINO_AUTO_FULFILL: 'true' }),
      true,
    );
    assert.equal(
      isCorreoAutoFulfillEnabled({ CORREO_ARGENTINO_AUTO_FULFILL: ' TRUE ' }),
      true,
    );
  });
});

describe('isCorreoAutoFulfillOrder', () => {
  it('matchea el `carrier` que estampa el provider, en cualquier separador', () => {
    for (const carrier of ['correo-argentino', 'correo_argentino', 'correo']) {
      assert.equal(
        isCorreoAutoFulfillOrder([{ data: { carrier } }]),
        true,
        carrier,
      );
    }
  });

  it('encuentra el método de Correo entre varios', () => {
    assert.equal(
      isCorreoAutoFulfillOrder([
        { data: { carrier: 'andreani' } },
        { data: { carrier: 'correo-argentino' } },
      ]),
      true,
    );
  });

  // ⚠️ Lo importante: NADA salvo el `carrier` explícito habilita el auto-fulfill.
  it('no alcanza el nombre, ni la fulfillment option, ni el service_type', () => {
    for (const method of [
      { name: 'Retiro en sucursal de Correo Argentino', data: {} },
      { data: { id: 'correo-domicilio' } },
      { data: { service_type: 'CP' } },
      { data: { provider: 'correo_argentino' } },
      { data: { carrier: 'andreani' } },
      { data: {} },
      {},
    ]) {
      assert.equal(
        isCorreoAutoFulfillOrder([method]),
        false,
        JSON.stringify(method),
      );
    }
  });

  it('sin métodos de envío → false (no rompe)', () => {
    assert.equal(isCorreoAutoFulfillOrder([]), false);
    assert.equal(isCorreoAutoFulfillOrder(undefined), false);
    assert.equal(isCorreoAutoFulfillOrder(null), false);
  });
});
