/**
 * COPIAR Y PEGAR UN TRAMO DEL RECORRIDO.
 *
 * Los recorridos reales repiten estructuras: "preguntá, si dice que sí hacé esto, si
 * no derivá" aparece igual en compras, en pedidos y en devoluciones. Rehacerla a mano
 * cada vez son quince clics y una oportunidad de olvidarse una flecha.
 *
 * ─── LAS DOS REGLAS QUE NO SON OBVIAS ────────────────────────────────────────────
 *
 * 1. SÓLO SE COPIAN LAS FLECHAS INTERNAS. Una flecha con un extremo afuera de lo
 *    seleccionado no tiene a dónde pegarse: copiarla apuntando al nodo original haría
 *    que el tramo pegado se cuelgue del viejo y el operador vería su copia "conectada"
 *    a algo que no copió.
 * 2. EL CATCH-ALL NO SE DUPLICA. Tiene que haber exactamente uno en el grafo: pegar
 *    una entrada que lo tenga dejaría el recorrido impublicable de entrada, y el
 *    mensaje de error apuntaría a un nodo que el operador acaba de pegar sin mirar.
 */

import { nextEdgeId, nextNodeId, type Graph, type GraphEdge, type GraphNode } from '../_editor';
import { nudgeFree, type XY } from './placement';

export type Clip = { nodes: GraphNode[]; edges: GraphEdge[] };

export const EMPTY_CLIP: Clip = { nodes: [], edges: [] };

/** Copia profunda de un tramo. Devuelve un clip vacío si no hay nada seleccionado. */
export function copySubgraph(graph: Graph, ids: readonly string[]): Clip {
  const dentro = new Set(ids);
  const nodes = graph.nodes.filter((n) => dentro.has(n.id)).map(clonarNodo);
  const edges = graph.edges
    .filter((e) => dentro.has(e.source) && dentro.has(e.target))
    .map((e) => ({ ...e, ...(e.when ? { when: { ...e.when } } : {}) }));
  return { nodes, edges };
}

export function pasteSubgraph(
  graph: Graph,
  clip: Clip,
  offset: XY = { x: 40, y: 40 },
): { graph: Graph; ids: string[] } {
  if (clip.nodes.length === 0) return { graph, ids: [] };

  const hayCatchAll = graph.nodes.some((n) => n.type === 'start' && n.match?.fallback);
  const ocupadas = graph.nodes.map((n) => n.position);

  // Los ids nuevos se reservan contra un grafo que va creciendo, o dos nodos del mismo
  // tipo en el mismo clip saldrían con el mismo id.
  let acumulado: Graph = graph;
  const mapa = new Map<string, string>();

  for (const original of clip.nodes) {
    const id = nextNodeId(acumulado, original.type);
    mapa.set(original.id, id);

    const copia: GraphNode = {
      ...clonarNodo(original),
      id,
      position: nudgeFree(
        {
          x: (original.position?.x ?? 0) + offset.x,
          y: (original.position?.y ?? 0) + offset.y,
        },
        ocupadas,
      ),
    };

    if (copia.type === 'start' && copia.match?.fallback && hayCatchAll) {
      const sinFallback = { ...copia.match };
      delete sinFallback.fallback;
      if (Object.keys(sinFallback).length) copia.match = sinFallback;
      else delete copia.match;
    }

    ocupadas.push(copia.position);
    acumulado = { nodes: [...acumulado.nodes, copia], edges: acumulado.edges };
  }

  for (const original of clip.edges) {
    const source = mapa.get(original.source);
    const target = mapa.get(original.target);
    if (!source || !target) continue;
    acumulado = {
      nodes: acumulado.nodes,
      edges: [...acumulado.edges, { ...original, id: nextEdgeId(acumulado), source, target }],
    };
  }

  return { graph: acumulado, ids: [...mapa.values()] };
}

/** Borra varios pasos de una, con sus flechas. */
export function removeNodes(graph: Graph, ids: readonly string[]): Graph {
  const fuera = new Set(ids);
  return {
    nodes: graph.nodes.filter((n) => !fuera.has(n.id)),
    edges: graph.edges.filter((e) => !fuera.has(e.source) && !fuera.has(e.target)),
  };
}

function clonarNodo(node: GraphNode): GraphNode {
  return {
    ...node,
    ...(node.options ? { options: node.options.map((o) => ({ ...o })) } : {}),
    ...(node.branches
      ? { branches: node.branches.map((b) => ({ ...b, ...(b.when ? { when: { ...b.when } } : {}) })) }
      : {}),
    ...(node.args ? { args: { ...node.args } } : {}),
    ...(node.match ? { match: { ...node.match } } : {}),
    ...(node.position ? { position: { ...node.position } } : {}),
  };
}
