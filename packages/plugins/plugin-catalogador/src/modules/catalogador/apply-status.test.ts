import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PENDING_REVIEW_STATUSES,
  RETRYABLE_PRODUCT_STATUSES,
  UNFINISHED_PRODUCT_STATUSES,
  resolveApplyFinalStatus,
} from './apply-status.ts';

test('sin fallas y sin nada por revisar, la corrida queda aplicada', () => {
  assert.equal(
    resolveApplyFinalStatus({ applied: 8, failed: 0, unfinished: 0 }),
    'applied'
  );
});

/**
 * El caso del bug: se aplicó apretando el botón con productos todavía en
 * revisión. Antes esto devolvía 'applied' —terminal— y dejaba muertas todas las
 * aprobaciones posteriores.
 */
test('con productos sin revisar NO queda aplicada, aunque no haya fallado nada', () => {
  assert.equal(
    resolveApplyFinalStatus({ applied: 1, failed: 0, unfinished: 7 }),
    'partially_applied'
  );
});

test('un apply que no escribió nada y dejó todo sin revisar tampoco queda aplicada', () => {
  assert.equal(
    resolveApplyFinalStatus({ applied: 0, failed: 0, unfinished: 8 }),
    'partially_applied'
  );
});

test('con fallas y algo aplicado, es parcial (comportamiento previo, sin cambios)', () => {
  assert.equal(
    resolveApplyFinalStatus({ applied: 3, failed: 2, unfinished: 0 }),
    'partially_applied'
  );
});

test('con fallas y nada aplicado, es error (comportamiento previo, sin cambios)', () => {
  assert.equal(
    resolveApplyFinalStatus({ applied: 0, failed: 5, unfinished: 0 }),
    'error'
  );
});

/** Las fallas mandan sobre lo pendiente: `error` es más informativo que `partially_applied`. */
test('fallas con nada aplicado da error incluso si además quedó algo por revisar', () => {
  assert.equal(
    resolveApplyFinalStatus({ applied: 0, failed: 2, unfinished: 4 }),
    'error'
  );
});

test('una corrida sin productos aplicables queda aplicada y no se cuelga', () => {
  assert.equal(
    resolveApplyFinalStatus({ applied: 0, failed: 0, unfinished: 0 }),
    'applied'
  );
});

/**
 * `rejected` y `no_changes` fuera de la lista es lo que permite que una corrida
 * donde se rechazó todo llegue a `applied` en vez de quedar parcial para siempre.
 */
test('sólo los statuses sin decisión cuentan como pendientes de revisión', () => {
  assert.deepEqual(PENDING_REVIEW_STATUSES, ['proposed', 'generating', 'pending']);
  for (const decided of ['rejected', 'no_changes', 'accepted', 'applied', 'excluded']) {
    assert.equal(PENDING_REVIEW_STATUSES.includes(decided), false, decided);
  }
});

/**
 * El apply leía `accepted_changes` sólo con status `accepted`, así que un
 * producto que falló al aplicar no se reintentaba en NINGÚN apply posterior.
 */
test('apply_failed es reintentable y accepted también', () => {
  assert.deepEqual(RETRYABLE_PRODUCT_STATUSES, ['accepted', 'apply_failed']);
  for (const noRetry of ['pending', 'proposed', 'rejected', 'no_changes', 'excluded', 'applied']) {
    assert.equal(RETRYABLE_PRODUCT_STATUSES.includes(noRetry), false, noRetry);
  }
});

test('un apply_failed pendiente impide que la corrida se sella como aplicada', () => {
  assert.equal(UNFINISHED_PRODUCT_STATUSES.includes('apply_failed'), true);
  assert.equal(UNFINISHED_PRODUCT_STATUSES.includes('accepted'), true);
  // Decisiones cerradas y fallas de generación no bloquean el cierre.
  for (const done of ['rejected', 'no_changes', 'excluded', 'applied', 'error']) {
    assert.equal(UNFINISHED_PRODUCT_STATUSES.includes(done), false, done);
  }
});
