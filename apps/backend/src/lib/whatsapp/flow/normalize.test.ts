import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { normalizeGraph, validateGraph } from './graph';

describe('normalizeGraph', () => {
  it('cualquier basura da un grafo vacío, no una excepción', () => {
    for (const raw of [null, undefined, 'x', 42, [], { nodes: 'no' }, { edges: {} }]) {
      const g = normalizeGraph(raw);
      assert.deepEqual(g, { nodes: [], edges: [] }, JSON.stringify(raw));
    }
  });

  it('descarta nodos sin id o con un tipo que no existe', () => {
    const g = normalizeGraph({
      nodes: [
        { id: 'ok', type: 'message', body: 'hola' },
        { type: 'message', body: 'sin id' },
        { id: 'raro', type: 'teletransporte' },
      ],
      edges: [],
    });
    assert.deepEqual(g.nodes.map((n) => n.id), ['ok']);
  });

  it('descarta aristas que apuntan a un nodo borrado', () => {
    // El editor puede sacar un nodo y dejar su arista. Guardarla dejaría el grafo
    // con referencias muertas que `validateGraph` reportaría para siempre.
    const g = normalizeGraph({
      nodes: [{ id: 'a', type: 'message', body: 'a' }],
      edges: [
        { id: 'e1', source: 'a', target: 'a' },
        { id: 'e2', source: 'a', target: 'borrado' },
      ],
    });
    assert.deepEqual(g.edges.map((e) => e.id), ['e1']);
  });

  it('una opción sin value se va; sin label hereda el value', () => {
    const g = normalizeGraph({
      nodes: [
        {
          id: 'q',
          type: 'ask_buttons',
          body: '¿?',
          options: [{ value: 'a', label: 'Ay' }, { value: 'b' }, { label: 'sin value' }],
        },
      ],
      edges: [],
    });
    assert.deepEqual(g.nodes[0].options, [
      { value: 'a', label: 'Ay' },
      { value: 'b', label: 'b' },
    ]);
  });

  it('un operador de condición inventado se descarta en vez de guardarse', () => {
    // Guardarlo haría que la arista nunca matchee y el operador se volvería loco
    // buscando por qué su rama no anda.
    const g = normalizeGraph({
      nodes: [
        { id: 'a', type: 'condition' },
        { id: 'b', type: 'end' },
      ],
      edges: [{ id: 'e', source: 'a', target: 'b', when: { path: 'vars.x', op: 'mayor_que', value: 1 } }],
    });
    assert.equal(g.edges[0].when, undefined);
  });

  it('conserva la posición del canvas', () => {
    const g = normalizeGraph({
      nodes: [{ id: 'a', type: 'end', position: { x: 12.5, y: -3 } }],
      edges: [],
    });
    assert.deepEqual(g.nodes[0].position, { x: 12.5, y: -3 });
  });

  it('normalizar es idempotente', () => {
    const raw = {
      nodes: [
        { id: 'i', type: 'start', match: { keywords: ['hola'], fallback: true } },
        { id: 'm', type: 'ask_buttons', body: '¿?', options: [{ value: 'a', label: 'A' }] },
        { id: 'f', type: 'end', body: 'chau' },
      ],
      edges: [
        { id: 'e0', source: 'i', target: 'm' },
        { id: 'e1', source: 'm', target: 'f', on: 'a' },
      ],
    };
    const once = normalizeGraph(raw);
    assert.deepEqual(normalizeGraph(once), once);
    // Y el resultado es un grafo publicable.
    assert.deepEqual(validateGraph(once), []);
  });
});

describe('normalizeGraph — salidas de la bifurcación', () => {
  it('las salidas sobreviven el guardado con su condición', () => {
    // El grafo se persiste pasando por acá: una rama que `normalizeGraph` tire se
    // pierde al guardar, y el operador ve el canvas volver atrás sin ningún error.
    const g = normalizeGraph({
      nodes: [
        {
          id: 'decidir',
          type: 'condition',
          branches: [
            { value: 'vip', label: 'VIP', when: { path: 'vars.tier', op: 'eq', value: 'vip' } },
            { value: 'resto', label: 'El resto' },
          ],
        },
      ],
      edges: [],
    });

    assert.deepEqual(g.nodes[0]?.branches, [
      { value: 'vip', label: 'VIP', when: { path: 'vars.tier', op: 'eq', value: 'vip' } },
      { value: 'resto', label: 'El resto' },
    ]);
  });

  it('una rama sin `value` se tira, y sin nombre se llama como su value', () => {
    const g = normalizeGraph({
      nodes: [
        {
          id: 'decidir',
          type: 'condition',
          branches: [{ label: 'huérfana' }, { value: 'sola' }],
        },
      ],
      edges: [],
    });

    assert.deepEqual(g.nodes[0]?.branches, [{ value: 'sola', label: 'sola' }]);
  });

  it('una condición con un operador que no existe se descarta: la rama queda por default', () => {
    // Un operador desconocido no puede dar `true` por descarte — sería tomar una
    // rama por un typo.
    const g = normalizeGraph({
      nodes: [
        {
          id: 'decidir',
          type: 'condition',
          branches: [{ value: 'a', label: 'A', when: { path: 'vars.x', op: 'parecido_a' } }],
        },
      ],
      edges: [],
    });

    assert.deepEqual(g.nodes[0]?.branches, [{ value: 'a', label: 'A' }]);
  });

  it('un nodo que no es bifurcación no arrastra ramas inventadas', () => {
    const g = normalizeGraph({
      nodes: [{ id: 'm', type: 'message', body: 'hola' }],
      edges: [],
    });
    assert.equal(g.nodes[0]?.branches, undefined);
  });

  it('la bifurcación sin ramas sigue sin campo: no se le inventa uno vacío', () => {
    // Es el discriminador entre el formato viejo y el nuevo. Un `branches: []`
    // guardado de más no cambiaría nada hoy, pero convierte el chequeo en una
    // trampa para el que lea `node.branches` esperando que su presencia signifique
    // algo.
    const g = normalizeGraph({
      nodes: [{ id: 'decidir', type: 'condition', branches: [] }],
      edges: [],
    });
    assert.equal(g.nodes[0]?.branches, undefined);
  });
});
