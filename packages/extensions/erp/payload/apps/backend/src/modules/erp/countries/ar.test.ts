import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { argentinaLayer, isValidCuitCuil, isValidDni } from './ar.ts';

describe('isValidCuitCuil', () => {
  it('acepta CUITs con checksum válido', () => {
    // 20-12345678-6: dv = 11 - (148 % 11) = 6
    assert.equal(isValidCuitCuil('20123456786'), true);
    assert.equal(isValidCuitCuil('20-12345678-6'), true);
    // 20-00000000-1: dv = 11 - (10 % 11) = 1
    assert.equal(isValidCuitCuil('20000000001'), true);
  });

  it('rechaza checksum incorrecto, largo inválido y no numéricos', () => {
    assert.equal(isValidCuitCuil('20123456780'), false);
    assert.equal(isValidCuitCuil('2012345678'), false);
    assert.equal(isValidCuitCuil('201234567861'), false);
    assert.equal(isValidCuitCuil('abc'), false);
    assert.equal(isValidCuitCuil(''), false);
  });
});

describe('isValidDni', () => {
  it('acepta 7 u 8 dígitos', () => {
    assert.equal(isValidDni('1234567'), true);
    assert.equal(isValidDni('12345678'), true);
    assert.equal(isValidDni('12.345.678'), true);
  });

  it('rechaza otros largos', () => {
    assert.equal(isValidDni('123456'), false);
    assert.equal(isValidDni('123456789'), false);
    assert.equal(isValidDni(''), false);
  });
});

describe('argentinaLayer.inferDocument', () => {
  it('lee el billing_snapshot y normaliza el número', () => {
    const doc = argentinaLayer.inferDocument({
      metadata: {
        billing_snapshot: { document_type: 'cuit', document_number: '20-12345678-6' },
      },
    });
    assert.deepEqual(doc, { type: 'CUIT', number: '20123456786' });
  });

  it('documento inválido → consumidor final (null/null)', () => {
    const doc = argentinaLayer.inferDocument({
      metadata: {
        billing_snapshot: { document_type: 'CUIT', document_number: '20-12345678-0' },
      },
    });
    assert.deepEqual(doc, { type: null, number: null });
  });

  it('sin snapshot → null/null', () => {
    assert.deepEqual(argentinaLayer.inferDocument({ metadata: null }), { type: null, number: null });
    assert.deepEqual(argentinaLayer.inferDocument({ metadata: {} }), { type: null, number: null });
  });
});

describe('argentinaLayer — normalizaciones', () => {
  it('normalizePhone conserva el + internacional y limpia el resto', () => {
    assert.equal(argentinaLayer.normalizePhone('+54 9 (11) 5555-1234'), '+5491155551234');
    assert.equal(argentinaLayer.normalizePhone('11 5555 1234'), '1155551234');
    assert.equal(argentinaLayer.normalizePhone('   '), null);
    assert.equal(argentinaLayer.normalizePhone(null), null);
  });

  it('normalizePostalCode trimea y pasa a mayúsculas', () => {
    assert.equal(argentinaLayer.normalizePostalCode(' b1636 '), 'B1636');
    assert.equal(argentinaLayer.normalizePostalCode(''), null);
    assert.equal(argentinaLayer.normalizePostalCode(undefined), null);
  });
});
