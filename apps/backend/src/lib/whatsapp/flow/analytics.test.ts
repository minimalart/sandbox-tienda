import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { aggregateFlowAnalytics, type FlowEventRow } from './analytics';
import type { FlowGraph } from './graph';

/**
 * `menu` pregunta y sus DOS respuestas caen en el mismo `fin`. Es el caso que hace
 * falta el id de arista: por el par de nodos no se puede saber cuál se tomó.
 */
const graph: FlowGraph = {
  nodes: [
    { id: 'inicio', type: 'start', match: { fallback: true } },
    {
      id: 'menu',
      type: 'ask_buttons',
      body: '¿?',
      options: [
        { value: 'si', label: 'Sí' },
        { value: 'no', label: 'No' },
      ],
    },
    { id: 'fin', type: 'end', body: 'Listo' },
  ],
  edges: [
    { id: 'e_inicio', source: 'inicio', target: 'menu' },
    { id: 'e_si', source: 'menu', target: 'fin', on: 'si' },
    { id: 'e_no', source: 'menu', target: 'fin', on: 'no' },
  ],
};

let reloj = 0;
const evento = (
  session: string,
  nodeId: string,
  extra: Record<string, unknown> = {},
): FlowEventRow => ({
  phone: '+5491100000000',
  session_id: session,
  type: 'node_entered',
  step: nodeId,
  payload: { node_id: nodeId, version_id: 'v1', ...extra },
  created_at: new Date(1_700_000_000_000 + reloj++ * 1000).toISOString(),
  seq: reloj,
});

describe('cuántas conversaciones pasan por cada paso', () => {
  it('cuenta una sesión por paso, aunque haya vuelto a pasar', () => {
    // Lo que se mide es cuántas conversaciones llegaron, no cuántas vueltas dieron.
    const rows = [evento('s1', 'inicio'), evento('s1', 'menu'), evento('s1', 'menu')];
    const stats = aggregateFlowAnalytics(rows, graph, 'v1');
    assert.equal(stats.nodes.menu?.sessions, 1);
    assert.equal(stats.sessions_total, 1);
  });

  it('suma las conversaciones de sesiones distintas', () => {
    const rows = [
      evento('s1', 'inicio'),
      evento('s1', 'menu'),
      evento('s2', 'inicio'),
      evento('s2', 'menu'),
    ];
    const stats = aggregateFlowAnalytics(rows, graph, 'v1');
    assert.equal(stats.nodes.menu?.sessions, 2);
    assert.equal(stats.sessions_total, 2);
  });

  it('ignora los eventos de OTRA versión del recorrido', () => {
    // Una versión anterior tiene otros ids de nodo: mezclarlas inventa números.
    const rows = [
      evento('s1', 'menu'),
      { ...evento('s2', 'menu'), payload: { node_id: 'menu', version_id: 'v0' } },
    ];
    assert.equal(aggregateFlowAnalytics(rows, graph, 'v1').nodes.menu?.sessions, 1);
  });

  it('sin pedir versión, cuenta todo', () => {
    const rows = [evento('s1', 'menu'), evento('s2', 'menu')];
    assert.equal(aggregateFlowAnalytics(rows, graph).nodes.menu?.sessions, 2);
  });

  it('ignora los eventos que no son del recorrido', () => {
    const rows: FlowEventRow[] = [
      evento('s1', 'menu'),
      { ...evento('s1', 'menu'), type: 'added_to_cart' },
    ];
    assert.equal(aggregateFlowAnalytics(rows, graph, 'v1').nodes.menu?.sessions, 1);
  });
});

describe('dónde se cae la gente', () => {
  it('una conversación que se corta en una pregunta cuenta como abandono', () => {
    const rows = [evento('s1', 'inicio'), evento('s1', 'menu')];
    const stats = aggregateFlowAnalytics(rows, graph, 'v1');
    assert.equal(stats.nodes.menu?.dropped, 1);
    assert.equal(stats.nodes.inicio?.dropped, 0);
  });

  it('llegar al final NO es abandonar', () => {
    // Es el recorrido haciendo lo que tenía que hacer.
    const rows = [evento('s1', 'inicio'), evento('s1', 'menu'), evento('s1', 'fin')];
    assert.equal(aggregateFlowAnalytics(rows, graph, 'v1').nodes.fin?.dropped ?? 0, 0);
  });

  it('derivar a una persona tampoco', () => {
    const conDerivacion: FlowGraph = {
      nodes: [...graph.nodes, { id: 'persona', type: 'handoff', reason: 'x' }],
      edges: [...graph.edges, { id: 'e_p', source: 'menu', target: 'persona' }],
    };
    const rows = [evento('s1', 'menu'), evento('s1', 'persona')];
    assert.equal(aggregateFlowAnalytics(rows, conDerivacion, 'v1').nodes.persona?.dropped ?? 0, 0);
  });
});

describe('por qué rama sale la gente', () => {
  it('con el id de arista registrado, cuenta la rama correcta', () => {
    const rows = [
      evento('s1', 'menu'),
      evento('s1', 'fin', { edge_id: 'e_si' }),
      evento('s2', 'menu'),
      evento('s2', 'fin', { edge_id: 'e_no' }),
      evento('s3', 'menu'),
      evento('s3', 'fin', { edge_id: 'e_no' }),
    ];
    const stats = aggregateFlowAnalytics(rows, graph, 'v1');
    assert.equal(stats.edges.e_si?.sessions, 1);
    assert.equal(stats.edges.e_no?.sessions, 2);
    assert.equal(stats.edges.e_si?.ambiguous, undefined);
  });

  it('el porcentaje se calcula sobre las que pasaron por el paso de origen', () => {
    const rows = [
      evento('s1', 'menu'),
      evento('s1', 'fin', { edge_id: 'e_si' }),
      evento('s2', 'menu'),
      evento('s2', 'fin', { edge_id: 'e_si' }),
      evento('s3', 'menu'),
      evento('s3', 'fin', { edge_id: 'e_no' }),
    ];
    const stats = aggregateFlowAnalytics(rows, graph, 'v1');
    assert.equal(stats.edges.e_si?.percent_of_source, 66.7);
    assert.equal(stats.edges.e_no?.percent_of_source, 33.3);
  });

  it('SIN el id registrado y con dos ramas al mismo destino, lo marca como dudoso', () => {
    // Es lo que pasa con las conversaciones anteriores a este cambio: se toma una y
    // se avisa, en vez de mostrar un número que parece exacto y no lo es.
    const rows = [evento('s1', 'menu'), evento('s1', 'fin')];
    const stats = aggregateFlowAnalytics(rows, graph, 'v1');
    const contadas = Object.values(stats.edges).filter((e) => e.sessions > 0);
    assert.equal(contadas.length, 1);
    assert.equal(contadas[0]?.ambiguous, true);
  });

  it('con una sola arista posible no hay ambigüedad', () => {
    const rows = [evento('s1', 'inicio'), evento('s1', 'menu')];
    const stats = aggregateFlowAnalytics(rows, graph, 'v1');
    assert.equal(stats.edges.e_inicio?.sessions, 1);
    assert.equal(stats.edges.e_inicio?.ambiguous, undefined);
  });

  it('un id de arista que ya no existe en el grafo cae al par de nodos', () => {
    // El operador puede haber redibujado la flecha después de que corrieran esas
    // conversaciones.
    const rows = [evento('s1', 'inicio'), evento('s1', 'menu', { edge_id: 'e_borrada' })];
    assert.equal(aggregateFlowAnalytics(rows, graph, 'v1').edges.e_inicio?.sessions, 1);
  });
});

describe('las conversaciones viejas siguen contando', () => {
  it('sin session_id se agrupan por teléfono y día', () => {
    const base = evento('x', 'menu');
    const rows: FlowEventRow[] = [
      { ...base, session_id: null, phone: '+111', created_at: '2026-09-01T10:00:00.000Z' },
      { ...base, session_id: null, phone: '+111', created_at: '2026-09-01T11:00:00.000Z' },
      { ...base, session_id: null, phone: '+111', created_at: '2026-09-02T10:00:00.000Z' },
    ];
    // Dos días del mismo teléfono son dos conversaciones; dos eventos del mismo día,
    // una sola.
    assert.equal(aggregateFlowAnalytics(rows, graph, 'v1').sessions_total, 2);
  });

  it('sin `step`, el id sale del payload', () => {
    const rows: FlowEventRow[] = [{ ...evento('s1', 'menu'), step: null }];
    assert.equal(aggregateFlowAnalytics(rows, graph, 'v1').nodes.menu?.sessions, 1);
  });
});

describe('sin datos', () => {
  it('devuelve todo en cero sin romper', () => {
    const stats = aggregateFlowAnalytics([], graph, 'v1');
    assert.equal(stats.sessions_total, 0);
    assert.deepEqual(stats.nodes, {});
    assert.deepEqual(stats.edges, {});
  });
});
