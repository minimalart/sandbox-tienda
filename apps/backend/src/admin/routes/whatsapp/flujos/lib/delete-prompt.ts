/**
 * QUÉ SE VA A LLEVAR UN BORRADO, dicho antes de hacerlo.
 *
 * Borrar un paso no borra sólo el paso: se lleva TODAS sus conexiones, las que salen y
 * las que llegan. En un recorrido de treinta flechas eso puede desarmar dos ramas que
 * el operador no está mirando, y hasta acá pasaba sin preguntar nada.
 *
 * El conteo es lo que hace que la pregunta sirva. "¿Seguro?" no aporta información —
 * la respuesta es siempre sí—; "se va a borrar este paso y las 3 conexiones que lo
 * tocan" es lo que hace frenar cuando el número no es el que uno esperaba.
 */

import { TYPE_LABEL, type Graph } from '../_editor';

export type PendingDelete =
  | { kind: 'nodes'; ids: readonly string[] }
  | { kind: 'edge'; id: string };

export type DeletePrompt = { title: string; description: string };

const plural = (n: number, singular: string, muchos: string): string =>
  `${n} ${n === 1 ? singular : muchos}`;

export function describeDeletion(graph: Graph, pending: PendingDelete): DeletePrompt {
  if (pending.kind === 'edge') {
    const edge = graph.edges.find((e) => e.id === pending.id);
    const desde = graph.nodes.find((n) => n.id === edge?.source);
    const hasta = graph.nodes.find((n) => n.id === edge?.target);
    return {
      title: 'Borrar esta conexión',
      description: desde && hasta
        ? `El recorrido deja de ir de "${nombre(desde)}" a "${nombre(hasta)}". El paso de destino queda sin esa entrada.`
        : 'El recorrido deja de pasar por esta conexión.',
    };
  }

  const ids = new Set(pending.ids);
  const nodos = graph.nodes.filter((n) => ids.has(n.id));
  // Las que se van con ellos: salientes Y entrantes. Contar sólo las salientes
  // escondería justamente las que rompen el recorrido de otro lado.
  const conexiones = graph.edges.filter((e) => ids.has(e.source) || ids.has(e.target)).length;

  if (nodos.length === 1) {
    const node = nodos[0];
    return {
      title: `Borrar "${nombre(node as NonNullable<typeof node>)}"`,
      description: conexiones === 0
        ? 'No tiene ninguna conexión, así que no se lleva nada más.'
        : `Se lleva también ${plural(conexiones, 'la conexión que lo toca', 'las conexiones que lo tocan')}.`,
    };
  }

  return {
    title: `Borrar ${plural(nodos.length, 'paso', 'pasos')}`,
    description: conexiones === 0
      ? 'No tienen conexiones, así que no se llevan nada más.'
      : `Se llevan también ${plural(conexiones, 'conexión', 'conexiones')}.`,
  };
}

/** Cómo se lo nombra: el nombre que le puso el operador, o el tipo. */
const nombre = (node: Graph['nodes'][number]): string =>
  (node.label ?? '').trim() || TYPE_LABEL[node.type] || node.id;
