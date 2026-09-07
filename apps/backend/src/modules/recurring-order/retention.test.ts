import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  activeRetentionPct,
  consumeRetention,
  normalizeRetention,
} from './retention.ts';

describe('normalizeRetention', () => {
  it('acepta {percentage, cycles} válidos y descarta el resto', () => {
    assert.deepEqual(normalizeRetention({ percentage: 15, cycles: 3 }), {
      percentage: 15,
      cycles: 3,
    });
    assert.equal(normalizeRetention({ percentage: 0, cycles: 3 }), null);
    assert.equal(normalizeRetention({ percentage: 95, cycles: 3 }), null);
    assert.equal(normalizeRetention({ percentage: 10, cycles: 0 }), null);
    assert.equal(normalizeRetention('x'), null);
    assert.equal(normalizeRetention(null), null);
  });
});

describe('activeRetentionPct', () => {
  it('lee metadata.retention con remaining > 0', () => {
    assert.equal(
      activeRetentionPct({ retention: { percentage: 15, remaining_cycles: 2 } }),
      15,
    );
    assert.equal(
      activeRetentionPct({ retention: { percentage: 15, remaining_cycles: 0 } }),
      0,
    );
    assert.equal(activeRetentionPct({}), 0);
    assert.equal(activeRetentionPct(null), 0);
  });
});

describe('consumeRetention', () => {
  it('decrementa y elimina la clave al agotarse', () => {
    const one = consumeRetention({
      other: 'x',
      retention: { percentage: 15, remaining_cycles: 2 },
    });
    assert.deepEqual(one?.retention, { percentage: 15, remaining_cycles: 1 });
    assert.equal(one?.other, 'x');

    const done = consumeRetention({ retention: { percentage: 15, remaining_cycles: 1 } });
    assert.equal(done?.retention, undefined);
  });

  it('sin retención activa devuelve null (no tocar metadata)', () => {
    assert.equal(consumeRetention({}), null);
    assert.equal(consumeRetention(null), null);
  });
});
