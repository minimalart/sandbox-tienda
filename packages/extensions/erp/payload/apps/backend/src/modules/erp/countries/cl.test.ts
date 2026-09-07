import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { chileLayer, cleanRut, computeRutDv, formatRut, isValidRut } from './cl.ts';

describe('computeRutDv — módulo 11', () => {
  it('calcula dígitos conocidos', () => {
    // 12345678: suma ponderada 138 → 138 % 11 = 6 → dv 5
    assert.equal(computeRutDv('12345678'), '5');
    // 30686957: suma 194 → mod 7 → dv 4
    assert.equal(computeRutDv('30686957'), '4');
    // 1000005: suma 12 → mod 1 → 11-1=10 → K
    assert.equal(computeRutDv('1000005'), 'K');
    // 14: suma 11 → mod 0 → 11-0=11 → dv 0
    assert.equal(computeRutDv('14'), '0');
  });
});

describe('isValidRut', () => {
  it('acepta RUTs válidos en cualquier formato', () => {
    assert.equal(isValidRut('12.345.678-5'), true);
    assert.equal(isValidRut('12345678-5'), true);
    assert.equal(isValidRut('123456785'), true);
    assert.equal(isValidRut('30.686.957-4'), true);
    assert.equal(isValidRut('1.000.005-K'), true);
    assert.equal(isValidRut('1000005-k'), true);
  });

  it('rechaza checksum incorrecto, cuerpos fuera de rango y basura', () => {
    assert.equal(isValidRut('12.345.678-9'), false);
    assert.equal(isValidRut('12345-6'), false); // cuerpo de 5 dígitos
    assert.equal(isValidRut('1234567890-1'), false); // 10 dígitos
    assert.equal(isValidRut('abc'), false);
    assert.equal(isValidRut(''), false);
    assert.equal(isValidRut('12.345.678-'), false);
  });
});

describe('formatRut', () => {
  it('normaliza al canónico sin puntos con K mayúscula', () => {
    assert.equal(formatRut('12.345.678-5'), '12345678-5');
    assert.equal(formatRut('1000005-k'), '1000005-K');
    assert.equal(formatRut('12.345.678-9'), null);
  });
});

describe('cleanRut', () => {
  it('separa cuerpo y dv', () => {
    assert.deepEqual(cleanRut('12.345.678-5'), { body: '12345678', dv: '5' });
    assert.deepEqual(cleanRut('1000005k'), { body: '1000005', dv: 'K' });
    assert.equal(cleanRut('x'), null);
    assert.equal(cleanRut('12a45678-5'), null);
  });
});

describe('chileLayer.inferDocument', () => {
  it('lee billing_snapshot con tipo RUT', () => {
    const doc = chileLayer.inferDocument({
      metadata: {
        billing_snapshot: { document_type: 'rut', document_number: '12.345.678-5' },
      },
    });
    assert.deepEqual(doc, { type: 'RUT', number: '12345678-5' });
  });

  it('cae a metadata.rut y metadata.billing_address.rut (patrón aec)', () => {
    assert.deepEqual(chileLayer.inferDocument({ metadata: { rut: '30.686.957-4' } }), {
      type: 'RUT',
      number: '30686957-4',
    });
    assert.deepEqual(
      chileLayer.inferDocument({ metadata: { billing_address: { rut: '1.000.005-K' } } }),
      { type: 'RUT', number: '1000005-K' }
    );
  });

  it('RUT inválido o ausente → consumidor final (null/null)', () => {
    assert.deepEqual(chileLayer.inferDocument({ metadata: { rut: '12.345.678-9' } }), {
      type: null,
      number: null,
    });
    assert.deepEqual(chileLayer.inferDocument({ metadata: {} }), { type: null, number: null });
    assert.deepEqual(chileLayer.inferDocument({ metadata: null }), { type: null, number: null });
  });

  it('un snapshot CUIT (tienda AR) no se toma como RUT', () => {
    const doc = chileLayer.inferDocument({
      metadata: {
        billing_snapshot: { document_type: 'CUIT', document_number: '20123456786' },
      },
    });
    assert.deepEqual(doc, { type: null, number: null });
  });
});

describe('chileLayer — normalizaciones y contrato', () => {
  it('normalizePhone conserva + internacional', () => {
    assert.equal(chileLayer.normalizePhone('+56 9 8765 4321'), '+56987654321');
    assert.equal(chileLayer.normalizePhone(null), null);
  });

  it('validateDocument solo acepta RUT', () => {
    assert.equal(chileLayer.validateDocument('RUT', '12345678-5'), true);
    assert.equal(chileLayer.validateDocument('CUIT', '20123456786'), false);
  });

  it('moneda y código', () => {
    assert.equal(chileLayer.code, 'CL');
    assert.equal(chileLayer.currency, 'CLP');
  });
});
