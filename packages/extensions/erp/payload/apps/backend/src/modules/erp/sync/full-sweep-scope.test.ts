import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveImagePhaseScope, shouldWritePriceListsOnRun } from './full-sweep-scope.ts';

describe('resolveImagePhaseScope', () => {
  it('un backfill pendiente gana sobre todo lo demás', () => {
    for (const fullCatalogRun of [true, false]) {
      for (const scanOnFullSweep of [true, false]) {
        assert.equal(
          resolveImagePhaseScope({ backfillPending: true, fullCatalogRun, scanOnFullSweep }),
          'backfill'
        );
      }
    }
  });

  it('una corrida con delta revisa solo el delta', () => {
    assert.equal(
      resolveImagePhaseScope({ backfillPending: false, fullCatalogRun: false, scanOnFullSweep: false }),
      'delta'
    );
    // El opt-in del barrido no cambia nada cuando no hay barrido.
    assert.equal(
      resolveImagePhaseScope({ backfillPending: false, fullCatalogRun: false, scanOnFullSweep: true }),
      'delta'
    );
  });

  it('por default el barrido completo NO revisa imágenes', () => {
    assert.equal(
      resolveImagePhaseScope({ backfillPending: false, fullCatalogRun: true, scanOnFullSweep: false }),
      'skipped'
    );
  });

  it('con el opt-in prendido el barrido completo sí las revisa', () => {
    assert.equal(
      resolveImagePhaseScope({ backfillPending: false, fullCatalogRun: true, scanOnFullSweep: true }),
      'full_sweep'
    );
  });
});

describe('shouldWritePriceListsOnRun', () => {
  it('una corrida normal siempre escribe price lists', () => {
    assert.equal(shouldWritePriceListsOnRun({ fullSweep: false, writeOnFullSweep: false }), true);
    assert.equal(shouldWritePriceListsOnRun({ fullSweep: false, writeOnFullSweep: true }), true);
  });

  it('el barrido completo las escribe por default', () => {
    assert.equal(shouldWritePriceListsOnRun({ fullSweep: true, writeOnFullSweep: true }), true);
  });

  it('solo se saltean si el operador lo pidió, y solo en el barrido', () => {
    assert.equal(shouldWritePriceListsOnRun({ fullSweep: true, writeOnFullSweep: false }), false);
  });
});
