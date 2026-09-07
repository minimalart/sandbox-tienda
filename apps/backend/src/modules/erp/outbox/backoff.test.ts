import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeNextRetry } from './backoff.ts';
import { DEFAULT_INVOICE_FETCH_SETTINGS, DEFAULT_OUTBOX_SETTINGS } from '../types.ts';

const NOW = 1_750_000_000_000;
const noJitter = () => 0;

describe('computeNextRetry', () => {
  it('progresión exponencial con los defaults (60s base)', () => {
    assert.equal(computeNextRetry(1, null, NOW, noJitter)!.getTime(), NOW + 60_000);
    assert.equal(computeNextRetry(2, null, NOW, noJitter)!.getTime(), NOW + 120_000);
    assert.equal(computeNextRetry(3, null, NOW, noJitter)!.getTime(), NOW + 240_000);
    assert.equal(computeNextRetry(4, null, NOW, noJitter)!.getTime(), NOW + 480_000);
  });

  it('respeta el tope max_delay_s', () => {
    const next = computeNextRetry(4, { base_delay_s: 600, max_delay_s: 900, max_attempts: 10 }, NOW, noJitter);
    assert.equal(next!.getTime(), NOW + 900_000);
  });

  it('agotar max_attempts → null (dead_letter)', () => {
    assert.equal(computeNextRetry(5, null, NOW, noJitter), null);
    assert.equal(computeNextRetry(6, null, NOW, noJitter), null);
    assert.equal(computeNextRetry(2, { max_attempts: 2 }, NOW, noJitter), null);
  });

  it('suma jitter acotado a 30s', () => {
    const next = computeNextRetry(1, null, NOW, () => 1);
    assert.equal(next!.getTime(), NOW + 60_000 + 30_000);
  });

  it('attempts 0 se trata como primer intento', () => {
    assert.equal(computeNextRetry(0, null, NOW, noJitter)!.getTime(), NOW + 60_000);
  });
});

describe('presupuesto del poll de comprobante', () => {
  /**
   * Ventana total de un presupuesto: cuánto tiempo se puede esperar antes del
   * dead_letter. Es lo que importa acá, no cada delay individual.
   */
  const totalWindowSeconds = (budget: {
    max_attempts: number;
    base_delay_s: number;
    max_delay_s: number;
  }): number => {
    let total = 0;
    for (let attempt = 1; attempt < budget.max_attempts; attempt += 1) {
      total += Math.min(budget.base_delay_s * 2 ** (attempt - 1), budget.max_delay_s);
    }
    return total;
  };

  it('el presupuesto GENERAL se agota en menos de una hora', () => {
    // Este es el motivo por el que `invoice_fetch` necesita el suyo: el ERP
    // factura por lote y con esta ventana una venta sana terminaría en
    // dead_letter sólo por esperar.
    assert.ok(totalWindowSeconds(DEFAULT_OUTBOX_SETTINGS) < 3600);
  });

  it('el presupuesto del comprobante aguanta más de 12 horas', () => {
    assert.ok(totalWindowSeconds(DEFAULT_INVOICE_FETCH_SETTINGS) > 12 * 3600);
  });

  it('no manda a dead_letter mientras queden intentos del presupuesto largo', () => {
    const budget = DEFAULT_INVOICE_FETCH_SETTINGS;
    assert.notEqual(computeNextRetry(10, budget, NOW, noJitter), null);
    assert.notEqual(computeNextRetry(budget.max_attempts - 1, budget, NOW, noJitter), null);
    assert.equal(computeNextRetry(budget.max_attempts, budget, NOW, noJitter), null);
  });

  it('el delay del comprobante se topea en 1 h y no en 30 min', () => {
    const next = computeNextRetry(20, DEFAULT_INVOICE_FETCH_SETTINGS, NOW, noJitter);
    assert.equal(next!.getTime(), NOW + 3_600_000);
  });
});
