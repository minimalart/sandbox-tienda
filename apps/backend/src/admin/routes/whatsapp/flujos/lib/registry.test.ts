import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { SEED_GRAPH } from '../../../../../lib/whatsapp/flow/seed';
import { NODE_TYPES, TYPE_LABEL, type Graph, type GraphEdge, type GraphNode } from '../_editor';
import {
  conditionLabel,
  DEFAULT_HANDLE,
  filterLibrary,
  handleOf,
  LIBRARY_GROUPS,
  NODE_META,
  outputsOf,
  summaryOf,
} from './registry';

const salidas = (node: GraphNode, edges: GraphEdge[] = []) => outputsOf(node, edges);
const ids = (node: GraphNode, edges: GraphEdge[] = []) => salidas(node, edges).map((o) => o.id);

describe('los conectores de cada paso', () => {
  it('un mensaje tiene una sola salida', () => {
    assert.deepEqual(ids({ id: 'm', type: 'message' }), [DEFAULT_HANDLE]);
  });

  it('un fin y una derivación no sacan nada', () => {
    // Los dos cortan el recorrido: lo que se dibuje después no lo recorre nadie.
    assert.deepEqual(ids({ id: 'f', type: 'end' }), []);
    assert.deepEqual(ids({ id: 'h', type: 'handoff' }), []);
  });

  it('una pregunta tiene UN CONECTOR POR OPCIÓN', () => {
    // Es el cambio central: antes las tres flechas de un menú salían del mismo
    // punto y había que abrir cada una para saber a qué opción correspondía.
    const node: GraphNode = {
      id: 'menu',
      type: 'ask_buttons',
      options: [
        { value: 'buy', label: 'Comprar' },
        { value: 'help', label: 'Ayuda' },
      ],
    };
    assert.deepEqual(ids(node), ['buy', 'help']);
    assert.deepEqual(
      salidas(node).map((o) => o.label),
      ['Comprar', 'Ayuda'],
    );
  });

  it('una opción sin id no dibuja conector', () => {
    const node: GraphNode = {
      id: 'q',
      type: 'ask_buttons',
      options: [{ value: '  ', label: 'Rota' }],
    };
    assert.deepEqual(ids(node), []);
  });

  it('una opción sin texto igual dibuja su conector, con un rótulo que lo delata', () => {
    const node: GraphNode = { id: 'q', type: 'ask_buttons', options: [{ value: 'a', label: '' }] };
    assert.deepEqual(salidas(node)[0]?.label, 'Opción sin texto');
  });

  it('con opciones en vivo suma el conector de "otras respuestas", al final', () => {
    // Lo que el cliente elige de la lista dinámica no lo nombra ninguna flecha, así
    // que sale por la incondicional — y el motor EXIGE que exista.
    const node: GraphNode = {
      id: 'q',
      type: 'ask_list',
      optionsFrom: 'vars.presentations',
      options: [{ value: 'ninguna', label: 'Ninguna me sirve' }],
    };
    assert.deepEqual(ids(node), ['ninguna', DEFAULT_HANDLE]);
    assert.equal(salidas(node)[1]?.kind, 'fallback');
  });

  it('una bifurcación tiene un conector por rama declarada', () => {
    const node: GraphNode = {
      id: 'c',
      type: 'condition',
      branches: [
        { value: 'salida_1', label: 'Con carrito', when: { path: 'vars.cart', op: 'exists' } },
        { value: 'salida_2', label: 'Resto' },
      ],
    };
    assert.deepEqual(ids(node), ['salida_1', 'salida_2']);
    assert.deepEqual(
      salidas(node).map((o) => o.isDefaultBranch),
      [false, true],
    );
  });

  it('una bifurcación del formato viejo tiene el conector único', () => {
    // Las guardadas antes de las ramas declaradas llevan las condiciones en las
    // flechas. Si les dibujáramos cero conectores, sus flechas desaparecerían.
    assert.deepEqual(ids({ id: 'c', type: 'condition' }), [DEFAULT_HANDLE]);
  });

  it('una flecha atada a una opción BORRADA no se queda sin conector', () => {
    // Sin este conector de rescate, React Flow descarta la arista en silencio y el
    // operador ve desaparecer una conexión que estaba bien guardada.
    const node: GraphNode = { id: 'q', type: 'ask_buttons', options: [{ value: 'a', label: 'A' }] };
    const edges: GraphEdge[] = [{ id: 'e1', source: 'q', target: 'x', on: 'borrada' }];
    const outputs = salidas(node, edges);
    assert.deepEqual(outputs.map((o) => o.id), ['a', DEFAULT_HANDLE]);
    assert.equal(outputs[1]?.kind, 'legacy');
  });

  it('las salidas saben si ya tienen flecha', () => {
    const node: GraphNode = {
      id: 'q',
      type: 'ask_buttons',
      options: [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
      ],
    };
    const edges: GraphEdge[] = [{ id: 'e1', source: 'q', target: 'x', on: 'a' }];
    assert.deepEqual(
      salidas(node, edges).map((o) => o.wired),
      [true, false],
    );
  });

  it('los ids de salida de un nodo no se repiten', () => {
    for (const node of SEED_GRAPH.nodes) {
      const outgoing = SEED_GRAPH.edges.filter((e) => e.source === node.id);
      const outputs = outputsOf(node, outgoing);
      assert.equal(
        new Set(outputs.map((o) => o.id)).size,
        outputs.length,
        `${node.id} repite un id de conector`,
      );
    }
  });
});

describe('toda flecha guardada encuentra su conector', () => {
  /**
   * EL TEST QUE MÁS IMPORTA. Una arista cuyo `sourceHandle` no existe en el nodo es
   * el error 008 de React Flow: no se dibuja, no avisa, y el operador ve el
   * recorrido con una conexión menos de las que tiene guardadas.
   */
  it('en el recorrido base, cada arista se engancha a un conector que existe', () => {
    for (const edge of SEED_GRAPH.edges) {
      const source = SEED_GRAPH.nodes.find((n) => n.id === edge.source) as GraphNode;
      const outputs = outputsOf(
        source,
        SEED_GRAPH.edges.filter((e) => e.source === edge.source),
      );
      const handle = handleOf(edge, outputs);
      assert.ok(
        outputs.some((o) => o.id === handle),
        `${edge.id} (${edge.source} → ${edge.target}, on=${edge.on}) se engancha a "${handle}", que ${source.type} no dibuja`,
      );
    }
  });

  it('la flecha de una opción se engancha a la opción', () => {
    const node: GraphNode = { id: 'q', type: 'ask_buttons', options: [{ value: 'buy', label: 'Comprar' }] };
    const edge: GraphEdge = { id: 'e', source: 'q', target: 'x', on: 'buy' };
    assert.equal(handleOf(edge, outputsOf(node, [edge])), 'buy');
  });

  it('una flecha sin opción se engancha al conector por default', () => {
    const node: GraphNode = { id: 'a', type: 'action' };
    const edge: GraphEdge = { id: 'e', source: 'a', target: 'x' };
    assert.equal(handleOf(edge, outputsOf(node, [edge])), DEFAULT_HANDLE);
  });

  it('una flecha con `on` huérfano cae al conector de rescate', () => {
    const node: GraphNode = { id: 'q', type: 'ask_buttons', options: [{ value: 'a', label: 'A' }] };
    const edge: GraphEdge = { id: 'e', source: 'q', target: 'x', on: 'fantasma' };
    assert.equal(handleOf(edge, outputsOf(node, [edge])), DEFAULT_HANDLE);
  });
});

describe('lo que resume la tarjeta', () => {
  it('un mensaje muestra lo que recibe el cliente', () => {
    assert.equal(summaryOf({ id: 'm', type: 'message', body: 'Hola 👋' }), 'Hola 👋');
  });

  it('una acción muestra su nombre en castellano y sus argumentos', () => {
    // "Buscar productos" no dice nada; "Buscar productos · query: {{text}}" dice que
    // busca lo que el cliente escribió.
    const resumen = summaryOf({
      id: 'a',
      type: 'action',
      tool: 'wa_search_products',
      args: { query: '{{text}}' },
    });
    assert.equal(resumen, 'Buscar productos · query: {{text}}');
  });

  it('una acción con una lista de productos dice cuántos', () => {
    const resumen = summaryOf({
      id: 'a',
      type: 'action',
      tool: 'wa_list_pinned',
      args: { product_ids: ['p1', 'p2'] },
    });
    assert.ok(resumen.includes('2 elementos'));
  });

  it('una acción sin tool no inventa nada', () => {
    assert.equal(summaryOf({ id: 'a', type: 'action' }), '');
  });

  it('una entrada dice qué la despierta', () => {
    const resumen = summaryOf({
      id: 's',
      type: 'start',
      match: { exact: ['hola'], keywords: ['sucursales'] },
    });
    assert.ok(resumen.includes('hola'));
    assert.ok(resumen.includes('sucursales'));
  });

  it('el catch-all lo dice con todas las letras', () => {
    const resumen = summaryOf({ id: 's', type: 'start', match: { fallback: true } });
    assert.ok(resumen.includes('no matchea'));
  });

  it('una bifurcación dice cuántas salidas tiene', () => {
    assert.equal(
      summaryOf({ id: 'c', type: 'condition', branches: [{ value: 'a', label: 'A' }] }),
      '1 salida',
    );
  });

  it('una bifurcación del formato viejo explica dónde están sus condiciones', () => {
    assert.equal(summaryOf({ id: 'c', type: 'condition' }), 'Las condiciones están en las flechas');
  });

  it('una derivación muestra el motivo', () => {
    assert.equal(summaryOf({ id: 'h', type: 'handoff', reason: 'lo pidió el cliente' }), 'lo pidió el cliente');
  });

  it('un paso sin contenido no rompe', () => {
    for (const type of NODE_TYPES) {
      assert.equal(typeof summaryOf({ id: 'x', type }), 'string');
    }
  });
});

describe('las condiciones se leen en castellano', () => {
  it('los cuatro operadores', () => {
    assert.equal(conditionLabel({ path: 'vars.a', op: 'exists' }), 'vars.a tiene valor');
    assert.equal(conditionLabel({ path: 'vars.a', op: 'empty' }), 'vars.a está vacío');
    assert.equal(conditionLabel({ path: 'vars.a', op: 'eq', value: 'x' }), 'vars.a es igual a x');
    assert.equal(conditionLabel({ path: 'vars.a', op: 'ne', value: 'x' }), 'vars.a es distinto de x');
  });

  it('sin condición no dice nada', () => {
    assert.equal(conditionLabel(undefined), '');
  });
});

describe('la biblioteca de pasos', () => {
  it('todo tipo tiene grupo y una línea de ayuda', () => {
    for (const type of NODE_TYPES) {
      assert.ok(NODE_META[type], `falta meta de ${type}`);
      assert.ok(NODE_META[type].hint.length > 0, `${type} sin ayuda`);
      assert.ok(NODE_META[type].group, `${type} sin grupo`);
    }
  });

  it('cada tipo aparece en un solo grupo, y todos aparecen', () => {
    const enGrupos = LIBRARY_GROUPS.flatMap((g) => g.types);
    assert.equal(enGrupos.length, NODE_TYPES.length);
    assert.equal(new Set(enGrupos).size, NODE_TYPES.length);
  });

  it('la Entrada está en la biblioteca', () => {
    // El validador exige al menos una: si no se puede agregar, un recorrido nuevo
    // es impublicable y no hay forma de arreglarlo desde el canvas.
    assert.ok(LIBRARY_GROUPS.flatMap((g) => g.types).includes('start'));
  });

  it('sin búsqueda devuelve todo', () => {
    assert.deepEqual(filterLibrary('').length, LIBRARY_GROUPS.length);
    assert.deepEqual(filterLibrary('   ').length, LIBRARY_GROUPS.length);
  });

  it('busca sin importar mayúsculas ni tildes', () => {
    // Nadie escribe "lógica" con tilde en un buscador.
    const conTilde = filterLibrary('bifurcación').flatMap((g) => g.types);
    const sinTilde = filterLibrary('BIFURCACION').flatMap((g) => g.types);
    assert.deepEqual(conTilde, ['condition']);
    assert.deepEqual(sinTilde, ['condition']);
  });

  it('encuentra por la ayuda y no sólo por el nombre', () => {
    assert.ok(filterLibrary('botones').flatMap((g) => g.types).includes('ask_buttons'));
  });

  it('un grupo sin resultados no se muestra vacío', () => {
    // Un encabezado suelto se lee como "acá no hay nada que buscar".
    for (const group of filterLibrary('mensaje')) {
      assert.ok(group.types.length > 0, `${group.key} salió vacío`);
    }
  });

  it('una búsqueda sin resultados devuelve cero grupos', () => {
    assert.deepEqual(filterLibrary('zzzz'), []);
  });

  it('los nombres de la biblioteca son los mismos que usa el canvas', () => {
    for (const type of NODE_TYPES) assert.ok(TYPE_LABEL[type]);
  });
});

describe('el recorrido base se puede dibujar entero', () => {
  it('todos sus pasos tienen meta y resumen', () => {
    const graph = SEED_GRAPH as Graph;
    for (const node of graph.nodes) {
      assert.ok(NODE_META[node.type], `${node.id} es de un tipo sin meta`);
      assert.equal(typeof summaryOf(node), 'string');
    }
  });
});
