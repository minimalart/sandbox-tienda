import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { ErpOutboxStatus } from '../types.ts';
import { decideResync, isBulkResyncable, RESYNC_BULK_STATUSES } from './resync-decision.ts';

const ALL_STATUSES: ErpOutboxStatus[] = [
  'pending',
  'processing',
  'sent',
  'failed',
  'dead_letter',
  'skipped',
  'duplicate',
];

describe('decideResync', () => {
  it('una fila skipped se reencola SIN force: es el caso que dejaba ventas muertas', () => {
    assert.deepEqual(decideResync({ status: 'skipped', force: false }), {
      action: 'requeue',
      reason: 'skipped',
    });
  });

  it('failed y dead_letter se reencolan sin force', () => {
    assert.deepEqual(decideResync({ status: 'failed', force: false }), {
      action: 'requeue',
      reason: 'failed',
    });
    assert.deepEqual(decideResync({ status: 'dead_letter', force: false }), {
      action: 'requeue',
      reason: 'dead_letter',
    });
  });

  it('una orden sin fila en el outbox se encola: no hay nada que duplicar en el ERP', () => {
    assert.deepEqual(decideResync({ status: null, force: false }), {
      action: 'requeue',
      reason: 'skipped',
    });
  });

  it('no toca lo que ya está en camino, ni con force', () => {
    for (const force of [true, false]) {
      assert.deepEqual(decideResync({ status: 'pending', force }), {
        action: 'noop',
        reason: 'already_pending',
      });
      assert.deepEqual(decideResync({ status: 'processing', force }), {
        action: 'noop',
        reason: 'in_flight',
      });
    }
  });

  it('sent y duplicate NO se reenvían sin force: el ERP puede facturar dos veces', () => {
    assert.deepEqual(decideResync({ status: 'sent', force: false }), {
      action: 'noop',
      reason: 'already_sent',
    });
    assert.deepEqual(decideResync({ status: 'duplicate', force: false }), {
      action: 'noop',
      reason: 'already_duplicate',
    });
  });

  it('con force, sent y duplicate se reenvían y el motivo queda marcado como forzado', () => {
    assert.deepEqual(decideResync({ status: 'sent', force: true }), {
      action: 'requeue',
      reason: 'forced_sent',
    });
    assert.deepEqual(decideResync({ status: 'duplicate', force: true }), {
      action: 'requeue',
      reason: 'forced_duplicate',
    });
  });

  it('decide para todos los estados y nunca devuelve undefined', () => {
    for (const status of ALL_STATUSES) {
      for (const force of [true, false]) {
        const outcome = decideResync({ status, force });
        assert.ok(outcome, `${status}/${force} quedó sin decisión`);
        assert.ok(outcome.action === 'requeue' || outcome.action === 'noop');
      }
    }
  });
});

describe('isBulkResyncable', () => {
  it('la acción masiva barre skipped, failed y dead_letter', () => {
    assert.deepEqual([...RESYNC_BULK_STATUSES], ['skipped', 'failed', 'dead_letter']);
    for (const status of RESYNC_BULK_STATUSES) assert.equal(isBulkResyncable(status), true);
  });

  it('la acción masiva NUNCA barre lo enviado ni lo que está en vuelo', () => {
    for (const status of ['sent', 'duplicate', 'pending', 'processing'] as ErpOutboxStatus[]) {
      assert.equal(
        isBulkResyncable(status),
        false,
        `${status} no puede entrar en el barrido masivo`
      );
    }
  });
});
