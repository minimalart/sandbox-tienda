/**
 * DESHACER Y REHACER.
 *
 * Era la falta más cara del editor: borrar un paso se llevaba sus flechas, y la única
 * forma de volver atrás era recargar la página —perdiendo todo lo no guardado— o
 * redibujar a mano lo que se acababa de borrar. Con "Reemplazar por el base" al lado,
 * un clic equivocado costaba media hora.
 *
 * El historial guarda GRAFOS ENTEROS y no diffs. Un grafo del tamaño que se dibuja a
 * mano son unos pocos KB, cien entradas entran de sobra en memoria, y un diff mal
 * invertido deja un grafo corrupto que nadie va a poder explicar. La simplicidad acá
 * vale más que la memoria.
 *
 * ─── EL COALESCING ───────────────────────────────────────────────────────────────
 *
 * Sin agrupar, escribir "Hola" en un mensaje deja CUATRO entradas y deshacer borra una
 * letra por vez. Con una `key` por campo y una ventana de tiempo, el tipeo seguido en
 * el mismo campo es una sola entrada; cambiar de campo, o parar un segundo, abre otra.
 * Un arrastre siempre abre la suya: mover dos nodos son dos decisiones distintas.
 */

import type { Graph } from '../_editor';

/** Cuánto tiempo seguido en el mismo campo cuenta como una sola edición. */
export const COALESCE_MS = 800;

/**
 * Tope de entradas. Cien ediciones es mucho más de lo que alguien deshace de corrido,
 * y sin tope una sesión larga se come la memoria de la pestaña.
 */
export const HISTORY_LIMIT = 100;

export type History = {
  past: Graph[];
  present: Graph;
  future: Graph[];
  /** Qué se estaba editando en la última entrada, para poder agrupar. */
  lastKey?: string;
  lastAt?: number;
};

export const startHistory = (present: Graph): History => ({ past: [], present, future: [] });

export type PushOptions = {
  /** Identifica la edición: `${nodeId}:${campo}`. Sin clave, nunca agrupa. */
  key?: string;
  now?: number;
};

export function push(history: History, next: Graph, options: PushOptions = {}): History {
  if (next === history.present) return history;

  const now = options.now ?? Date.now();
  const agrupa =
    options.key !== undefined &&
    options.key === history.lastKey &&
    history.lastAt !== undefined &&
    now - history.lastAt < COALESCE_MS;

  // Agrupar es reemplazar el presente sin apilar: el estado anterior ya está en
  // `past` desde la primera tecla de esta misma edición.
  const past = agrupa ? history.past : [...history.past, history.present].slice(-HISTORY_LIMIT);

  return {
    past,
    present: next,
    // Editar después de deshacer descarta lo rehacible: seguir ofreciéndolo llevaría
    // a un grafo que mezcla dos ramas de historia.
    future: [],
    ...(options.key !== undefined ? { lastKey: options.key, lastAt: now } : {}),
  };
}

export const canUndo = (history: History): boolean => history.past.length > 0;
export const canRedo = (history: History): boolean => history.future.length > 0;

export function undo(history: History): History {
  const anterior = history.past[history.past.length - 1];
  if (!anterior) return history;
  return {
    past: history.past.slice(0, -1),
    present: anterior,
    future: [history.present, ...history.future],
    // Se corta el agrupamiento: la próxima edición no puede fundirse con la que se
    // acaba de deshacer.
  };
}

export function redo(history: History): History {
  const siguiente = history.future[0];
  if (!siguiente) return history;
  return {
    past: [...history.past, history.present],
    present: siguiente,
    future: history.future.slice(1),
  };
}

/**
 * Reemplaza todo el historial.
 *
 * Es para cuando el grafo cambia por algo que NO es una edición: la carga inicial o
 * "Reemplazar por el base". Deshacer hasta antes de una carga dejaría el canvas
 * mostrando un recorrido que ya no es el que se está editando.
 */
export const resetHistory = (present: Graph): History => startHistory(present);
