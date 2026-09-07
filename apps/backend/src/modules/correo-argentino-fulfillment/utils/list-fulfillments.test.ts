/**
 * Con dos carriers en el mismo sistema, el riesgo nuevo es que cada listado se
 * lleve los envíos del otro: el admin de Andreani mostrando envíos de Correo, o
 * la descarga masiva de Correo pidiéndole rótulos por trackings de Andreani.
 *
 * Acá se pinea el lado de CORREO. El lado de Andreani vive en
 * `modules/andreani-fulfillment/utils/list-fulfillments.test.ts`: la cobertura
 * de una función viaja con la extensión que la posee, y un import cruzado no
 * compila en un proyecto que seleccione Correo sin Andreani (combo válido del
 * catálogo). Los envíos ajenos se expresan con literales, sin importar nada del
 * otro módulo.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyCorreoFilters,
  isCorreoFulfillment,
  normalizeCorreoFulfillment,
  type CorreoFulfillmentRecord,
} from './list-fulfillments.ts';

const correoByProvider: CorreoFulfillmentRecord = {
  id: 'ful_1',
  provider_id: 'correo_argentino_correo_argentino',
  data: { carrier: 'correo-argentino', delivery_type: 'homeDelivery' },
};

const correoByCarrier: CorreoFulfillmentRecord = {
  id: 'ful_2',
  provider_id: 'manual_manual',
  data: { carrier: 'correo-argentino', tracking_number: 'CA123' },
};

const andreani: CorreoFulfillmentRecord = {
  id: 'ful_3',
  provider_id: 'andreani_andreani',
  data: { tracking_number: 'AN999', service_type: 'Domicilio' },
};

describe('isCorreoFulfillment', () => {
  it('reconoce por provider_id y por data.carrier', () => {
    assert.equal(isCorreoFulfillment(correoByProvider), true);
    assert.equal(isCorreoFulfillment(correoByCarrier), true);
  });

  it('NO se lleva los de Andreani', () => {
    assert.equal(isCorreoFulfillment(andreani), false);
  });

  // La detección es estricta a propósito: Andreani acepta "cualquier
  // fulfillment con tracking_number", y copiar ese criterio acá haría que cada
  // helper se robara los envíos del otro.
  it('un tracking_number suelto NO alcanza para ser de Correo', () => {
    assert.equal(
      isCorreoFulfillment({ id: 'x', data: { tracking_number: 'ZZZ' } }),
      false,
    );
  });
});

describe('normalizeCorreoFulfillment', () => {
  it('tracking_number null (envío sin ticket) se normaliza a string vacío', () => {
    const normalized = normalizeCorreoFulfillment({
      id: 'ful_1',
      data: { tracking_number: null, carrier: 'correo-argentino' },
    });
    assert.equal(normalized.tracking_number, '');
  });

  it('prefija el display_id con # y tolera la orden ausente', () => {
    assert.equal(
      normalizeCorreoFulfillment({ id: 'f', order: { id: 'o', display_id: 42 } })
        .order_display_id,
      '#42',
    );
    assert.equal(normalizeCorreoFulfillment({ id: 'f' }).order_display_id, null);
  });
});

describe('applyCorreoFilters', () => {
  const items = [
    normalizeCorreoFulfillment({
      id: 'a',
      status: 'shipped',
      created_at: '2026-08-01T10:00:00.000Z',
      order: { id: 'order_1', display_id: 10 },
      data: { tracking_number: 'CA001', agency_id: 'DFB' },
    }),
    normalizeCorreoFulfillment({
      id: 'b',
      status: 'pending',
      created_at: '2026-08-05T10:00:00.000Z',
      order: { id: 'order_2', display_id: 11 },
      data: { tracking_number: null },
    }),
  ];

  it('ticketed_only deja solo los que ya tienen envío en Correo', () => {
    const result = applyCorreoFilters(items, { ticketed_only: true });
    assert.deepEqual(
      result.map((f) => f.id),
      ['a'],
    );
  });

  it('search matchea tracking, sucursal y display_id', () => {
    for (const search of ['CA001', 'dfb', '#10']) {
      assert.deepEqual(
        applyCorreoFilters(items, { search }).map((f) => f.id),
        ['a'],
        search,
      );
    }
  });

  it('el rango de fechas incluye los bordes del día', () => {
    assert.deepEqual(
      applyCorreoFilters(items, { date_from: '2026-08-05' }).map((f) => f.id),
      ['b'],
    );
    assert.deepEqual(
      applyCorreoFilters(items, { date_to: '2026-08-01' }).map((f) => f.id),
      ['a'],
    );
  });

  it('sin filtros no descarta nada', () => {
    assert.equal(applyCorreoFilters(items, {}).length, 2);
  });
});
