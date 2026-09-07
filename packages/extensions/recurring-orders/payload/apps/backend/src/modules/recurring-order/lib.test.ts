import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addInterval, buildConfirmationUrl, frequencyLabel } from './lib.ts';

describe('addInterval — aritmética de frecuencias', () => {
  it('suma días y semanas de forma exacta', () => {
    const from = new Date('2026-03-10T12:00:00Z');
    assert.equal(
      addInterval(from, 'day', 3).toISOString(),
      '2026-03-13T12:00:00.000Z',
    );
    assert.equal(
      addInterval(from, 'week', 2).toISOString(),
      '2026-03-24T12:00:00.000Z',
    );
  });

  it('suma meses por calendario conservando el día', () => {
    const from = new Date('2026-03-15T09:30:00Z');
    const next = addInterval(from, 'month', 1);
    assert.equal(next.toISOString(), '2026-04-15T09:30:00.000Z');
  });

  it('clampa al fin de mes en meses más cortos (31/01 + 1 mes = 28/02)', () => {
    const from = new Date('2026-01-31T10:00:00Z');
    assert.equal(
      addInterval(from, 'month', 1).toISOString(),
      '2026-02-28T10:00:00.000Z',
    );
    // Año bisiesto: 31/01/2028 + 1 mes = 29/02/2028.
    assert.equal(
      addInterval(new Date('2028-01-31T10:00:00Z'), 'month', 1).toISOString(),
      '2028-02-29T10:00:00.000Z',
    );
    // 31/10 + 1 mes = 30/11 (noviembre tiene 30).
    assert.equal(
      addInterval(new Date('2026-10-31T10:00:00Z'), 'month', 1).toISOString(),
      '2026-11-30T10:00:00.000Z',
    );
  });

  it('multi-mes cruzando fin de año', () => {
    const from = new Date('2026-11-30T00:00:00Z');
    assert.equal(
      addInterval(from, 'month', 3).toISOString(),
      '2027-02-28T00:00:00.000Z',
    );
  });

  it('normaliza counts inválidos a 1', () => {
    const from = new Date('2026-03-10T00:00:00Z');
    assert.equal(
      addInterval(from, 'day', 0).toISOString(),
      addInterval(from, 'day', 1).toISOString(),
    );
    assert.equal(
      addInterval(from, 'week', Number.NaN).toISOString(),
      addInterval(from, 'week', 1).toISOString(),
    );
  });
});

describe('frequencyLabel', () => {
  it('singular y plural en castellano', () => {
    assert.equal(frequencyLabel('day', 1), 'todos los días');
    assert.equal(frequencyLabel('week', 2), 'cada 2 semanas');
    assert.equal(frequencyLabel('month', 1), 'todos los meses');
    assert.equal(frequencyLabel('month', 3), 'cada 3 meses');
  });
});

describe('buildConfirmationUrl', () => {
  it('arma el path del storefront con cart y ciclo escapados', () => {
    const url = buildConfirmationUrl('cart_123', 'rcyc_9', 'AR');
    assert.ok(url.includes('/ar/subscriptions/renew?'));
    assert.ok(url.includes('cart_id=cart_123'));
    assert.ok(url.includes('cycle_id=rcyc_9'));
  });
});
