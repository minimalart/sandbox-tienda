import assert from 'node:assert/strict';
import { it } from 'node:test';
import {
  assignStudentQuantities,
  assignedQuantity,
  assignmentProgress,
  selectedUnitIds,
} from './student-assignments';

const units = [1, 2, 3].map((n) => ({
  id: `u${n}`,
  line_id: 'book',
  person_id: null,
}));
const lines = [{ id: 'book', quantity: 3 }];
it('counts pending items by units as assignments are added and removed', () => {
  assert.deepEqual(assignmentProgress(units, {}, lines), {
    total: 3,
    pending: 3,
  });
  const assigned = assignStudentQuantities(units, {}, lines, 'ana', {
    book: 2,
  });
  assert.equal(assignmentProgress(units, assigned, lines).pending, 1);
  const complete = assignStudentQuantities(units, assigned, lines, 'ana', {
    book: 3,
  });
  assert.equal(assignmentProgress(units, complete, lines).pending, 0);
  const removed = assignStudentQuantities(units, complete, lines, 'ana', {
    book: 1,
  });
  assert.equal(assignmentProgress(units, removed, lines).pending, 2);
});
it('does not offset pending items with excess assignments after a cart reduction', () => {
  assert.deepEqual(
    assignmentProgress(
      [...units, { id: 'kit1', line_id: 'kit', person_id: null }],
      { u1: 'ana', u2: 'ana', u3: 'ana' },
      [
        { id: 'book', quantity: 1 },
        { id: 'kit', quantity: 1 },
      ],
    ),
    { total: 2, pending: 1 },
  );
});
it('splits products between students without exceeding purchased quantity or stealing units', () => {
  const ana = assignStudentQuantities(units, {}, lines, 'ana', { book: 2 });
  const juan = assignStudentQuantities(units, ana, lines, 'juan', { book: 9 });
  assert.equal(assignedQuantity(units, juan, 'book', 'ana'), 2);
  assert.equal(assignedQuantity(units, juan, 'book', 'juan'), 1);
  assert.equal(assignedQuantity(units, juan, 'book'), 3);
  assert.equal(
    assignedQuantity(
      units,
      assignStudentQuantities(units, juan, lines, 'ana', { book: 0 }),
      'book',
    ),
    1,
  );
});
it('retains chosen student units after a cart reduction', () => {
  const before = { u1: 'ana', u2: 'juan', u3: 'juan' };
  const reduced = [{ id: 'book', quantity: 2 }];
  const corrected = assignStudentQuantities(units, before, reduced, 'juan', {
    book: 1,
  });
  assert.deepEqual(selectedUnitIds(units, corrected, reduced), ['u1', 'u2']);
  assert.equal(assignedQuantity(units, corrected, 'book'), 2);
  assert.equal(before.u3, 'juan');
});
