import assert from 'node:assert/strict';
import test from 'node:test';

import { DELETABLE_STATUSES, deleteBlockReason, isDeletableStatus } from './deletable.ts';
import { EXECUTION_STATUSES, type ExecutionStatus } from './statuses.ts';

test('el gate cubre TODOS los estados: ninguno queda sin decisión', () => {
  // Si mañana se agrega un estado al enum, este test falla hasta que alguien decida
  // de qué lado cae. Es la parte que un `includes` solo no protege.
  for (const status of EXECUTION_STATUSES) {
    const deletable = isDeletableStatus(status);
    const reason = deleteBlockReason(status);
    assert.equal(
      deletable,
      reason === null,
      `"${status}": isDeletableStatus y deleteBlockReason se contradicen`,
    );
  }
});

test('los tres estados que el pedido bloquea NO se pueden borrar', () => {
  for (const status of ['ready_to_apply', 'partially_applied', 'applied'] as ExecutionStatus[]) {
    assert.equal(isDeletableStatus(status), false, `"${status}" no debería ser borrable`);
  }
});

test('las corridas en vuelo tampoco: primero se cancelan', () => {
  // Es la decisión que amplía el pedido original, y la razón es técnica: con la fila
  // soft-deleted el apply relee la corrida, no la encuentra y deja el catálogo
  // escrito a medias.
  for (const status of ['generating', 'applying'] as ExecutionStatus[]) {
    assert.equal(isDeletableStatus(status), false, `"${status}" está en vuelo`);
    assert.match(deleteBlockReason(status) ?? '', /Cancelala primero/);
  }
});

test('lo que el operador quiere sacar de encima SÍ se borra', () => {
  for (const status of [
    'draft',
    'pending_review',
    'partially_reviewed',
    'error',
    'cancelled',
    'restored',
  ] as ExecutionStatus[]) {
    assert.equal(isDeletableStatus(status), true, `"${status}" debería ser borrable`);
    assert.equal(deleteBlockReason(status), null);
  }
});

test('borrable y bloqueado parten el enum en dos sin solaparse ni dejar huecos', () => {
  const blocked = EXECUTION_STATUSES.filter((s) => !isDeletableStatus(s));
  assert.equal(DELETABLE_STATUSES.length + blocked.length, EXECUTION_STATUSES.length);
  assert.deepEqual(
    [...blocked].sort(),
    ['applied', 'applying', 'generating', 'partially_applied', 'ready_to_apply'],
  );
});

test('el motivo distingue "cancelá y volvé" de "esto no se borra nunca"', () => {
  // Del otro lado son dos acciones distintas; un mensaje único las confunde.
  assert.match(deleteBlockReason('ready_to_apply') ?? '', /Cancelala si no la vas a usar/);
  assert.match(deleteBlockReason('applied') ?? '', /No se puede eliminar/);
  assert.match(deleteBlockReason('partially_applied') ?? '', /No se puede eliminar/);
});
