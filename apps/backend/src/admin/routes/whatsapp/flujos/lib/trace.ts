/**
 * EL CAMINO RECORRIDO, para pintarlo sobre el canvas.
 *
 * El simulador dice por qué nodos pasó la conversación, pero no por qué FLECHAS: el
 * motor guarda `visited` —una lista de ids de nodo— y nada más. Sin reconstruir las
 * flechas, el recorrido se vería como un puñado de tarjetas encendidas sueltas, que
 * es justamente lo que no deja seguir una rama.
 *
 * Reconstruirlas tiene una ambigüedad real: dos opciones distintas de la misma
 * pregunta pueden terminar en el mismo paso —"Sí" y "No" cerrando las dos en el
 * cierre es un recorrido normal— y ahí dos flechas unen los mismos nodos. Se
 * desempata con la RESPUESTA que quedó guardada para ese paso, que es la que el
 * motor usó para elegir.
 */

import type { FlowGraph } from './graph-contract';

export type Trace = {
  nodeIds: string[];
  edgeIds: string[];
  /** Lo recorrido en el ÚLTIMO turno: se resalta más fuerte que el resto. */
  currentNodeIds: string[];
  currentEdgeIds: string[];
};

export const EMPTY_TRACE: Trace = {
  nodeIds: [],
  edgeIds: [],
  currentNodeIds: [],
  currentEdgeIds: [],
};

export function traceOf(
  graph: FlowGraph,
  visited: readonly string[],
  answers: Readonly<Record<string, string>>,
  visitedBefore = 0,
): Trace {
  const nodeIds: string[] = [];
  const edgeIds: string[] = [];

  for (const [index, id] of visited.entries()) {
    if (!nodeIds.includes(id)) nodeIds.push(id);
    const siguiente = visited[index + 1];
    if (!siguiente) continue;
    const edge = pickEdge(graph, id, siguiente, answers[id]);
    if (edge && !edgeIds.includes(edge)) edgeIds.push(edge);
  }

  const desde = Math.max(0, Math.min(visitedBefore, visited.length));
  const delTurno = visited.slice(desde);
  const currentEdgeIds: string[] = [];
  for (const [index, id] of delTurno.entries()) {
    const siguiente = delTurno[index + 1];
    if (!siguiente) continue;
    const edge = pickEdge(graph, id, siguiente, answers[id]);
    if (edge && !currentEdgeIds.includes(edge)) currentEdgeIds.push(edge);
  }

  return { nodeIds, edgeIds, currentNodeIds: [...new Set(delTurno)], currentEdgeIds };
}

/**
 * Cuál de las flechas entre dos pasos se recorrió.
 *
 * Primero la que nombra la respuesta que el cliente eligió; después la única que hay;
 * al final la incondicional, y si nada de eso resuelve, la primera. El orden importa:
 * empezar por la incondicional pintaría la rama por default aunque el cliente haya
 * elegido otra cosa.
 */
function pickEdge(
  graph: FlowGraph,
  source: string,
  target: string,
  answer: string | undefined,
): string | null {
  const candidatas = graph.edges.filter((e) => e.source === source && e.target === target);
  if (candidatas.length === 0) return null;
  if (candidatas.length === 1) return candidatas[0]?.id ?? null;
  if (answer) {
    const porRespuesta = candidatas.find((e) => e.on === answer);
    if (porRespuesta) return porRespuesta.id;
  }
  const incondicional = candidatas.find((e) => !e.on && !e.when);
  return (incondicional ?? candidatas[0])?.id ?? null;
}
