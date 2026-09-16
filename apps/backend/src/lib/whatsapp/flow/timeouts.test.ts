import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { advance, emptyState, readState, type FlowState } from './engine';
import {
  FLOW_TIMEOUT_MAX_SECONDS,
  FLOW_TIMEOUT_ON,
  validateGraph,
  type FlowGraph,
} from './graph';
import { planTimeoutSweep, sweepCutoff } from './timeouts';

/** Pregunta con plazo: si no contesta en 10 minutos, se le insiste una vez. */
const CON_PLAZO: FlowGraph = {
  nodes: [
    { id: 'inicio', type: 'start', match: { keywords: ['hola'], fallback: true } },
    {
      id: 'pregunta',
      type: 'ask_buttons',
      body: '¿Qué necesitás?',
      options: [{ value: 'comprar', label: 'Comprar' }],
      timeout_seconds: 600,
    },
    { id: 'compra', type: 'message', body: 'Dale.' },
    { id: 'recordatorio', type: 'message', body: '¿Seguís ahí?' },
    { id: 'fin', type: 'end' },
  ],
  edges: [
    { id: 'e0', source: 'inicio', target: 'pregunta' },
    { id: 'e1', source: 'pregunta', target: 'compra', on: 'comprar' },
    { id: 'e2', source: 'pregunta', target: 'recordatorio', on: FLOW_TIMEOUT_ON },
    { id: 'e3', source: 'compra', target: 'fin' },
    { id: 'e4', source: 'recordatorio', target: 'fin' },
  ],
};

const T0 = new Date('2026-09-16T10:00:00.000Z');

describe('el plazo se anota al hacer la pregunta', () => {
  it('parquear en una pregunta con plazo deja escrito cuándo vence', () => {
    const plan = advance(CON_PLAZO, emptyState('v1'), { text: 'hola', selectionId: null }, T0);
    assert.equal(plan.state.node_id, 'pregunta');
    assert.equal(plan.state.awaiting_until, '2026-09-16T10:10:00.000Z');
  });

  it('una pregunta SIN plazo no deja ninguno', () => {
    const sinPlazo: FlowGraph = {
      ...CON_PLAZO,
      nodes: CON_PLAZO.nodes.map((n) =>
        n.id === 'pregunta' ? { ...n, timeout_seconds: undefined } : n,
      ),
    };
    const plan = advance(sinPlazo, emptyState('v1'), { text: 'hola', selectionId: null }, T0);
    assert.equal(plan.state.awaiting_until, null);
  });

  it('si la pregunta se vuelve a hacer, el reloj arranca de nuevo', () => {
    // El cliente escribió otra cosa, el recorrido reentró por la Entrada catch-all y
    // le volvió a mostrar la pregunta. El plazo cuenta desde AHORA porque acaba de
    // verla: medirlo desde la primera vez la vencería con la pregunta recién puesta
    // delante.
    const primero = advance(CON_PLAZO, emptyState('v1'), { text: 'hola', selectionId: null }, T0);
    const cincoMin = new Date(T0.getTime() + 5 * 60_000);
    const segundo = advance(
      CON_PLAZO,
      primero.state,
      { text: 'cualquier cosa', selectionId: null },
      cincoMin,
    );
    assert.equal(segundo.state.awaiting_until, '2026-09-16T10:15:00.000Z');
  });

  it('un mensaje que el recorrido NO atiende no toca el plazo', () => {
    // Sin Entrada catch-all el turno se cede al router: el recorrido no dijo nada,
    // así que la pregunta sigue siendo la misma y vence cuando iba a vencer.
    const sinCatchAll: FlowGraph = {
      ...CON_PLAZO,
      nodes: CON_PLAZO.nodes.map((n) =>
        n.id === 'inicio' ? { ...n, match: { keywords: ['hola'] } } : n,
      ),
    };
    const primero = advance(sinCatchAll, emptyState('v1'), { text: 'hola', selectionId: null }, T0);
    const segundo = advance(
      sinCatchAll,
      primero.state,
      { text: 'otra cosa', selectionId: null },
      new Date(T0.getTime() + 5 * 60_000),
    );
    assert.equal(segundo.handled, false);
    assert.equal(segundo.state.awaiting_until, '2026-09-16T10:10:00.000Z');
  });
});

describe('cuando vence', () => {
  const esperando = (): FlowState =>
    advance(CON_PLAZO, emptyState('v1'), { text: 'hola', selectionId: null }, T0).state;

  it('sale por la salida de vencimiento y no por la respuesta', () => {
    const plan = advance(CON_PLAZO, esperando(), { text: null, selectionId: null, timedOut: true });
    assert.deepEqual(
      plan.steps.map((s) => s.nodeId),
      ['recordatorio'],
    );
    assert.equal(plan.handled, true);
  });

  it('el plazo se borra: no puede volver a vencer', () => {
    const plan = advance(CON_PLAZO, esperando(), { text: null, selectionId: null, timedOut: true });
    assert.equal(plan.state.awaiting_until, null);
  });

  it('no inventa una respuesta', () => {
    // Salir por la arista incondicional dejaría `answers.pregunta` vacío y el resto
    // del recorrido decidiendo sobre una respuesta que nadie dio.
    const plan = advance(CON_PLAZO, esperando(), { text: null, selectionId: null, timedOut: true });
    assert.equal(plan.state.answers.pregunta, undefined);
  });

  it('un paso sin salida de vencimiento no sigue por cualquier lado', () => {
    const sinSalida: FlowGraph = {
      ...CON_PLAZO,
      edges: CON_PLAZO.edges.filter((e) => e.on !== FLOW_TIMEOUT_ON),
    };
    const state = advance(sinSalida, emptyState('v1'), { text: 'hola', selectionId: null }, T0).state;
    const plan = advance(sinSalida, state, { text: null, selectionId: null, timedOut: true });
    assert.equal(plan.steps.length, 0);
    assert.equal(plan.handled, false);
    // Y sobre todo: se borra el plazo, o el barrido la encuentra vencida para siempre.
    assert.equal(plan.state.awaiting_until, null);
  });

  it('un barrido que llega tarde no rompe nada', () => {
    // La conversación siguió y ya está en otro lado: no hay nada que vencer.
    const plan = advance(CON_PLAZO, emptyState('v1'), { text: null, selectionId: null, timedOut: true });
    assert.equal(plan.handled, false);
    assert.equal(plan.state.awaiting_until, null);
  });

  it('contestar después de que venció sigue funcionando', () => {
    // El plazo vencido no cierra la pregunta: si el cliente vuelve y toca el botón,
    // el recorrido sigue por donde tenía que seguir.
    const state = { ...esperando(), awaiting_until: null };
    const plan = advance(CON_PLAZO, state, { text: null, selectionId: 'flow:pregunta:comprar' });
    assert.deepEqual(
      plan.steps.map((s) => s.nodeId),
      ['compra'],
    );
  });
});

describe('el estado guardado', () => {
  it('se relee con su plazo', () => {
    const state = readState({ graph: { version_id: 'v1', awaiting_until: '2026-09-16T10:10:00.000Z' } }, 'v1');
    assert.equal(state.awaiting_until, '2026-09-16T10:10:00.000Z');
  });

  it('un estado viejo sin plazo se lee sin romperse', () => {
    const state = readState({ graph: { version_id: 'v1', node_id: 'pregunta' } }, 'v1');
    assert.equal(state.awaiting_until, null);
  });
});

describe('qué rechaza el validador', () => {
  const mensajes = (g: FlowGraph): string => validateGraph(g).map((i) => i.message).join(' | ');

  it('el recorrido con plazo bien armado no tiene problemas', () => {
    assert.deepEqual(validateGraph(CON_PLAZO), []);
  });

  it('un plazo sin salida cableada', () => {
    const g: FlowGraph = { ...CON_PLAZO, edges: CON_PLAZO.edges.filter((e) => e.on !== FLOW_TIMEOUT_ON) };
    assert.match(mensajes(g), /Si no contesta/);
  });

  it('una salida de vencimiento sin plazo', () => {
    const g: FlowGraph = {
      ...CON_PLAZO,
      nodes: CON_PLAZO.nodes.map((n) => (n.id === 'pregunta' ? { ...n, timeout_seconds: undefined } : n)),
    };
    assert.match(mensajes(g), /nunca se va a tomar/);
  });

  it('un plazo en un paso que no espera nada', () => {
    const g: FlowGraph = {
      ...CON_PLAZO,
      nodes: CON_PLAZO.nodes.map((n) => (n.id === 'compra' ? { ...n, timeout_seconds: 600 } : n)),
    };
    assert.match(mensajes(g), /no es un paso que espere/);
  });

  it('un plazo más largo de lo que vive la sesión', () => {
    const g: FlowGraph = {
      ...CON_PLAZO,
      nodes: CON_PLAZO.nodes.map((n) =>
        n.id === 'pregunta' ? { ...n, timeout_seconds: FLOW_TIMEOUT_MAX_SECONDS + 1 } : n,
      ),
    };
    assert.match(mensajes(g), /tiene que estar entre/);
  });

  it('una respuesta que se llama como la salida reservada', () => {
    const g: FlowGraph = {
      ...CON_PLAZO,
      nodes: CON_PLAZO.nodes.map((n) =>
        n.id === 'pregunta'
          ? { ...n, options: [{ value: FLOW_TIMEOUT_ON, label: 'Esperar' }] }
          : n,
      ),
    };
    assert.match(mensajes(g), /nombre reservado/);
  });
});

describe('a quién despierta el barrido', () => {
  const live = [
    { versionId: 'v_uno', siteId: 'site_a' },
    { versionId: 'v_global', siteId: null },
  ];

  it('la tienda sale de la versión que la conversación está caminando', () => {
    const plan = planTimeoutSweep(
      [{ phone: '+5491100', graph: { version_id: 'v_uno', awaiting_until: '2026-01-01T00:00:00.000Z' } }],
      live,
    );
    assert.deepEqual(plan.due, [{ phone: '+5491100', siteId: 'site_a' }]);
  });

  it('el recorrido global despierta sin tienda', () => {
    const plan = planTimeoutSweep([{ phone: '+5491101', graph: { version_id: 'v_global' } }], live);
    assert.deepEqual(plan.due, [{ phone: '+5491101', siteId: null }]);
  });

  it('una versión que ya no está publicada se limpia en vez de avanzar', () => {
    const plan = planTimeoutSweep([{ phone: '+5491102', graph: { version_id: 'v_vieja' } }], live);
    assert.deepEqual(plan.due, []);
    assert.deepEqual(plan.stale, ['+5491102']);
  });

  it('un estado sin versión también se limpia', () => {
    // Si no se limpiara, el barrido la encontraría vencida en cada pasada.
    const plan = planTimeoutSweep([{ phone: '+5491103', graph: null }], live);
    assert.deepEqual(plan.stale, ['+5491103']);
  });

  it('el corte es el mismo formato que guarda el estado', () => {
    // La consulta compara strings sobre json; el orden alfabético sólo coincide con
    // el cronológico si el formato es el de `toISOString()`.
    assert.equal(sweepCutoff(T0), '2026-09-16T10:00:00.000Z');
  });
});
