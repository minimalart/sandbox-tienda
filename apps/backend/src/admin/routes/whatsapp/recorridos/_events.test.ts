import { test } from 'node:test';
import assert from 'node:assert/strict';

import { describeEvent } from './_events.ts';

/** Sólo lo que el describer mira; el resto de `WaEvent` no le importa. */
const ev = (type: string, step: string | null = null, payload: Record<string, unknown> | null = null) =>
  ({ type, step, payload }) as never;

test('preguntar y responder son dos líneas distintas, con la dimensión en las dos', () => {
  assert.equal(
    describeEvent(ev('guided_asked', 'surface', { remaining: 37 })),
    'Preguntó surface — quedaban 37 productos',
  );
  assert.equal(
    describeEvent(ev('guided_answered', 'surface', { label: 'Pared o cemento', value: 'wall' })),
    'Respondió surface: Pared o cemento',
  );
});

test('las filas viejas mal tipadas se leen como la pregunta que eran', () => {
  // Antes del fix, preguntar se emitía como `guided_answered` con `asked` y sin
  // `step`: salía "Respondió :" pelado. El event log no se migra.
  assert.equal(
    describeEvent(ev('guided_answered', null, { asked: 'surface', remaining: 37 })),
    'Preguntó surface — quedaban 37 productos',
  );
});

test('sin dimensión ni valor no queda un ":" colgado', () => {
  assert.equal(describeEvent(ev('guided_answered')), 'Respondió —');
});

test('"sin resultados" dice POR QUÉ, que es lo único accionable', () => {
  assert.equal(
    describeEvent(ev('no_results', null, { reason: 'filters_empty' })),
    'Sin resultados (ningún producto pasó los filtros)',
  );
  assert.equal(
    describeEvent(ev('no_results', null, { reason: 'show_failed' })),
    'Sin resultados (no se pudieron mostrar)',
  );
  // Una razón que el mapa no conoce se muestra cruda antes que esconderse.
  assert.equal(describeEvent(ev('no_results', null, { reason: 'algo_nuevo' })), 'Sin resultados (algo_nuevo)');
  assert.equal(describeEvent(ev('no_results', null, { query: 'satinol' })), 'Sin resultados para "satinol"');
  assert.equal(describeEvent(ev('no_results')), 'Sin resultados');
});

test('una selección dice QUÉ se eligió', () => {
  assert.equal(
    describeEvent(ev('inbound', null, { kind: 'selection', selection_id: 'act:guided' })),
    'El cliente escribió (selection): act:guided',
  );
  assert.equal(describeEvent(ev('inbound', null, { kind: 'text' })), 'El cliente escribió (text)');
});
