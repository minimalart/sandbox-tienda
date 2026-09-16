import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { addNode, connect, patchNode, type Graph } from '../_editor';
import { copySubgraph, EMPTY_CLIP, pasteSubgraph, removeNodes } from './clipboard';

const EMPTY: Graph = { nodes: [], edges: [] };

/** `a → b → c`, con `a` fuera de lo que se va a copiar. */
function cadena(): Graph {
  let g = addNode(EMPTY, 'start').graph;
  g = addNode(g, 'message').graph;
  g = addNode(g, 'end').graph;
  g = connect(g, { source: 'start_1', target: 'message_1' });
  g = connect(g, { source: 'message_1', target: 'end_1' });
  return g;
}

describe('copiar un tramo', () => {
  it('se lleva los pasos elegidos', () => {
    const clip = copySubgraph(cadena(), ['message_1', 'end_1']);
    assert.deepEqual(clip.nodes.map((n) => n.id), ['message_1', 'end_1']);
  });

  it('sólo las flechas con LOS DOS extremos adentro', () => {
    // Una flecha con un extremo afuera no tiene a dónde pegarse: copiarla haría que
    // el tramo pegado se cuelgue del original, que no es lo que nadie espera.
    const clip = copySubgraph(cadena(), ['message_1', 'end_1']);
    assert.deepEqual(clip.edges.map((e) => e.id), ['e_2']);
  });

  it('copia por valor: editar la copia no toca el original', () => {
    let g = addNode(EMPTY, 'ask_buttons').graph;
    g = patchNode(g, 'ask_buttons_1', { options: [{ value: 'a', label: 'A' }] });
    const clip = copySubgraph(g, ['ask_buttons_1']);
    (clip.nodes[0]?.options as Array<{ label: string }>)[0]!.label = 'CAMBIADA';
    assert.equal(g.nodes[0]?.options?.[0]?.label, 'A');
  });

  it('copiar nada devuelve un clip vacío', () => {
    assert.deepEqual(copySubgraph(cadena(), []), EMPTY_CLIP);
  });
});

describe('pegar un tramo', () => {
  it('los pasos pegados tienen ids nuevos', () => {
    const graph = cadena();
    const clip = copySubgraph(graph, ['message_1', 'end_1']);
    const { graph: next, ids } = pasteSubgraph(graph, clip);

    assert.equal(next.nodes.length, 5);
    assert.equal(new Set(next.nodes.map((n) => n.id)).size, 5);
    assert.ok(!ids.includes('message_1'));
  });

  it('las flechas internas se remapean a los pasos nuevos', () => {
    const graph = cadena();
    const clip = copySubgraph(graph, ['message_1', 'end_1']);
    const { graph: next, ids } = pasteSubgraph(graph, clip);

    const nueva = next.edges.find((e) => ids.includes(e.source));
    assert.ok(nueva, 'la flecha copiada no apareció');
    assert.ok(ids.includes(nueva.target), 'quedó apuntando al paso original');
  });

  it('los ids de flecha tampoco chocan', () => {
    const graph = cadena();
    const clip = copySubgraph(graph, ['message_1', 'end_1']);
    const { graph: next } = pasteSubgraph(graph, clip);
    assert.equal(new Set(next.edges.map((e) => e.id)).size, next.edges.length);
  });

  it('pegar dos veces no colisiona', () => {
    const graph = cadena();
    const clip = copySubgraph(graph, ['message_1']);
    const una = pasteSubgraph(graph, clip);
    const dos = pasteSubgraph(una.graph, clip);
    assert.equal(new Set(dos.graph.nodes.map((n) => n.id)).size, dos.graph.nodes.length);
  });

  it('el tramo pegado queda corrido, no encima del original', () => {
    let graph = addNode(EMPTY, 'message', { x: 100, y: 100 }).graph;
    const clip = copySubgraph(graph, ['message_1']);
    const { graph: next, ids } = pasteSubgraph(graph, clip);
    const copia = next.nodes.find((n) => n.id === ids[0]);
    assert.notDeepEqual(copia?.position, { x: 100, y: 100 });
  });

  it('una entrada pegada NO duplica el catch-all', () => {
    // Tiene que haber exactamente uno: duplicarlo deja el recorrido impublicable y el
    // error apunta a un paso que el operador acaba de pegar sin mirar.
    let graph = addNode(EMPTY, 'start').graph;
    graph = patchNode(graph, 'start_1', { match: { keywords: ['hola'], fallback: true } });
    const clip = copySubgraph(graph, ['start_1']);
    const { graph: next, ids } = pasteSubgraph(graph, clip);

    const copia = next.nodes.find((n) => n.id === ids[0]);
    assert.equal(copia?.match?.fallback, undefined);
    assert.deepEqual(copia?.match?.keywords, ['hola']);
    assert.equal(next.nodes.filter((n) => n.match?.fallback).length, 1);
  });

  it('pero si el grafo NO tiene catch-all, la copia se lo queda', () => {
    let origen = addNode(EMPTY, 'start').graph;
    origen = patchNode(origen, 'start_1', { match: { fallback: true } });
    const clip = copySubgraph(origen, ['start_1']);

    const { graph: next, ids } = pasteSubgraph(EMPTY, clip);
    assert.equal(next.nodes.find((n) => n.id === ids[0])?.match?.fallback, true);
  });

  it('pegar un clip vacío no cambia nada', () => {
    const graph = cadena();
    assert.equal(pasteSubgraph(graph, EMPTY_CLIP).graph, graph);
  });
});

describe('borrar varios pasos de una', () => {
  it('se lleva sus flechas', () => {
    const next = removeNodes(cadena(), ['message_1', 'end_1']);
    assert.deepEqual(next.nodes.map((n) => n.id), ['start_1']);
    assert.deepEqual(next.edges, []);
  });

  it('borrar nada no cambia nada', () => {
    const graph = cadena();
    assert.deepEqual(removeNodes(graph, []), graph);
  });
});
