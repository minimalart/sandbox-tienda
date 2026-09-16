import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { SEED_GRAPH } from '../../../../../lib/whatsapp/flow/seed';
import type { FlowGraph } from './graph-contract';
import { sendText, startSession, tap } from './simulator';
import { traceOf } from './trace';

describe('reconstruir por qué flechas pasó la conversación', () => {
  it('una cadena lineal enciende todos sus pasos y sus flechas', () => {
    const graph: FlowGraph = {
      nodes: [
        { id: 'a', type: 'start', match: { fallback: true } },
        { id: 'b', type: 'message', body: 'Hola' },
        { id: 'c', type: 'end', body: 'Chau' },
      ],
      edges: [
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e2', source: 'b', target: 'c' },
      ],
    };
    const trace = traceOf(graph, ['a', 'b', 'c'], {});
    assert.deepEqual(trace.nodeIds, ['a', 'b', 'c']);
    assert.deepEqual(trace.edgeIds, ['e1', 'e2']);
  });

  it('con DOS flechas entre los mismos pasos, elige la de la respuesta elegida', () => {
    // "Sí" y "No" cerrando las dos en el mismo fin es un recorrido normal. Sin
    // desempatar por la respuesta, el camino resaltaría la rama equivocada.
    const graph: FlowGraph = {
      nodes: [
        { id: 'q', type: 'ask_buttons', body: '¿?', options: [
          { value: 'si', label: 'Sí' },
          { value: 'no', label: 'No' },
        ] },
        { id: 'fin', type: 'end', body: 'Listo' },
      ],
      edges: [
        { id: 'e_si', source: 'q', target: 'fin', on: 'si' },
        { id: 'e_no', source: 'q', target: 'fin', on: 'no' },
      ],
    };
    assert.deepEqual(traceOf(graph, ['q', 'fin'], { q: 'no' }).edgeIds, ['e_no']);
    assert.deepEqual(traceOf(graph, ['q', 'fin'], { q: 'si' }).edgeIds, ['e_si']);
  });

  it('sin respuesta guardada toma la incondicional, no la primera', () => {
    // Empezar por la primera pintaría una rama condicional que no se recorrió.
    const graph: FlowGraph = {
      nodes: [
        { id: 'a', type: 'action', tool: 'wa_search_products' },
        { id: 'b', type: 'end', body: 'Listo' },
      ],
      edges: [
        { id: 'e_cond', source: 'a', target: 'b', when: { path: 'vars.x', op: 'exists' } },
        { id: 'e_libre', source: 'a', target: 'b' },
      ],
    };
    assert.deepEqual(traceOf(graph, ['a', 'b'], {}).edgeIds, ['e_libre']);
  });

  it('un paso visitado dos veces no se repite', () => {
    const graph: FlowGraph = {
      nodes: [
        { id: 'a', type: 'start', match: { fallback: true } },
        { id: 'b', type: 'message', body: 'Hola' },
      ],
      edges: [{ id: 'e1', source: 'a', target: 'b' }],
    };
    assert.deepEqual(traceOf(graph, ['a', 'b', 'a', 'b'], {}).nodeIds, ['a', 'b']);
    assert.deepEqual(traceOf(graph, ['a', 'b', 'a', 'b'], {}).edgeIds, ['e1']);
  });

  it('el último turno se distingue del resto del camino', () => {
    // Es lo que deja ver qué acaba de pasar cuando el recorrido ya lleva diez pasos
    // encendidos: sin la distinción, cada turno nuevo se pierde entre los anteriores.
    const graph: FlowGraph = {
      nodes: [
        { id: 'a', type: 'start', match: { fallback: true } },
        { id: 'b', type: 'message', body: 'Hola' },
        { id: 'c', type: 'end', body: 'Chau' },
      ],
      edges: [
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e2', source: 'b', target: 'c' },
      ],
    };
    const trace = traceOf(graph, ['a', 'b', 'c'], {}, 2);
    assert.deepEqual(trace.currentNodeIds, ['c']);
    assert.deepEqual(trace.currentEdgeIds, []);
    assert.deepEqual(trace.nodeIds, ['a', 'b', 'c']);
  });

  it('sin nada recorrido no enciende nada', () => {
    assert.deepEqual(traceOf(SEED_GRAPH, [], {}).nodeIds, []);
    assert.deepEqual(traceOf(SEED_GRAPH, [], {}).edgeIds, []);
  });

  it('una flecha que ya no existe no rompe la traza', () => {
    // El operador puede borrar un paso con la prueba abierta.
    const graph: FlowGraph = { nodes: [{ id: 'a', type: 'message' }], edges: [] };
    assert.deepEqual(traceOf(graph, ['a', 'borrado'], {}).edgeIds, []);
  });
});

describe('la traza de una prueba real', () => {
  it('sobre el recorrido base, el camino de compra enciende sus flechas', () => {
    let s = sendText(SEED_GRAPH, startSession(), 'hola');
    s = tap(SEED_GRAPH, s, 'flow:menu:buy');
    const trace = traceOf(SEED_GRAPH, s.state.visited, s.state.answers, s.visitedBefore);

    assert.ok(trace.nodeIds.includes('menu'));
    assert.ok(trace.nodeIds.includes('sabe_producto'));
    // La flecha que se tomó es la de la opción "Comprar productos", no otra.
    assert.ok(trace.edgeIds.includes('e_buy'));
    assert.ok(!trace.edgeIds.includes('e_help'));
  });

  it('todas las flechas encendidas existen en el grafo', () => {
    let s = sendText(SEED_GRAPH, startSession(), 'hola');
    s = tap(SEED_GRAPH, s, 'flow:menu:help');
    s = tap(SEED_GRAPH, s, 'flow:ayuda:persona');
    const trace = traceOf(SEED_GRAPH, s.state.visited, s.state.answers, s.visitedBefore);

    for (const id of trace.edgeIds) {
      assert.ok(SEED_GRAPH.edges.some((e) => e.id === id), `${id} no existe`);
    }
  });
});
