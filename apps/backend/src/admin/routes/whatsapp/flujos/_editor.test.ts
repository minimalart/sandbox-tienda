import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ACTIONS,
  ACTION_ARGS,
  actionLabel,
  addAndConnect,
  addBranch,
  addNode,
  addOption,
  argsOf,
  patchArg,
  applyPositions,
  branchesOf,
  canvasKind,
  connect,
  CONNECTABLE_TARGET_TYPES,
  duplicateNode,
  insertBetween,
  INSERTABLE_TYPES,
  maxOptions,
  nextPosition,
  nodeTitle,
  optionsOf,
  outgoingProblems,
  patchBranch,
  patchEdge,
  patchNode,
  patchOption,
  removeBranch,
  removeEdge,
  removeNode,
  removeOption,
  type Graph,
} from './_editor';

const EMPTY: Graph = { nodes: [], edges: [] };

/** Arma un grafo chico: entrada → menú, ya conectados. */
function conectado(): Graph {
  let g = addNode(EMPTY, 'start').graph;
  g = addNode(g, 'ask_buttons').graph;
  g = connect(g, { source: 'start_1', target: 'ask_buttons_1' });
  return g;
}

describe('el nombre del bloque', () => {
  it('un nodo nuevo NACE sin nombre', () => {
    // Nacía con el tipo adentro, así que la tarjeta decía "Entrada / Entrada" y
    // había que borrar un texto que el operador no escribió.
    const { graph } = addNode(EMPTY, 'start');
    assert.equal(graph.nodes[0]?.label, undefined);
  });

  it('sin nombre se muestra sólo el tipo', () => {
    assert.equal(nodeTitle({ id: 'start_1', type: 'start' }), 'Entrada');
  });

  it('con nombre se muestran los dos, sin repetir', () => {
    assert.equal(nodeTitle({ id: 'start_1', type: 'start', label: 'Saludo' }), 'Entrada\nSaludo');
  });

  it('un nombre en blanco cuenta como sin nombre', () => {
    assert.equal(nodeTitle({ id: 'x', type: 'message', label: '   ' }), 'Mensaje');
  });
});

describe('agregar un paso no toca el cableado', () => {
  it('las conexiones sobreviven', () => {
    // El bug: `onConnect` escribía sólo en el estado de React Flow, y cualquier
    // repintado regeneraba las aristas desde el grafo —que no las tenía—.
    const antes = conectado();
    assert.equal(antes.edges.length, 1);

    const { graph } = addNode(antes, 'message');
    assert.equal(graph.edges.length, 1, 'se perdió la conexión al agregar un nodo');
    assert.deepEqual(graph.edges[0], { id: 'e_1', source: 'start_1', target: 'ask_buttons_1' });
  });

  it('editar un texto tampoco las toca', () => {
    const g = patchNode(conectado(), 'ask_buttons_1', { body: '¿Qué necesitás?' });
    assert.equal(g.edges.length, 1);
  });

  it('mover un nodo tampoco', () => {
    const g = applyPositions(conectado(), [{ id: 'start_1', position: { x: 500, y: 20 } }]);
    assert.equal(g.edges.length, 1);
    assert.deepEqual(g.nodes[0]?.position, { x: 500, y: 20 });
  });

  it('borrar un nodo se lleva SÓLO sus aristas', () => {
    let g = conectado();
    g = addNode(g, 'end').graph;
    g = connect(g, { source: 'ask_buttons_1', target: 'end_1' });
    assert.equal(g.edges.length, 2);

    g = removeNode(g, 'end_1');
    assert.equal(g.edges.length, 1);
    assert.equal(g.edges[0]?.target, 'ask_buttons_1');
  });
});

describe('una bifurcación saca varios caminos', () => {
  it('dos salidas del mismo nodo conviven', () => {
    let g = addNode(EMPTY, 'condition').graph;
    g = addNode(g, 'message').graph;
    g = addNode(g, 'end').graph;

    g = connect(g, { source: 'condition_1', target: 'message_1' });
    g = connect(g, { source: 'condition_1', target: 'end_1' });

    assert.equal(g.edges.length, 2, 'la segunda rama pisó a la primera');
    assert.deepEqual(g.edges.map((e) => e.id), ['e_1', 'e_2']);
  });

  it('los ids no chocan aunque se dibujen en el mismo milisegundo', () => {
    // Antes el id era `e_${Date.now()}`: dos conexiones seguidas salían con el
    // mismo id y React Flow se quedaba con una sola.
    let g = addNode(EMPTY, 'condition').graph;
    for (let i = 0; i < 5; i++) g = addNode(g, 'end').graph;
    for (let i = 1; i <= 5; i++) g = connect(g, { source: 'condition_1', target: `end_${i}` });

    assert.equal(new Set(g.edges.map((e) => e.id)).size, 5);
  });

  it('no se duplica la misma arista', () => {
    let g = conectado();
    g = connect(g, { source: 'start_1', target: 'ask_buttons_1' });
    assert.equal(g.edges.length, 1);
  });

  it('un nodo no se conecta consigo mismo', () => {
    const g = connect(conectado(), { source: 'start_1', target: 'start_1' });
    assert.equal(g.edges.length, 1);
  });
});

describe('qué rama es cuál', () => {
  /**
   * Una bifurcación del formato VIEJO: las condiciones viven en las aristas y el
   * nodo no declara nada. Es lo que hay guardado en los recorridos ya publicados,
   * así que sus avisos tienen que seguir saliendo igual.
   */
  const bifurcadoViejo = (): Graph => {
    let g = addNode(EMPTY, 'condition').graph;
    g = patchNode(g, 'condition_1', { branches: [] });
    g = addNode(g, 'message').graph;
    g = addNode(g, 'end').graph;
    g = connect(g, { source: 'condition_1', target: 'message_1' });
    g = connect(g, { source: 'condition_1', target: 'end_1' });
    return g;
  };

  it('avisa cuando dos salidas no se distinguen', () => {
    // Sin condición el motor toma siempre la primera y la segunda rama nunca
    // corre, sin que nada lo diga.
    const problems = outgoingProblems(bifurcadoViejo(), 'condition_1');
    assert.ok(problems.some((p) => p.includes('sin condición')));
  });

  it('con una condición y una salida por default, no avisa nada', () => {
    const g = patchEdge(bifurcadoViejo(), 'e_1', { when: { path: 'vars.cart_units', op: 'exists' } });
    assert.deepEqual(outgoingProblems(g, 'condition_1'), []);
  });

  it('avisa si TODAS tienen condición: nadie atiende el caso que no matchea', () => {
    let g = patchEdge(bifurcadoViejo(), 'e_1', { when: { path: 'vars.a', op: 'exists' } });
    g = patchEdge(g, 'e_2', { when: { path: 'vars.b', op: 'exists' } });
    assert.ok(outgoingProblems(g, 'condition_1').some((p) => p.includes('por default')));
  });

  it('una bifurcación NACE con una salida, no con cero', () => {
    // Con cero no tendría ningún conector abajo del rombo y no habría forma de
    // sacarle una flecha: la bifurcación quedaría muerta apenas creada.
    const { graph } = addNode(EMPTY, 'condition');
    assert.equal(branchesOf(graph.nodes[0]).length, 1);
  });

  it('"Agregar salida" suma una rama con un value propio', () => {
    // Es LO QUE FALTABA: el inspector no tenía ningún lugar donde sumar una
    // salida, así que la bifurcación se veía con una sola para siempre.
    let g = addNode(EMPTY, 'condition').graph;
    g = addBranch(g, 'condition_1');
    g = addBranch(g, 'condition_1');

    const values = branchesOf(g.nodes[0]).map((b) => b.value);
    assert.equal(values.length, 3);
    assert.equal(new Set(values).size, 3);
  });

  it('renombrar una salida NO despega su arista', () => {
    // El `on` ata por `value`, que es un id estable. Si atara por el nombre,
    // cambiarle una letra desconectaba la rama en silencio.
    let g = addNode(EMPTY, 'condition').graph;
    g = addNode(g, 'end').graph;
    g = connect(g, { source: 'condition_1', target: 'end_1', sourceHandle: 'salida_1' });
    g = patchBranch(g, 'condition_1', 'salida_1', { label: 'Tiene carrito' });

    assert.equal(g.edges[0]?.on, 'salida_1');
    assert.equal(branchesOf(g.nodes[0])[0]?.label, 'Tiene carrito');
  });

  it('la flecha nace atada a la rama de la que se arrastró', () => {
    let g = addNode(EMPTY, 'condition').graph;
    g = addBranch(g, 'condition_1');
    g = addNode(g, 'message').graph;
    g = addNode(g, 'end').graph;
    g = connect(g, { source: 'condition_1', target: 'message_1', sourceHandle: 'salida_1' });
    g = connect(g, { source: 'condition_1', target: 'end_1', sourceHandle: 'salida_2' });

    assert.deepEqual(g.edges.map((e) => e.on), ['salida_1', 'salida_2']);
  });

  it('dos ramas distintas pueden caer en el MISMO paso', () => {
    // La regla vieja era "una sola arista por par (origen, destino)" y rechazaba
    // la segunda sin decir nada: "Sí" y "No" cerrando las dos en el mismo fin es
    // un recorrido de todos los días.
    let g = addNode(EMPTY, 'condition').graph;
    g = addBranch(g, 'condition_1');
    g = addNode(g, 'end').graph;
    g = connect(g, { source: 'condition_1', target: 'end_1', sourceHandle: 'salida_1' });
    g = connect(g, { source: 'condition_1', target: 'end_1', sourceHandle: 'salida_2' });

    assert.equal(g.edges.length, 2);
  });

  it('una rama ya cableada no acepta una segunda flecha', () => {
    let g = addNode(EMPTY, 'condition').graph;
    g = addNode(g, 'end').graph;
    g = addNode(g, 'message').graph;
    g = connect(g, { source: 'condition_1', target: 'end_1', sourceHandle: 'salida_1' });
    g = connect(g, { source: 'condition_1', target: 'message_1', sourceHandle: 'salida_1' });

    assert.equal(g.edges.length, 1);
  });

  it('borrar una salida se lleva su arista', () => {
    // Dejarla huérfana sería una flecha con un `on` que ya no existe: el motor
    // nunca la tomaría y el validador la reportaría para siempre.
    let g = addNode(EMPTY, 'condition').graph;
    g = addNode(g, 'end').graph;
    g = connect(g, { source: 'condition_1', target: 'end_1', sourceHandle: 'salida_1' });
    g = removeBranch(g, 'condition_1', 'salida_1');

    assert.equal(g.edges.length, 0);
    assert.equal(branchesOf(g.nodes[0]).length, 0);
  });

  it('avisa por la salida declarada que no se cableó', () => {
    const g = addNode(EMPTY, 'condition').graph;
    assert.ok(outgoingProblems(g, 'condition_1').some((p) => p.includes('no lleva a ningún lado')));
  });

  it('avisa cuando hay DOS salidas por default', () => {
    let g = addNode(EMPTY, 'condition').graph;
    g = addBranch(g, 'condition_1');
    g = addNode(g, 'end').graph;
    g = addNode(g, 'message').graph;
    g = connect(g, { source: 'condition_1', target: 'end_1', sourceHandle: 'salida_1' });
    g = connect(g, { source: 'condition_1', target: 'message_1', sourceHandle: 'salida_2' });

    assert.ok(outgoingProblems(g, 'condition_1').some((p) => p.includes('sólo una puede ser la de por default')));
  });

  it('con una rama con condición y otra por default, no avisa nada', () => {
    let g = addNode(EMPTY, 'condition').graph;
    g = addBranch(g, 'condition_1');
    g = patchBranch(g, 'condition_1', 'salida_1', { when: { path: 'vars.cart_units', op: 'exists' } });
    g = addNode(g, 'end').graph;
    g = addNode(g, 'message').graph;
    g = connect(g, { source: 'condition_1', target: 'message_1', sourceHandle: 'salida_1' });
    g = connect(g, { source: 'condition_1', target: 'end_1', sourceHandle: 'salida_2' });

    assert.deepEqual(outgoingProblems(g, 'condition_1'), []);
  });

  it('una condición sin `path` se borra: la rama vuelve a ser la de por default', () => {
    let g = addNode(EMPTY, 'condition').graph;
    g = patchBranch(g, 'condition_1', 'salida_1', { when: { path: '', op: 'exists' } });
    assert.equal(branchesOf(g.nodes[0])[0]?.when, undefined);
  });

  it('en una pregunta, avisa si una salida no corresponde a ninguna opción', () => {
    let g = addNode(EMPTY, 'ask_buttons').graph;
    g = patchNode(g, 'ask_buttons_1', { options: [{ value: 'si', label: 'Sí' }, { value: 'no', label: 'No' }] });
    g = addNode(g, 'end').graph;
    g = addNode(g, 'message').graph;
    g = connect(g, { source: 'ask_buttons_1', target: 'end_1' });
    g = connect(g, { source: 'ask_buttons_1', target: 'message_1' });
    g = patchEdge(g, 'e_1', { on: 'si' });
    g = patchEdge(g, 'e_2', { on: 'quizas' });

    assert.ok(outgoingProblems(g, 'ask_buttons_1').some((p) => p.includes('"quizas"')));
  });

  it('un `on` vacío se borra en vez de guardarse en blanco', () => {
    // `on: ''` no matchea ninguna opción y tampoco deja pasar la arista como
    // incondicional: es el peor de los dos mundos.
    const g = patchEdge(patchEdge(bifurcadoViejo(), 'e_1', { on: 'buy' }), 'e_1', { on: '  ' });
    assert.equal(g.edges[0]?.on, undefined);
  });

  it('se puede borrar una arista sola', () => {
    const g = removeEdge(bifurcadoViejo(), 'e_1');
    assert.deepEqual(g.edges.map((e) => e.id), ['e_2']);
    assert.equal(g.nodes.length, 3);
  });
});

describe('armar un flujo entero, como lo haría el operador', () => {
  it('sobrevive a la secuencia real: conectar, agregar, mover, renombrar, borrar', () => {
    // Es la reproducción de la sesión que rompía todo: cada paso intermedio
    // repintaba el canvas y se llevaba puestas las conexiones anteriores.
    let g: Graph = EMPTY;

    g = addNode(g, 'start').graph;
    g = addNode(g, 'ask_buttons').graph;
    g = connect(g, { source: 'start_1', target: 'ask_buttons_1' });

    // Agrega dos ramas DESPUÉS de haber conectado.
    g = addNode(g, 'message').graph;
    g = addNode(g, 'action').graph;
    assert.equal(g.edges.length, 1, 'agregar nodos borró la conexión');

    g = patchNode(g, 'ask_buttons_1', {
      body: '¿Qué necesitás?',
      options: [
        { value: 'buy', label: 'Comprar' },
        { value: 'help', label: 'Ayuda' },
      ],
    });
    g = connect(g, { source: 'ask_buttons_1', target: 'message_1' });
    g = connect(g, { source: 'ask_buttons_1', target: 'action_1' });
    assert.equal(g.edges.length, 3);

    // Ata cada rama a su opción.
    g = patchEdge(g, 'e_2', { on: 'buy' });
    g = patchEdge(g, 'e_3', { on: 'help' });
    assert.deepEqual(outgoingProblems(g, 'ask_buttons_1'), []);

    // Mueve nodos y les pone nombre.
    g = applyPositions(g, [{ id: 'start_1', position: { x: 10, y: 10 } }]);
    g = patchNode(g, 'start_1', { label: 'Saludo' });
    assert.equal(g.edges.length, 3, 'mover o renombrar borró conexiones');
    assert.equal(nodeTitle(g.nodes[0] as never), 'Entrada\nSaludo');

    // Borra una rama: se va con su arista y las otras quedan.
    g = removeNode(g, 'action_1');
    assert.deepEqual(g.edges.map((e) => e.id), ['e_1', 'e_2']);
    assert.equal(g.nodes.length, 3);
  });

  it('el id de un nodo borrado se reusa sin chocar con lo que quedó', () => {
    let g = addNode(EMPTY, 'message').graph;
    g = addNode(g, 'message').graph;
    assert.deepEqual(g.nodes.map((n) => n.id), ['message_1', 'message_2']);

    g = removeNode(g, 'message_1');
    const { id } = addNode(g, 'message');
    assert.equal(id, 'message_1');
    assert.equal(new Set([...g.nodes.map((n) => n.id), id]).size, 2);
  });
});

describe('la sesión que reprodujo los bugs en producción', () => {
  /**
   * Los mismos pasos, en el mismo orden, que el guion de Playwright corrió contra
   * el admin real. Medido antes del arreglo:
   *
   *   texto del nodo nuevo:                  "Entrada / Entrada"
   *   aristas tras conectar bifurcación:      1
   *   aristas tras agregar Fin y conectar:    0   ← agregar el nodo borró la anterior
   *
   * Eso deja claro que "la bifurcación saca un solo camino" y "se borran las
   * conexiones" eran el mismo bug: no se podía llegar a tener dos ramas porque
   * agregar el nodo destino se llevaba puesta la primera.
   */
  it('reproduce la secuencia y todo sobrevive', () => {
    let g: Graph = EMPTY;

    g = addNode(g, 'start').graph;
    assert.equal(nodeTitle(g.nodes[0] as never), 'Entrada', 'el nodo nace con el tipo repetido');

    g = addNode(g, 'condition').graph;
    g = addNode(g, 'message').graph;
    g = connect(g, { source: 'condition_1', target: 'message_1' });
    assert.equal(g.edges.length, 1);

    // El paso que rompía todo: agregar un nodo con una conexión ya dibujada.
    g = addNode(g, 'end').graph;
    assert.equal(g.edges.length, 1, 'agregar "Fin" borró la conexión anterior');

    g = connect(g, { source: 'condition_1', target: 'end_1' });
    assert.equal(g.edges.length, 2, 'la bifurcación no llegó a tener dos ramas');

    g = addNode(g, 'action').graph;
    assert.equal(g.edges.length, 2, 'agregar un paso más volvió a borrar el cableado');
  });
});

describe('lo que el canvas deja dibujar', () => {
  it('la entrada no recibe flechas y el fin no saca ninguna', () => {
    // Con conectores en los dos lados de todo, el operador dibuja recorridos que
    // el motor NUNCA corre —una salida desde un `end`— y nada se lo dice: el
    // grafo se guarda, se publica, y esa rama simplemente no pasa.
    assert.equal(canvasKind('start'), 'input');
    assert.equal(canvasKind('end'), 'output');
    assert.equal(canvasKind('handoff'), 'output', 'derivar a una persona también corta');
    for (const t of ['message', 'ask_buttons', 'ask_list', 'ask_text', 'condition', 'action'] as const) {
      assert.equal(canvasKind(t), 'default', t);
    }
  });

  it('el tope de opciones es el de WhatsApp, no uno inventado', () => {
    assert.equal(maxOptions('ask_buttons'), 3);
    assert.equal(maxOptions('ask_list'), 10);
    assert.equal(maxOptions('message'), 0, 'un mensaje no tiene opciones');
  });

  it('los nodos nuevos no se apilan en una columna que se va de la pantalla', () => {
    // En columna, con seis pasos ya había nodos abajo del borde y otros tapados
    // por la paleta, imposibles de tocar.
    const posiciones = Array.from({ length: 9 }, (_, i) => nextPosition(i));
    const maxY = Math.max(...posiciones.map((p) => p.y));
    assert.ok(maxY < 600, `nueve nodos llegan a y=${maxY}: se van de la pantalla`);
    // Y ninguno nace debajo de la paleta lateral.
    assert.ok(posiciones.every((p) => p.x >= 40));
    // Sin superponerse.
    assert.equal(new Set(posiciones.map((p) => `${p.x},${p.y}`)).size, 9);
  });
});

describe('los argumentos de una acción', () => {
  const conAccion = (tool: string): Graph => {
    let g = addNode(EMPTY, 'action').graph;
    g = patchNode(g, 'action_1', { tool });
    return g;
  };

  it('cada acción declara qué campos pide', () => {
    // Sin esto el inspector no tenía NADA que dibujar: sólo dejaba elegir la tool,
    // así que `wa_add_to_cart` quedaba sin saber qué agregar.
    assert.deepEqual(argsOf('wa_add_to_cart').map((f) => f.name), ['variant_id', 'quantity']);
    assert.deepEqual(argsOf('wa_list_pinned').map((f) => f.name), ['product_ids', 'save_as']);
  });

  it('los productos elegidos se piden con el buscador de catálogo', () => {
    assert.equal(argsOf('wa_list_pinned')[0]?.kind, 'products');
  });

  it('una acción sin campos declarados no rompe', () => {
    assert.deepEqual(argsOf('wa_view_cart'), []);
    assert.deepEqual(argsOf(undefined), []);
  });

  it('guarda un argumento en el nodo', () => {
    const g = patchArg(conAccion('wa_add_to_cart'), 'action_1', 'variant_id', '{{answers.elegir}}');
    assert.deepEqual(g.nodes[0]?.args, { variant_id: '{{answers.elegir}}' });
  });

  it('guarda la lista de productos tal cual, respetando el orden', () => {
    // El orden ES el que ve el cliente, así que no se puede normalizar ni ordenar.
    const g = patchArg(conAccion('wa_list_pinned'), 'action_1', 'product_ids', ['prod_b', 'prod_a']);
    assert.deepEqual(g.nodes[0]?.args?.product_ids, ['prod_b', 'prod_a']);
  });

  it('un valor VACÍO borra la clave en vez de guardarla en blanco', () => {
    // Las tools chequean `if (!variant_id)` para dar su propio error; un `''`
    // guardado pasa ese chequeo como si el operador hubiera puesto algo.
    let g = patchArg(conAccion('wa_add_to_cart'), 'action_1', 'variant_id', 'var_1');
    g = patchArg(g, 'action_1', 'variant_id', '   ');
    assert.deepEqual(g.nodes[0]?.args, {});
  });

  it('una lista vacía también borra la clave', () => {
    let g = patchArg(conAccion('wa_list_pinned'), 'action_1', 'product_ids', ['prod_a']);
    g = patchArg(g, 'action_1', 'product_ids', []);
    assert.deepEqual(g.nodes[0]?.args, {});
  });

  it('guardar un argumento NO toca los otros ni las aristas', () => {
    let g = patchArg(conAccion('wa_add_to_cart'), 'action_1', 'variant_id', 'var_1');
    g = addNode(g, 'end').graph;
    g = connect(g, { source: 'action_1', target: 'end_1' });
    g = patchArg(g, 'action_1', 'quantity', '2');

    assert.deepEqual(g.nodes[0]?.args, { variant_id: 'var_1', quantity: '2' });
    assert.equal(g.edges.length, 1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Lo que trajo el canvas nuevo: una salida por opción, insertar en una flecha,
// duplicar un paso y colgar uno de un conector suelto.
// ─────────────────────────────────────────────────────────────────────────────

/** Una pregunta con dos opciones, sin cablear. */
function pregunta(): Graph {
  let g = addNode(EMPTY, 'ask_buttons').graph;
  g = addOption(g, 'ask_buttons_1');
  g = addOption(g, 'ask_buttons_1');
  g = patchOption(g, 'ask_buttons_1', 'opcion_1', { label: 'Comprar' });
  g = patchOption(g, 'ask_buttons_1', 'opcion_2', { label: 'Ayuda' });
  return g;
}

describe('cada opción de una pregunta tiene su propia salida', () => {
  it('la flecha nace atada a la opción del conector del que se arrastró', () => {
    // Antes esto sólo valía para las ramas de una bifurcación: en una pregunta las
    // tres flechas salían del mismo punto sin `on`, y había que tocar cada una y
    // elegir a qué opción correspondía en un desplegable.
    let g = pregunta();
    g = addNode(g, 'message').graph;
    g = connect(g, { source: 'ask_buttons_1', target: 'message_1', sourceHandle: 'opcion_1' });

    assert.equal(g.edges[0]?.on, 'opcion_1');
  });

  it('una opción ya cableada no acepta una segunda flecha', () => {
    // El motor toma una sola: la otra no se recorrería nunca.
    let g = pregunta();
    g = addNode(g, 'message').graph;
    g = addNode(g, 'end').graph;
    g = connect(g, { source: 'ask_buttons_1', target: 'message_1', sourceHandle: 'opcion_1' });
    g = connect(g, { source: 'ask_buttons_1', target: 'end_1', sourceHandle: 'opcion_1' });

    assert.equal(g.edges.length, 1);
  });

  it('dos opciones distintas pueden caer en el mismo paso', () => {
    let g = pregunta();
    g = addNode(g, 'end').graph;
    g = connect(g, { source: 'ask_buttons_1', target: 'end_1', sourceHandle: 'opcion_1' });
    g = connect(g, { source: 'ask_buttons_1', target: 'end_1', sourceHandle: 'opcion_2' });

    assert.deepEqual(g.edges.map((e) => e.on), ['opcion_1', 'opcion_2']);
  });

  it('desde el conector por default la flecha sale SIN opción', () => {
    // Es el conector de lo que llega en vivo: ninguna flecha puede nombrar una
    // opción que todavía no existe.
    let g = patchNode(pregunta(), 'ask_buttons_1', { optionsFrom: 'vars.presentations' });
    g = addNode(g, 'end').graph;
    g = connect(g, { source: 'ask_buttons_1', target: 'end_1', sourceHandle: 'out' });

    assert.equal(g.edges[0]?.on, undefined);
  });

  it('un conector inventado no termina como `on`', () => {
    let g = pregunta();
    g = addNode(g, 'end').graph;
    g = connect(g, { source: 'ask_buttons_1', target: 'end_1', sourceHandle: 'no_existe' });

    assert.equal(g.edges[0]?.on, undefined);
  });
});

describe('las opciones se escriben como las lee el cliente', () => {
  it('una opción nueva nace con un id propio y sin texto', () => {
    // El operador escribe UNA cosa —lo que ve el cliente— y el id lo pone el editor.
    // Antes eran dos campos, y el primero era un id interno disfrazado de dato:
    // dejarlo vacío rompía la arista.
    const g = addOption(addNode(EMPTY, 'ask_buttons').graph, 'ask_buttons_1');
    assert.deepEqual(g.nodes[0]?.options, [{ value: 'opcion_1', label: '' }]);
  });

  it('los ids no se repiten aunque se borren y se agreguen', () => {
    let g = pregunta();
    g = removeOption(g, 'ask_buttons_1', 'opcion_1');
    g = addOption(g, 'ask_buttons_1');
    const values = optionsOf(g.nodes[0]).map((o) => o.value);
    assert.equal(new Set(values).size, values.length);
  });

  it('renombrar una opción NO despega su flecha', () => {
    let g = pregunta();
    g = addNode(g, 'end').graph;
    g = connect(g, { source: 'ask_buttons_1', target: 'end_1', sourceHandle: 'opcion_1' });
    g = patchOption(g, 'ask_buttons_1', 'opcion_1', { label: 'Quiero comprar' });

    assert.equal(g.edges[0]?.on, 'opcion_1');
    assert.equal(optionsOf(g.nodes[0])[0]?.label, 'Quiero comprar');
  });

  it('cambiarle el id a una opción ARRASTRA su flecha', () => {
    // No lo hace la UI, pero puede venir de un grafo importado: sin esto la flecha
    // quedaría apuntando a una opción que ya no existe.
    let g = pregunta();
    g = addNode(g, 'end').graph;
    g = connect(g, { source: 'ask_buttons_1', target: 'end_1', sourceHandle: 'opcion_1' });
    g = patchOption(g, 'ask_buttons_1', 'opcion_1', { value: 'comprar' });

    assert.equal(g.edges[0]?.on, 'comprar');
  });

  it('borrar una opción se lleva su flecha', () => {
    let g = pregunta();
    g = addNode(g, 'end').graph;
    g = connect(g, { source: 'ask_buttons_1', target: 'end_1', sourceHandle: 'opcion_1' });
    g = connect(g, { source: 'ask_buttons_1', target: 'end_1', sourceHandle: 'opcion_2' });
    g = removeOption(g, 'ask_buttons_1', 'opcion_1');

    assert.deepEqual(g.edges.map((e) => e.on), ['opcion_2']);
    assert.equal(optionsOf(g.nodes[0]).length, 1);
  });

  it('no se pueden agregar más opciones de las que muestra WhatsApp', () => {
    let g = addNode(EMPTY, 'ask_buttons').graph;
    for (let i = 0; i < 6; i++) g = addOption(g, 'ask_buttons_1');
    assert.equal(optionsOf(g.nodes[0]).length, maxOptions('ask_buttons'));
  });

  it('una lista acepta más que unos botones', () => {
    let g = addNode(EMPTY, 'ask_list').graph;
    for (let i = 0; i < 15; i++) g = addOption(g, 'ask_list_1');
    assert.equal(optionsOf(g.nodes[0]).length, maxOptions('ask_list'));
  });

  it('un paso que no es pregunta no acepta opciones', () => {
    const g = addOption(addNode(EMPTY, 'message').graph, 'message_1');
    assert.equal(g.nodes[0]?.options, undefined);
  });
});

describe('avisos de una pregunta', () => {
  it('avisa por una opción sin texto, aunque sea la única', () => {
    // La regla vieja se callaba hasta la segunda flecha, justo cuando todavía se
    // podía arreglar barato.
    let g = addNode(EMPTY, 'ask_buttons').graph;
    g = addOption(g, 'ask_buttons_1');
    assert.ok(outgoingProblems(g, 'ask_buttons_1').some((p) => p.includes('sin texto')));
  });

  it('avisa por dos opciones que dicen lo mismo', () => {
    let g = pregunta();
    g = patchOption(g, 'ask_buttons_1', 'opcion_2', { label: 'Comprar' });
    assert.ok(outgoingProblems(g, 'ask_buttons_1').some((p) => p.includes('dos opciones')));
  });

  it('avisa por una flecha atada a una opción que ya no existe', () => {
    let g = pregunta();
    g = addNode(g, 'end').graph;
    g = connect(g, { source: 'ask_buttons_1', target: 'end_1', sourceHandle: 'opcion_1' });
    g = patchNode(g, 'ask_buttons_1', { options: [{ value: 'opcion_2', label: 'Ayuda' }] });

    assert.ok(outgoingProblems(g, 'ask_buttons_1').some((p) => p.includes('ya no corresponde')));
  });

  it('avisa por una flecha que no sale de ninguna opción', () => {
    let g = pregunta();
    g = addNode(g, 'end').graph;
    g = connect(g, { source: 'ask_buttons_1', target: 'end_1' });
    assert.ok(outgoingProblems(g, 'ask_buttons_1').some((p) => p.includes('cualquier respuesta')));
  });

  it('con opciones en vivo, esa misma flecha es la correcta y no se avisa', () => {
    let g = patchNode(pregunta(), 'ask_buttons_1', { optionsFrom: 'vars.presentations' });
    g = addNode(g, 'end').graph;
    g = connect(g, { source: 'ask_buttons_1', target: 'end_1' });
    assert.ok(!outgoingProblems(g, 'ask_buttons_1').some((p) => p.includes('cualquier respuesta')));
  });

  it('una pregunta bien armada no avisa nada', () => {
    let g = pregunta();
    g = addNode(g, 'end').graph;
    g = connect(g, { source: 'ask_buttons_1', target: 'end_1', sourceHandle: 'opcion_1' });
    g = connect(g, { source: 'ask_buttons_1', target: 'end_1', sourceHandle: 'opcion_2' });
    assert.deepEqual(outgoingProblems(g, 'ask_buttons_1'), []);
  });
});

describe('meter un paso en el medio de una flecha', () => {
  /** `menu --opcion_1--> fin`, que es la forma en que quedan los recorridos reales. */
  function cableado(): Graph {
    let g = pregunta();
    g = addNode(g, 'end').graph;
    g = connect(g, { source: 'ask_buttons_1', target: 'end_1', sourceHandle: 'opcion_1' });
    return g;
  }

  it('A → B pasa a A → NUEVO → B', () => {
    const { graph, id } = insertBetween(cableado(), 'e_1', 'message');
    assert.equal(id, 'message_1');
    assert.equal(graph.edges.length, 2);
    assert.deepEqual(
      graph.edges.map((e) => [e.source, e.target]),
      [
        ['ask_buttons_1', 'message_1'],
        ['message_1', 'end_1'],
      ],
    );
  });

  it('la flecha entrante CONSERVA su id y su opción', () => {
    // Rehacerla perdía la opción a la que estaba atada —el operador insertaba un
    // mensaje y la rama dejaba de funcionar— y le cambiaba el id, que es lo que la
    // traza usa para contar por dónde pasó cada conversación.
    const { graph } = insertBetween(cableado(), 'e_1', 'message');
    const entrante = graph.edges.find((e) => e.id === 'e_1');
    assert.equal(entrante?.on, 'opcion_1');
    assert.equal(entrante?.target, 'message_1');
  });

  it('conserva también la condición de una flecha condicional', () => {
    let g = addNode(EMPTY, 'action').graph;
    g = addNode(g, 'end').graph;
    g = connect(g, { source: 'action_1', target: 'end_1' });
    g = patchEdge(g, 'e_1', { when: { path: 'vars.selected_variant', op: 'exists' } });

    const { graph } = insertBetween(g, 'e_1', 'message');
    assert.deepEqual(graph.edges.find((e) => e.id === 'e_1')?.when, {
      path: 'vars.selected_variant',
      op: 'exists',
    });
  });

  it('el paso nuevo cae en el medio de los dos', () => {
    let g = cableado();
    g = applyPositions(g, [
      { id: 'ask_buttons_1', position: { x: 0, y: 0 } },
      { id: 'end_1', position: { x: 200, y: 400 } },
    ]);
    const { graph, id } = insertBetween(g, 'e_1', 'message');
    assert.deepEqual(graph.nodes.find((n) => n.id === id)?.position, { x: 100, y: 200 });
  });

  it('una bifurcación insertada sale atada a su propia rama', () => {
    // Una bifurcación nace con una rama declarada, y el motor sólo recorre las
    // flechas que la nombran: sin `on` la salida hacia B no se tomaría nunca.
    const { graph, id } = insertBetween(cableado(), 'e_1', 'condition');
    const saliente = graph.edges.find((e) => e.source === id);
    assert.equal(saliente?.on, 'salida_1');
  });

  it('un Fin no se puede meter en el medio', () => {
    // Cortaría el recorrido y dejaría a B inalcanzable.
    const { graph, id } = insertBetween(cableado(), 'e_1', 'end');
    assert.equal(id, null);
    assert.equal(graph.edges.length, 1);
  });

  it('una derivación tampoco', () => {
    assert.equal(insertBetween(cableado(), 'e_1', 'handoff').id, null);
  });

  it('una Entrada tampoco: no recibe la flecha que le llega', () => {
    assert.equal(insertBetween(cableado(), 'e_1', 'start').id, null);
  });

  it('con una flecha que no existe no cambia nada', () => {
    const antes = cableado();
    const { graph, id } = insertBetween(antes, 'e_99', 'message');
    assert.equal(id, null);
    assert.deepEqual(graph, antes);
  });

  it('no toca las otras flechas', () => {
    let g = cableado();
    g = connect(g, { source: 'ask_buttons_1', target: 'end_1', sourceHandle: 'opcion_2' });
    const { graph } = insertBetween(g, 'e_1', 'message');
    assert.ok(graph.edges.some((e) => e.id === 'e_2' && e.on === 'opcion_2' && e.target === 'end_1'));
  });
});

describe('duplicar un paso', () => {
  it('copia el contenido con un id nuevo, corrido para que se vea', () => {
    let g = addNode(EMPTY, 'message', { x: 100, y: 100 }).graph;
    g = patchNode(g, 'message_1', { label: 'Saludo', body: 'Hola' });

    const { graph, id } = duplicateNode(g, 'message_1');
    const copia = graph.nodes.find((n) => n.id === id);
    assert.equal(id, 'message_2');
    assert.equal(copia?.body, 'Hola');
    assert.equal(copia?.label, 'Saludo (copia)');
    assert.notDeepEqual(copia?.position, { x: 100, y: 100 });
  });

  it('no se lleva las flechas del original', () => {
    // Arrastrarlas dejaría dos flechas saliendo de la misma opción, que el motor no
    // puede desambiguar.
    let g = addNode(EMPTY, 'message').graph;
    g = addNode(g, 'end').graph;
    g = connect(g, { source: 'message_1', target: 'end_1' });

    const { graph } = duplicateNode(g, 'message_1');
    assert.equal(graph.edges.length, 1);
    assert.equal(graph.edges[0]?.source, 'message_1');
  });

  it('las opciones se copian por valor, no compartidas', () => {
    const { graph, id } = duplicateNode(pregunta(), 'ask_buttons_1');
    const conCambio = patchOption(graph, id as string, 'opcion_1', { label: 'Otra cosa' });
    assert.equal(optionsOf(conCambio.nodes.find((n) => n.id === 'ask_buttons_1'))[0]?.label, 'Comprar');
  });

  it('las ramas también', () => {
    const g = addNode(EMPTY, 'condition').graph;
    const { graph, id } = duplicateNode(g, 'condition_1');
    const conCambio = patchBranch(graph, id as string, 'salida_1', { label: 'Cambiada' });
    assert.equal(branchesOf(conCambio.nodes[0])[0]?.label, 'Salida 1');
  });

  it('una entrada duplicada PIERDE el catch-all', () => {
    // Tiene que haber exactamente uno en el grafo: copiarlo dejaría el recorrido
    // impublicable apenas se aprieta el botón.
    let g = addNode(EMPTY, 'start').graph;
    g = patchNode(g, 'start_1', { match: { keywords: ['hola'], fallback: true } });

    const { graph, id } = duplicateNode(g, 'start_1');
    const copia = graph.nodes.find((n) => n.id === id);
    assert.equal(copia?.match?.fallback, undefined);
    assert.deepEqual(copia?.match?.keywords, ['hola']);
  });

  it('un paso sin nombre se copia sin nombre, no con "(copia)" solo', () => {
    const { graph, id } = duplicateNode(addNode(EMPTY, 'message').graph, 'message_1');
    assert.equal(graph.nodes.find((n) => n.id === id)?.label, undefined);
  });

  it('un id que no existe no cambia nada', () => {
    const antes = pregunta();
    const { graph, id } = duplicateNode(antes, 'no_existe');
    assert.equal(id, null);
    assert.deepEqual(graph, antes);
  });
});

describe('colgar un paso de un conector suelto', () => {
  it('lo crea debajo y lo deja atado a esa salida', () => {
    // Sin esto, cablear una opción son tres movimientos, y el del medio —encontrar
    // el paso nuevo en el canvas— es imposible apenas el recorrido crece.
    const { graph, id } = addAndConnect(pregunta(), 'ask_buttons_1', 'opcion_2', 'message');
    assert.equal(id, 'message_1');
    assert.deepEqual(graph.edges, [
      { id: 'e_1', source: 'ask_buttons_1', target: 'message_1', on: 'opcion_2' },
    ]);
  });

  it('el paso nuevo queda más abajo que el de origen', () => {
    const g = applyPositions(pregunta(), [{ id: 'ask_buttons_1', position: { x: 50, y: 50 } }]);
    const { graph, id } = addAndConnect(g, 'ask_buttons_1', 'opcion_1', 'message');
    const nuevo = graph.nodes.find((n) => n.id === id);
    assert.ok((nuevo?.position?.y ?? 0) > 50);
  });

  it('si el lugar de abajo está ocupado, lo corre', () => {
    let g = applyPositions(pregunta(), [{ id: 'ask_buttons_1', position: { x: 0, y: 0 } }]);
    g = addNode(g, 'end', { x: 0, y: 140 }).graph;
    const { graph, id } = addAndConnect(g, 'ask_buttons_1', 'opcion_1', 'message');
    assert.notDeepEqual(graph.nodes.find((n) => n.id === id)?.position, { x: 0, y: 140 });
  });

  it('no se puede colgar una Entrada', () => {
    const { graph, id } = addAndConnect(pregunta(), 'ask_buttons_1', 'opcion_1', 'start');
    assert.equal(id, null);
    assert.equal(graph.nodes.length, 1);
  });

  it('desde un origen que no existe no hace nada', () => {
    const antes = pregunta();
    const { graph, id } = addAndConnect(antes, 'no_existe', 'x', 'message');
    assert.equal(id, null);
    assert.deepEqual(graph, antes);
  });

  it('si la salida ya estaba cableada, el paso igual queda', () => {
    // Borrarlo dejaría al operador sin saber qué pasó con su clic.
    let g = pregunta();
    g = addNode(g, 'end').graph;
    g = connect(g, { source: 'ask_buttons_1', target: 'end_1', sourceHandle: 'opcion_1' });
    const { graph, id } = addAndConnect(g, 'ask_buttons_1', 'opcion_1', 'message');
    assert.ok(graph.nodes.some((n) => n.id === id));
    assert.equal(graph.edges.length, 1);
  });
});

describe('las acciones que se pueden elegir', () => {
  it('toda acción con argumentos declarados está en la lista', () => {
    // Si no, el inspector ofrece configurar algo que no se puede elegir.
    for (const tool of Object.keys(ACTION_ARGS)) {
      assert.ok(ACTIONS.some((a) => a.value === tool), `${tool} tiene argumentos pero no está en ACTIONS`);
    }
  });

  it('no hay dos acciones con el mismo id', () => {
    assert.equal(new Set(ACTIONS.map((a) => a.value)).size, ACTIONS.length);
  });

  it('todas tienen nombre en castellano', () => {
    for (const action of ACTIONS) assert.ok(action.label.length > 0, action.value);
  });

  it('el nombre visible sale de la lista, y si no está se muestra el id', () => {
    assert.equal(actionLabel('wa_add_to_cart'), 'Agregar al carrito');
    assert.equal(actionLabel('wa_inventada'), 'wa_inventada');
    assert.equal(actionLabel(undefined), '');
  });
});

describe('qué se puede poner dónde', () => {
  it('en el medio de una flecha sólo van los pasos que reciben y sacan', () => {
    assert.deepEqual(
      [...INSERTABLE_TYPES],
      // El agente entra: recibe el turno y lo devuelve, así que puede ir en el medio
      // de una flecha como cualquier otro paso que no corta el recorrido.
      ['message', 'ask_buttons', 'ask_list', 'ask_text', 'condition', 'action', 'agent'],
    );
  });

  it('de un conector se puede colgar todo lo que recibe', () => {
    assert.ok(!CONNECTABLE_TARGET_TYPES.includes('start'));
    assert.ok(CONNECTABLE_TARGET_TYPES.includes('end'));
    assert.ok(CONNECTABLE_TARGET_TYPES.includes('handoff'));
  });
});

describe('agregar un paso donde el operador lo pidió', () => {
  it('con una posición explícita la respeta', () => {
    const { graph } = addNode(EMPTY, 'message', { x: 777, y: 42 });
    assert.deepEqual(graph.nodes[0]?.position, { x: 777, y: 42 });
  });

  it('sin posición sigue cayendo en la grilla', () => {
    const { graph } = addNode(EMPTY, 'message');
    assert.deepEqual(graph.nodes[0]?.position, nextPosition(0));
  });
});
