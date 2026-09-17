import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assignTargetQuantities,
  buildAssignmentTargets,
  selectedTargetUnitIds,
  targetAssignedQuantity,
  targetsProgress,
} from './assignment-targets';

const line = (
  id: string,
  quantity = 1,
  meta?: Record<string, unknown>,
  thumbnail: string | null = null,
) =>
  ({
    id,
    quantity,
    title: id,
    product_title: id,
    thumbnail,
    metadata: meta ?? null,
  }) as any;

const units = (...pairs: Array<[string, number]>) =>
  pairs.flatMap(([lineId, count]) =>
    Array.from({ length: count }, (_, i) => ({ id: `${lineId}-u${i + 1}`, line_id: lineId })),
  ) as any[];

const kit = (instance: string, title = 'Kit 4.º grado') => ({
  bundle_instance_id: instance,
  bundle_title: title,
  bundle_id: 'bndl_1',
});

test('un kit de tres lineas es UN target con un solo cupo', () => {
  const targets = buildAssignmentTargets(
    [line('l1', 1, kit('abc')), line('l2', 1, kit('abc')), line('l3', 2, kit('abc'))],
    units(['l1', 1], ['l2', 1], ['l3', 2]),
  );

  assert.equal(targets.length, 1);
  assert.equal(targets[0]?.kind, 'bundle');
  assert.equal(targets[0]?.quantity, 1);
  assert.equal(targets[0]?.unitIds.length, 4);
  assert.equal(targets[0]?.title, 'Kit 4.º grado');
  assert.equal(targets[0]?.subtitle, '3 productos');
});

test('kits distintos no se mezclan y los sueltos siguen siendo su propio target', () => {
  const targets = buildAssignmentTargets(
    [line('l1', 1, kit('abc')), line('l2', 1, kit('def', 'Kit 2.º grado')), line('l3', 2)],
    units(['l1', 1], ['l2', 1], ['l3', 2]),
  );

  assert.deepEqual(
    targets.map((t) => [t.kind, t.id, t.quantity]),
    [
      ['bundle', 'bundle:abc', 1],
      ['bundle', 'bundle:def', 1],
      ['line', 'l3', 2],
    ],
  );
});

test('una linea sin unidades no es asignable y no aparece', () => {
  const targets = buildAssignmentTargets([line('l1'), line('l2')], units(['l1', 1]));
  assert.deepEqual(
    targets.map((t) => t.id),
    ['l1'],
  );
});

test('asignar un kit toma TODAS sus unidades', () => {
  const u = units(['l1', 1], ['l2', 3]);
  const targets = buildAssignmentTargets([line('l1', 1, kit('abc')), line('l2', 3, kit('abc'))], u);
  const next = assignTargetQuantities(u, {}, targets, 'juan', { 'bundle:abc': 1 });

  assert.equal(Object.keys(next).length, 4);
  assert.equal(new Set(Object.values(next)).size, 1);
  assert.equal(targetAssignedQuantity(u, next, targets[0]!, 'juan'), 1);
});

test('desasignar un kit libera todas sus unidades', () => {
  const u = units(['l1', 1], ['l2', 2]);
  const targets = buildAssignmentTargets([line('l1', 1, kit('abc')), line('l2', 2, kit('abc'))], u);
  const assigned = assignTargetQuantities(u, {}, targets, 'juan', { 'bundle:abc': 1 });
  const cleared = assignTargetQuantities(u, assigned, targets, 'juan', { 'bundle:abc': 0 });

  assert.deepEqual(cleared, {});
});

test('un kit ya tomado por otro estudiante no se puede robar', () => {
  const u = units(['l1', 2]);
  const targets = buildAssignmentTargets([line('l1', 2, kit('abc'))], u);
  const deSofia = assignTargetQuantities(u, {}, targets, 'sofia', { 'bundle:abc': 1 });
  const intento = assignTargetQuantities(u, deSofia, targets, 'juan', { 'bundle:abc': 1 });

  assert.deepEqual(intento, deSofia);
  assert.equal(targetAssignedQuantity(u, intento, targets[0]!, 'juan'), 0);
  assert.equal(targetAssignedQuantity(u, intento, targets[0]!, 'sofia'), 1);
});

test('las lineas sueltas conservan la asignacion por unidad', () => {
  const u = units(['l1', 3]);
  const targets = buildAssignmentTargets([line('l1', 3)], u);
  const next = assignTargetQuantities(u, {}, targets, 'juan', { l1: 2 });

  assert.equal(Object.values(next).filter((p) => p === 'juan').length, 2);
  assert.equal(targetAssignedQuantity(u, next, targets[0]!, 'juan'), 2);
});

test('dos estudiantes se reparten una linea suelta', () => {
  const u = units(['l1', 3]);
  const targets = buildAssignmentTargets([line('l1', 3)], u);
  const conJuan = assignTargetQuantities(u, {}, targets, 'juan', { l1: 2 });
  const conSofia = assignTargetQuantities(u, conJuan, targets, 'sofia', { l1: 5 });

  assert.equal(Object.values(conSofia).filter((p) => p === 'juan').length, 2);
  assert.equal(Object.values(conSofia).filter((p) => p === 'sofia').length, 1);
});

test('el progreso cuenta cupos: un kit pendiente es UN item, no doce', () => {
  const u = units(['l1', 1], ['l2', 1], ['l3', 10], ['l4', 2]);
  const targets = buildAssignmentTargets(
    [
      line('l1', 1, kit('abc')),
      line('l2', 1, kit('abc')),
      line('l3', 10, kit('abc')),
      line('l4', 2),
    ],
    u,
  );

  assert.deepEqual(targetsProgress(u, {}, targets), { total: 3, pending: 3 });

  const conKit = assignTargetQuantities(u, {}, targets, 'juan', { 'bundle:abc': 1 });
  assert.deepEqual(targetsProgress(u, conKit, targets), { total: 3, pending: 2 });
});

test('un kit a medias no cuenta como asignado', () => {
  const u = units(['l1', 1], ['l2', 1]);
  const targets = buildAssignmentTargets([line('l1', 1, kit('abc')), line('l2', 1, kit('abc'))], u);
  const aMedias = { 'l1-u1': 'juan' };

  assert.equal(targetAssignedQuantity(u, aMedias, targets[0]!), 0);
  assert.deepEqual(targetsProgress(u, aMedias, targets), { total: 1, pending: 1 });
});

test('selectedTargetUnitIds respeta el cupo y pone primero las asignadas', () => {
  const u = units(['l1', 3]);
  const targets = buildAssignmentTargets([line('l1', 2)], u);
  const seleccion = selectedTargetUnitIds(u, { 'l1-u3': 'juan' }, targets);

  assert.equal(seleccion.length, 2);
  assert.equal(seleccion[0], 'l1-u3');
});

test('selectedTargetUnitIds devuelve el kit completo', () => {
  const u = units(['l1', 1], ['l2', 2]);
  const targets = buildAssignmentTargets([line('l1', 1, kit('abc')), line('l2', 2, kit('abc'))], u);
  assert.equal(selectedTargetUnitIds(u, {}, targets).length, 3);
});

test('el kit junta las fotos de lo que trae, sin repetir', () => {
  const targets = buildAssignmentTargets(
    [
      line('l1', 1, kit('abc'), 'a.jpg'),
      line('l2', 1, kit('abc'), 'b.jpg'),
      line('l3', 1, kit('abc'), 'a.jpg'),
      line('l4', 1, kit('abc'), null),
    ],
    units(['l1', 1], ['l2', 1], ['l3', 1], ['l4', 1]),
  );

  assert.deepEqual(targets[0]?.thumbnails, ['a.jpg', 'b.jpg']);
  assert.equal(targets[0]?.thumbnail, 'a.jpg');
});

test('una linea suelta trae una sola foto, o ninguna', () => {
  const targets = buildAssignmentTargets(
    [line('l1', 1, undefined, 'a.jpg'), line('l2')],
    units(['l1', 1], ['l2', 1]),
  );

  assert.deepEqual(targets[0]?.thumbnails, ['a.jpg']);
  assert.deepEqual(targets[1]?.thumbnails, []);
});

test('sin items ni unidades no hay targets', () => {
  assert.deepEqual(buildAssignmentTargets([], []), []);
  assert.deepEqual(targetsProgress([], {}, []), { total: 0, pending: 0 });
});
