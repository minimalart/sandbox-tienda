/**
 * QUÉ CAMBIÓ entre el recorrido que está atendiendo y el que se está por publicar.
 *
 * Publicar reemplaza lo que atiende a TODOS los clientes, y hasta acá se apretaba el
 * botón a ciegas: el editor no tenía forma de decir "esto agrega dos pasos y le cambia
 * el texto a otro". En un recorrido de quince pasos editado a lo largo de una semana,
 * acordarse de lo que uno tocó no es una estrategia.
 *
 * LAS POSICIONES NO CUENTAN. Acomodar el diagrama no cambia lo que el cliente recibe,
 * y si contaran, mover una tarjeta marcaría el recorrido entero como distinto y el
 * resumen dejaría de decir nada.
 *
 * Vive en el admin y no junto a `graph.ts` porque comparar es una necesidad del
 * editor: el servidor no compara nada. Si algún día una respuesta de la API necesita
 * el diff, se muda y entra al contrato como los otros.
 */

import type { Graph, GraphEdge, GraphNode } from '../_editor';

/** Los campos de un paso que SÍ cambian lo que recibe el cliente. */
const CAMPOS: ReadonlyArray<keyof GraphNode> = [
  'type',
  'label',
  'body',
  'options',
  'branches',
  'optionsFrom',
  'listButton',
  'tool',
  'args',
  'silent',
  'reason',
  'match',
];

export type NodeChange = { id: string; fields: string[] };

export type GraphDiff = {
  nodes: { added: string[]; removed: string[]; changed: NodeChange[] };
  edges: { added: string[]; removed: string[] };
  /** `true` si no hay ninguna diferencia que le cambie algo al cliente. */
  same: boolean;
};

export const EMPTY_DIFF: GraphDiff = {
  nodes: { added: [], removed: [], changed: [] },
  edges: { added: [], removed: [] },
  same: true,
};

/** `base` es lo que está publicado; `next`, el borrador. */
export function diffGraphs(base: Graph, next: Graph): GraphDiff {
  const antes = new Map(base.nodes.map((n) => [n.id, n]));
  const ahora = new Map(next.nodes.map((n) => [n.id, n]));

  const added = next.nodes.filter((n) => !antes.has(n.id)).map((n) => n.id);
  const removed = base.nodes.filter((n) => !ahora.has(n.id)).map((n) => n.id);

  const changed: NodeChange[] = [];
  for (const node of next.nodes) {
    const previo = antes.get(node.id);
    if (!previo) continue;
    const fields = CAMPOS.filter((campo) => !igual(previo[campo], node[campo]));
    if (fields.length > 0) changed.push({ id: node.id, fields: fields.map(String) });
  }

  // Las flechas se comparan por su FORMA —de dónde a dónde, por qué salida y con qué
  // condición— y no por id: una flecha que se borró y se volvió a dibujar igual no es
  // un cambio para el cliente, aunque le haya cambiado el id.
  const formaAntes = new Map(base.edges.map((e) => [formaDe(e), e.id]));
  const formaAhora = new Map(next.edges.map((e) => [formaDe(e), e.id]));

  const edgesAdded = next.edges.filter((e) => !formaAntes.has(formaDe(e))).map((e) => e.id);
  const edgesRemoved = base.edges.filter((e) => !formaAhora.has(formaDe(e))).map((e) => e.id);

  const same =
    added.length === 0 &&
    removed.length === 0 &&
    changed.length === 0 &&
    edgesAdded.length === 0 &&
    edgesRemoved.length === 0;

  return {
    nodes: { added, removed, changed },
    edges: { added: edgesAdded, removed: edgesRemoved },
    same,
  };
}

const formaDe = (edge: GraphEdge): string =>
  `${edge.source}→${edge.target}|${edge.on ?? ''}|${edge.when ? JSON.stringify(edge.when) : ''}`;

/**
 * Comparación por VALOR, tolerante con lo que el editor guarda de formas distintas.
 *
 * `undefined` y ausente son lo mismo; una cadena vacía y `undefined` también, porque
 * el editor borra las claves vacías en unos campos y las deja en otros. Sin esa
 * tolerancia, abrir un paso y cerrarlo sin tocar nada lo marcaba como cambiado.
 */
function igual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (vacio(a) && vacio(b)) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

const vacio = (value: unknown): boolean =>
  value === undefined ||
  value === null ||
  value === '' ||
  (Array.isArray(value) && value.length === 0);

/** Un resumen en una línea, para el botón de publicar. */
export function describeDiff(diff: GraphDiff): string {
  if (diff.same) return 'No hay cambios respecto de lo publicado.';
  const partes: string[] = [];
  const decir = (n: number, singular: string, plural: string) =>
    `${n} ${n === 1 ? singular : plural}`;

  if (diff.nodes.added.length) partes.push(decir(diff.nodes.added.length, 'paso nuevo', 'pasos nuevos'));
  if (diff.nodes.changed.length)
    partes.push(decir(diff.nodes.changed.length, 'paso modificado', 'pasos modificados'));
  if (diff.nodes.removed.length)
    partes.push(decir(diff.nodes.removed.length, 'paso borrado', 'pasos borrados'));
  if (diff.edges.added.length)
    partes.push(decir(diff.edges.added.length, 'conexión nueva', 'conexiones nuevas'));
  if (diff.edges.removed.length)
    partes.push(decir(diff.edges.removed.length, 'conexión borrada', 'conexiones borradas'));

  return partes.join(' · ');
}

/** El estado de un paso en la comparación, para pintarlo. */
export type DiffState = 'added' | 'removed' | 'changed' | 'same';

export function nodeDiffState(diff: GraphDiff, id: string): DiffState {
  if (diff.nodes.added.includes(id)) return 'added';
  if (diff.nodes.removed.includes(id)) return 'removed';
  if (diff.nodes.changed.some((c) => c.id === id)) return 'changed';
  return 'same';
}

export function edgeDiffState(diff: GraphDiff, id: string): DiffState {
  if (diff.edges.added.includes(id)) return 'added';
  if (diff.edges.removed.includes(id)) return 'removed';
  return 'same';
}
