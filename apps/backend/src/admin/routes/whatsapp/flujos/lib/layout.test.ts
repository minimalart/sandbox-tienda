import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { SEED_GRAPH } from '../../../../../lib/whatsapp/flow/seed';
import { applyPositions, type Graph } from '../_editor';
import { asPositionList, autoLayout, wouldMove } from './layout';

const y = (posiciones: Map<string, { x: number; y: number }>, id: string) => posiciones.get(id)?.y;
const x = (posiciones: Map<string, { x: number; y: number }>, id: string) => posiciones.get(id)?.x;

/** `a → b → c`, una cadena sin ramas. */
const cadena: Graph = {
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

describe('acomodar el recorrido', () => {
  it('una cadena baja en columna, un paso por capa', () => {
    const p = autoLayout(cadena);
    assert.ok((y(p, 'a') ?? 0) < (y(p, 'b') ?? 0));
    assert.ok((y(p, 'b') ?? 0) < (y(p, 'c') ?? 0));
    assert.equal(x(p, 'a'), x(p, 'b'));
  });

  it('una pregunta pone sus destinos lado a lado, en la misma capa', () => {
    const graph: Graph = {
      nodes: [
        { id: 'q', type: 'ask_buttons', body: '¿?', options: [
          { value: 'uno', label: 'Uno' },
          { value: 'dos', label: 'Dos' },
        ] },
        { id: 'uno', type: 'end', body: 'A' },
        { id: 'dos', type: 'end', body: 'B' },
      ],
      edges: [
        { id: 'e1', source: 'q', target: 'uno', on: 'uno' },
        { id: 'e2', source: 'q', target: 'dos', on: 'dos' },
      ],
    };
    const p = autoLayout(graph);
    assert.equal(y(p, 'uno'), y(p, 'dos'));
    assert.notEqual(x(p, 'uno'), x(p, 'dos'));
  });

  it('un paso al que se llega por dos caminos cae debajo del MÁS PROFUNDO', () => {
    // Con el camino más corto, la flecha larga apuntaría hacia arriba y el diagrama
    // se leería al revés.
    const graph: Graph = {
      nodes: [
        { id: 'a', type: 'start', match: { fallback: true } },
        { id: 'b', type: 'message', body: '1' },
        { id: 'c', type: 'message', body: '2' },
        { id: 'fin', type: 'end', body: 'Fin' },
      ],
      edges: [
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e2', source: 'b', target: 'c' },
        { id: 'e3', source: 'c', target: 'fin' },
        { id: 'e4', source: 'a', target: 'fin' },
      ],
    };
    const p = autoLayout(graph);
    assert.ok((y(p, 'fin') ?? 0) > (y(p, 'c') ?? 0));
  });

  it('un ciclo no la cuelga', () => {
    // "Agregar algo más" vuelve a la búsqueda: los ciclos son legítimos.
    const graph: Graph = {
      nodes: [
        { id: 'a', type: 'start', match: { fallback: true } },
        { id: 'b', type: 'message', body: '1' },
      ],
      edges: [
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e2', source: 'b', target: 'a' },
      ],
    };
    const p = autoLayout(graph);
    assert.equal(p.size, 2);
  });

  it('los pasos inalcanzables van al fondo, juntos', () => {
    // Mezclarlos con el recorrido los volvería invisibles, y son un problema que el
    // validador ya reporta.
    const graph: Graph = {
      nodes: [...cadena.nodes, { id: 'suelto', type: 'message', body: 'Nadie llega' }],
      edges: cadena.edges,
    };
    const p = autoLayout(graph);
    assert.ok((y(p, 'suelto') ?? 0) > (y(p, 'c') ?? 0));
  });

  it('sin ninguna entrada igual acomoda, arrancando por lo que no recibe flechas', () => {
    const graph: Graph = {
      nodes: [
        { id: 'a', type: 'message', body: '1' },
        { id: 'b', type: 'message', body: '2' },
      ],
      edges: [{ id: 'e1', source: 'a', target: 'b' }],
    };
    const p = autoLayout(graph);
    assert.ok((y(p, 'a') ?? 0) < (y(p, 'b') ?? 0));
  });

  it('acomoda TODOS los pasos, ninguno queda sin posición', () => {
    const p = autoLayout(SEED_GRAPH as Graph);
    for (const node of SEED_GRAPH.nodes) {
      assert.ok(p.has(node.id), `${node.id} quedó sin acomodar`);
    }
  });

  it('dos tarjetas de la misma capa no se pisan', () => {
    const p = autoLayout(SEED_GRAPH as Graph);
    const porCapa = new Map<number, number[]>();
    for (const [, pos] of p) porCapa.set(pos.y, [...(porCapa.get(pos.y) ?? []), pos.x]);
    for (const [, xs] of porCapa) assert.equal(new Set(xs).size, xs.length);
  });

  it('apretar el botón dos veces da lo mismo', () => {
    // Si no fuera estable, el recorrido bailaría con cada clic y nadie confiaría.
    const graph = SEED_GRAPH as Graph;
    const primera = applyPositions(graph, asPositionList(autoLayout(graph)));
    const segunda = applyPositions(primera, asPositionList(autoLayout(primera)));
    assert.deepEqual(
      segunda.nodes.map((n) => n.position),
      primera.nodes.map((n) => n.position),
    );
  });

  it('no toca los pasos ni las flechas, sólo devuelve posiciones', () => {
    const graph = SEED_GRAPH as Graph;
    const next = applyPositions(graph, asPositionList(autoLayout(graph)));
    assert.deepEqual(next.edges, graph.edges);
    assert.deepEqual(
      next.nodes.map((n) => n.id),
      graph.nodes.map((n) => n.id),
    );
  });

  it('usa el alto real de cada tarjeta cuando lo sabe', () => {
    const alto = autoLayout(cadena, { heightOf: () => 300 });
    const bajo = autoLayout(cadena, { heightOf: () => 40 });
    assert.ok((y(alto, 'c') ?? 0) > (y(bajo, 'c') ?? 0));
  });
});

describe('saber si vale la pena acomodar', () => {
  it('sobre un recorrido ya acomodado, no mueve nada', () => {
    const graph = applyPositions(cadena, asPositionList(autoLayout(cadena)));
    assert.equal(wouldMove(graph, autoLayout(graph)), false);
  });

  it('sobre uno desordenado, sí', () => {
    assert.equal(wouldMove(cadena, autoLayout(cadena)), true);
  });
});
