import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildStages, eventKind } from './_flow.ts';

/** Sólo lo que el partidor mira; el resto de `WaEvent` no le importa. */
const ev = (type: string, step: string | null = null, payload: Record<string, unknown> | null = null) =>
  ({ type, step, payload, created_at: '2026-09-15T12:00:00.000Z' }) as never;

test('las sesiones sin nodos son una sola etapa sin encabezado', () => {
  // El asesor y el router nunca emiten `node_entered`: si el diagrama exigiera un
  // nodo para dibujar, estas conversaciones quedarían en blanco.
  const stages = buildStages([ev('inbound'), ev('guided_started'), ev('guided_asked', 'surface')]);
  assert.equal(stages.length, 1);
  assert.equal(stages[0].node, null);
  assert.equal(stages[0].events.length, 3);
});

test('cada node_entered abre una etapa y no se dibuja como fila', () => {
  const stages = buildStages([
    ev('node_entered', 'menu_principal'),
    ev('menu_shown'),
    ev('inbound'),
    ev('node_entered', 'buscar_producto'),
    ev('search'),
  ]);
  assert.deepEqual(
    stages.map((s) => s.node),
    ['menu_principal', 'buscar_producto'],
  );
  assert.deepEqual(
    stages.map((s) => s.events.map((e) => e.type)),
    [['menu_shown', 'inbound'], ['search']],
  );
});

test('lo que pasó ANTES del primer nodo no se pierde', () => {
  const stages = buildStages([ev('inbound'), ev('node_entered', 'menu_principal'), ev('menu_shown')]);
  assert.deepEqual(
    stages.map((s) => s.node),
    [null, 'menu_principal'],
  );
});

test('un nodo por el que se pasó sin decir nada sigue siendo un paso', () => {
  // Esconderlo cortaría la cadena justo donde hay que mirar por qué no pasó nada.
  const stages = buildStages([ev('node_entered', 'a'), ev('node_entered', 'b'), ev('menu_shown')]);
  assert.deepEqual(
    stages.map((s) => [s.node, s.events.length]),
    [
      ['a', 0],
      ['b', 1],
    ],
  );
});

test('el número de paso cuenta nodos, no posiciones', () => {
  // Con el tramo sin nodo adelante, numerar por índice haría que el primer nodo
  // real salga como "Paso 2". Es el bug que se ve a simple vista en la pantalla.
  const stages = buildStages([
    ev('inbound'),
    ev('node_entered', 'menu_principal'),
    ev('node_entered', 'derivar'),
  ]);
  assert.deepEqual(
    stages.map((s) => [s.node, s.step]),
    [
      [null, null],
      ['menu_principal', 1],
      ['derivar', 2],
    ],
  );
});

test('un nodo sin step cae en el node_id del payload antes que en un "—"', () => {
  assert.equal(buildStages([ev('node_entered', null, { node_id: 'nd_7' })])[0].node, 'nd_7');
});

test('sin eventos no hay diagrama, no una caja vacía', () => {
  assert.deepEqual(buildStages([]), []);
});

test('la dirección de la flecha la da el emisor, no el nombre del tipo', () => {
  assert.equal(eventKind(ev('inbound')), 'cliente');
  assert.equal(eventKind(ev('menu_shown')), 'bot');
  assert.equal(eventKind(ev('search')), 'sistema');
  assert.equal(eventKind(ev('no_results')), 'alerta');
  assert.equal(eventKind(ev('send_failed')), 'fallo');
  // Un tipo que todavía no existe se dibuja como interno antes que romper.
  assert.equal(eventKind(ev('algo_nuevo')), 'sistema');
});

test('las filas viejas mal tipadas apuntan al bot, igual que su texto', () => {
  // `guided_answered` sin `step` y con `asked` es el bot PREGUNTANDO. Si mirásemos
  // sólo el tipo, la flecha diría "cliente" arriba de un "Preguntó surface".
  assert.equal(eventKind(ev('guided_answered', null, { asked: 'surface' })), 'bot');
  assert.equal(eventKind(ev('guided_answered', 'surface', { label: 'Pared' })), 'cliente');
});
