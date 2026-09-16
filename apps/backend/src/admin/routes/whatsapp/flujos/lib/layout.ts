/**
 * ORGANIZAR EL RECORRIDO AUTOMÁTICAMENTE.
 *
 * Un recorrido que creció a fuerza de agregar pasos queda con las tarjetas donde
 * cayeron y las flechas cruzándose: legible sólo para quien lo dibujó. Esto lo acomoda
 * en capas, de arriba hacia abajo, siguiendo la dirección en la que corre la
 * conversación.
 *
 * ES UNA ACCIÓN, NUNCA AUTOMÁTICO. Que el canvas se reacomode solo mientras alguien
 * dibuja es de las cosas más frustrantes que puede hacer un editor: se pierde el mapa
 * mental de dónde estaba cada cosa. Se aprieta un botón, y se puede deshacer.
 *
 * Sin dagre ni elk: son dependencias nuevas y el problema acá es chico —recorridos de
 * decenas de nodos, no de miles—. Capas por camino más largo y orden por baricentro
 * alcanzan, y así se puede probar.
 */

import type { Graph, GraphNode } from '../_editor';
import { CARD_WIDTH, type XY } from './placement';

export type LayoutOptions = {
  /** Alto real de cada tarjeta, medido por el canvas. Sin dato, uno razonable. */
  heightOf?: (id: string) => number;
  gapX?: number;
  gapY?: number;
  origin?: XY;
};

const ALTO_POR_DEFECTO = 96;

/**
 * Devuelve la posición de cada paso. No toca nodos ni flechas: el llamador las aplica
 * con `applyPositions`, así queda como una edición más y se puede deshacer.
 */
export function autoLayout(graph: Graph, options: LayoutOptions = {}): Map<string, XY> {
  const gapX = options.gapX ?? 60;
  const gapY = options.gapY ?? 70;
  const origin = options.origin ?? { x: 40, y: 40 };
  const alto = options.heightOf ?? (() => ALTO_POR_DEFECTO);

  const capas = repartirEnCapas(graph);
  const orden = ordenarPorBaricentro(graph, capas);

  const posiciones = new Map<string, XY>();
  let y = origin.y;

  for (const capa of orden) {
    const anchoTotal = capa.length * CARD_WIDTH + Math.max(0, capa.length - 1) * gapX;
    let x = origin.x - anchoTotal / 2;
    let altoDeLaCapa = 0;

    for (const id of capa) {
      posiciones.set(id, { x: Math.round(x), y: Math.round(y) });
      x += CARD_WIDTH + gapX;
      altoDeLaCapa = Math.max(altoDeLaCapa, alto(id));
    }

    y += altoDeLaCapa + gapY;
  }

  return posiciones;
}

/**
 * En qué capa cae cada paso: el camino MÁS LARGO desde una entrada.
 *
 * El más largo y no el más corto porque un paso al que se llega por dos caminos tiene
 * que dibujarse debajo del más profundo de los dos; con el más corto, la flecha larga
 * apuntaría hacia arriba y el diagrama se lee al revés.
 *
 * Los ciclos son legítimos —"agregar algo más" vuelve a la búsqueda— así que se cortan
 * por nodos ya visitados en el camino actual en vez de rechazarlos.
 */
function repartirEnCapas(graph: Graph): string[][] {
  const salientes = new Map<string, string[]>();
  for (const edge of graph.edges) {
    salientes.set(edge.source, [...(salientes.get(edge.source) ?? []), edge.target]);
  }

  const profundidad = new Map<string, number>();
  const entradas = graph.nodes.filter((n) => n.type === 'start').map((n) => n.id);
  // Sin ninguna entrada —un recorrido a medio armar— se arranca por los nodos a los
  // que no llega ninguna flecha, para no devolver todo apilado en una sola capa.
  const raices = entradas.length > 0 ? entradas : sinEntrantes(graph);

  const recorrer = (id: string, nivel: number, enCamino: Set<string>) => {
    if (enCamino.has(id)) return;
    if ((profundidad.get(id) ?? -1) >= nivel) return;
    profundidad.set(id, nivel);
    const siguiente = new Set(enCamino).add(id);
    for (const destino of salientes.get(id) ?? []) recorrer(destino, nivel + 1, siguiente);
  };

  for (const raiz of raices) recorrer(raiz, 0, new Set());

  // Los inalcanzables van al final, juntos: son un problema que el validador ya
  // reporta, y mezclarlos con el recorrido los volvería invisibles.
  const maxima = Math.max(-1, ...profundidad.values());
  for (const node of graph.nodes) {
    if (!profundidad.has(node.id)) profundidad.set(node.id, maxima + 1);
  }

  const capas: string[][] = [];
  for (const node of graph.nodes) {
    const nivel = profundidad.get(node.id) ?? 0;
    (capas[nivel] ??= []).push(node.id);
  }
  return capas.filter(Boolean);
}

const sinEntrantes = (graph: Graph): string[] => {
  const conEntrada = new Set(graph.edges.map((e) => e.target));
  return graph.nodes.filter((n) => !conEntrada.has(n.id)).map((n) => n.id);
};

/**
 * Ordena cada capa para que las flechas se crucen lo menos posible.
 *
 * Cada paso se ubica cerca del promedio de la posición de sus padres, y se desempata
 * por la `x` que YA tenía: así, dos recorridos con la misma forma pero dibujados
 * distinto no se reordenan al azar, y apretar el botón dos veces da lo mismo.
 */
function ordenarPorBaricentro(graph: Graph, capas: string[][]): string[][] {
  const padres = new Map<string, string[]>();
  for (const edge of graph.edges) {
    padres.set(edge.target, [...(padres.get(edge.target) ?? []), edge.source]);
  }
  const xActual = new Map(graph.nodes.map((n): [string, number] => [n.id, n.position?.x ?? 0]));

  const ordenadas = capas.map((capa) => [...capa]);

  // Dos pasadas hacia abajo: una sola deja la tercera capa ordenada contra una segunda
  // que todavía no se había acomodado.
  for (let pasada = 0; pasada < 2; pasada++) {
    const indice = new Map<string, number>();
    for (const capa of ordenadas) capa.forEach((id, i) => indice.set(id, i));

    for (const [nivel, capa] of ordenadas.entries()) {
      if (nivel === 0) continue;
      const peso = new Map<string, number>();
      for (const id of capa) {
        const deQuienesViene = (padres.get(id) ?? [])
          .map((p) => indice.get(p))
          .filter((v): v is number => v !== undefined);
        peso.set(
          id,
          deQuienesViene.length
            ? deQuienesViene.reduce((a, b) => a + b, 0) / deQuienesViene.length
            : Number.MAX_SAFE_INTEGER,
        );
      }
      capa.sort((a, b) => {
        const diferencia = (peso.get(a) ?? 0) - (peso.get(b) ?? 0);
        if (diferencia !== 0) return diferencia;
        return (xActual.get(a) ?? 0) - (xActual.get(b) ?? 0);
      });
    }
  }

  return ordenadas;
}

/** Las posiciones ya en la forma que espera `applyPositions`. */
export const asPositionList = (
  positions: Map<string, XY>,
): Array<{ id: string; position: XY }> =>
  [...positions.entries()].map(([id, position]) => ({ id, position }));

/** `true` si acomodar cambiaría algo: evita marcar el borrador sucio para nada. */
export function wouldMove(graph: Graph, positions: Map<string, XY>): boolean {
  return graph.nodes.some((node: GraphNode) => {
    const destino = positions.get(node.id);
    if (!destino) return false;
    return node.position?.x !== destino.x || node.position?.y !== destino.y;
  });
}
