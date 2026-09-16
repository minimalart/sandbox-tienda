import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { connect, declaredOutputValues, type Graph } from '../_editor';
import { FLOW_TIMEOUT_ON } from './graph-contract';
import { handleOf, outputsOf } from './registry';
import { toCanvas } from './to-canvas';

/** Una pregunta con plazo y dos destinos: la respuesta y el vencimiento. */
const GRAFO: Graph = {
  nodes: [
    { id: 'inicio', type: 'start', match: { fallback: true } },
    {
      id: 'pregunta',
      type: 'ask_buttons',
      body: '¿Seguimos?',
      options: [{ value: 'opcion_1', label: 'Sí' }],
      timeout_seconds: 900,
    },
    { id: 'sigue', type: 'message', body: 'Dale.' },
    { id: 'insiste', type: 'message', body: '¿Seguís ahí?' },
  ],
  edges: [
    { id: 'e0', source: 'inicio', target: 'pregunta' },
    { id: 'e1', source: 'pregunta', target: 'sigue', on: 'opcion_1' },
  ],
};

const salidas = (g: Graph, nodeId: string) => {
  const node = g.nodes.find((n) => n.id === nodeId) as Graph['nodes'][number];
  return outputsOf(node, g.edges.filter((e) => e.source === nodeId));
};

describe('la salida "Si no contesta" en el canvas', () => {
  it('aparece cuando el paso tiene plazo', () => {
    const out = salidas(GRAFO, 'pregunta');
    assert.equal(out.at(-1)?.id, FLOW_TIMEOUT_ON);
    assert.equal(out.at(-1)?.kind, 'timeout');
  });

  it('va última: es la excepción, no una respuesta más', () => {
    // Leerla entre los botones haría dudar de cuál es el camino normal.
    const out = salidas(GRAFO, 'pregunta');
    assert.deepEqual(
      out.map((o) => o.id),
      ['opcion_1', FLOW_TIMEOUT_ON],
    );
  });

  it('no aparece si el paso no tiene plazo', () => {
    const sinPlazo: Graph = {
      ...GRAFO,
      nodes: GRAFO.nodes.map((n) => (n.id === 'pregunta' ? { ...n, timeout_seconds: undefined } : n)),
    };
    assert.ok(!salidas(sinPlazo, 'pregunta').some((o) => o.kind === 'timeout'));
  });

  it('se dibuja igual si le sacaron el plazo pero la flecha sigue ahí', () => {
    // Un conector que desaparece deja su flecha sin dónde engancharse y React Flow
    // la borra del dibujo sin decir nada: se perdería trabajo en silencio.
    const huerfana: Graph = {
      nodes: GRAFO.nodes.map((n) => (n.id === 'pregunta' ? { ...n, timeout_seconds: undefined } : n)),
      edges: [...GRAFO.edges, { id: 'e2', source: 'pregunta', target: 'insiste', on: FLOW_TIMEOUT_ON }],
    };
    assert.ok(salidas(huerfana, 'pregunta').some((o) => o.id === FLOW_TIMEOUT_ON));
  });

  it('sin cablear se ve sin cablear', () => {
    assert.equal(salidas(GRAFO, 'pregunta').at(-1)?.wired, false);
  });

  it('cableada se ve cableada', () => {
    const cableada: Graph = {
      ...GRAFO,
      edges: [...GRAFO.edges, { id: 'e2', source: 'pregunta', target: 'insiste', on: FLOW_TIMEOUT_ON }],
    };
    assert.equal(salidas(cableada, 'pregunta').at(-1)?.wired, true);
  });
});

describe('la flecha del plazo no se confunde con la normal', () => {
  it('una pregunta abierta con plazo cableado sigue mostrando su salida sin conectar', () => {
    // Contar todas las flechas daría la salida normal por resuelta, y es justo la
    // que falta: el recorrido se cortaría cuando el cliente SÍ contesta.
    const abierta: Graph = {
      nodes: [
        { id: 'inicio', type: 'start', match: { fallback: true } },
        { id: 'texto', type: 'ask_text', body: '¿Qué buscás?', timeout_seconds: 300 },
        { id: 'insiste', type: 'message', body: '¿Seguís ahí?' },
      ],
      edges: [
        { id: 'e0', source: 'inicio', target: 'texto' },
        { id: 'e1', source: 'texto', target: 'insiste', on: FLOW_TIMEOUT_ON },
      ],
    };
    const out = salidas(abierta, 'texto');
    assert.equal(out.find((o) => o.kind === 'single')?.wired, false);
    assert.equal(out.find((o) => o.kind === 'timeout')?.wired, true);
  });

  it('no inventa una "Salida sin opción" para la flecha del plazo', () => {
    const cableada: Graph = {
      ...GRAFO,
      edges: [...GRAFO.edges, { id: 'e2', source: 'pregunta', target: 'insiste', on: FLOW_TIMEOUT_ON }],
    };
    assert.ok(!salidas(cableada, 'pregunta').some((o) => o.kind === 'legacy'));
  });
});

describe('conectar desde la salida del plazo', () => {
  it('la flecha nace atada al vencimiento y no a la salida normal', () => {
    const next = connect(GRAFO, {
      source: 'pregunta',
      target: 'insiste',
      sourceHandle: FLOW_TIMEOUT_ON,
    });
    assert.equal(next.edges.find((e) => e.target === 'insiste')?.on, FLOW_TIMEOUT_ON);
  });

  it('el vencimiento es una salida declarada del paso', () => {
    const node = GRAFO.nodes.find((n) => n.id === 'pregunta');
    assert.ok(declaredOutputValues(node).includes(FLOW_TIMEOUT_ON));
  });

  it('un paso sin plazo no declara ese valor', () => {
    const node = { ...(GRAFO.nodes[1] as Graph['nodes'][number]), timeout_seconds: undefined };
    assert.ok(!declaredOutputValues(node).includes(FLOW_TIMEOUT_ON));
  });

  it('una sola flecha por vencimiento', () => {
    const una = connect(GRAFO, { source: 'pregunta', target: 'insiste', sourceHandle: FLOW_TIMEOUT_ON });
    const dos = connect(una, { source: 'pregunta', target: 'sigue', sourceHandle: FLOW_TIMEOUT_ON });
    assert.equal(dos.edges.filter((e) => e.on === FLOW_TIMEOUT_ON).length, 1);
  });
});

describe('la proyección al canvas', () => {
  it('la flecha del plazo sale del conector del plazo', () => {
    // Un `sourceHandle` que no existe en la tarjeta es el error 008 de React Flow:
    // la arista desaparece del dibujo sin ningún aviso.
    const cableada: Graph = {
      ...GRAFO,
      edges: [...GRAFO.edges, { id: 'e2', source: 'pregunta', target: 'insiste', on: FLOW_TIMEOUT_ON }],
    };
    const { nodes, edges } = toCanvas(cableada, { issues: [], isDark: false, selectedIds: [], selectedEdgeId: null });
    const handles = new Set(
      nodes.flatMap((n) => (n.data as { outputs: Array<{ id: string }> }).outputs.map((o) => o.id)),
    );
    for (const edge of edges) {
      assert.ok(edge.sourceHandle, `la arista ${edge.id} salió sin conector`);
      assert.ok(handles.has(edge.sourceHandle as string), `conector inexistente: ${edge.sourceHandle}`);
    }
  });

  it('handleOf devuelve el conector del plazo y no el default', () => {
    const out = salidas(GRAFO, 'pregunta');
    assert.equal(
      handleOf({ id: 'e2', source: 'pregunta', target: 'insiste', on: FLOW_TIMEOUT_ON }, out),
      FLOW_TIMEOUT_ON,
    );
  });
});
