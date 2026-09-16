import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { advance, emptyState, flowTapId, parseFlowTapId, type FlowState } from './engine';
import { validateGraph, type FlowGraph } from './graph';

/** Menú → compra o sucursales. Es el recorrido más chico que ejerce todo. */
const MENU: FlowGraph = {
  nodes: [
    { id: 'inicio', type: 'start', match: { keywords: ['hola'], fallback: true } },
    {
      id: 'menu',
      type: 'ask_buttons',
      body: '¿Qué necesitás?',
      options: [
        { value: 'buy', label: 'Comprar' },
        { value: 'shops', label: 'Sucursales' },
        { value: 'human', label: 'Hablar con alguien' },
      ],
    },
    { id: 'saludo_compra', type: 'message', body: '¡Genial! Contame qué buscás.' },
    { id: 'buscar', type: 'action', tool: 'wa_search_products', args: {} },
    { id: 'sucursales', type: 'action', tool: 'wa_store_locations', args: {} },
    { id: 'persona', type: 'handoff', reason: 'lo pidió el cliente' },
    { id: 'fin', type: 'end', body: '¡Gracias!' },
  ],
  edges: [
    { id: 'e0', source: 'inicio', target: 'menu' },
    { id: 'e1', source: 'menu', target: 'saludo_compra', on: 'buy' },
    { id: 'e2', source: 'menu', target: 'sucursales', on: 'shops' },
    { id: 'e3', source: 'menu', target: 'persona', on: 'human' },
    { id: 'e4', source: 'saludo_compra', target: 'buscar' },
    { id: 'e5', source: 'buscar', target: 'fin' },
    { id: 'e6', source: 'sucursales', target: 'fin' },
  ],
};

const state = (over: Partial<FlowState> = {}): FlowState => ({ ...emptyState('v1'), ...over });

describe('advance — entrada', () => {
  it('un saludo entra por el start y deja la pregunta esperando', () => {
    const plan = advance(MENU, state(), { text: 'hola', selectionId: null });

    assert.equal(plan.handled, true);
    assert.equal(plan.reason, 'awaiting_reply');
    assert.equal(plan.steps.length, 1);
    assert.equal(plan.steps[0].kind, 'ask_buttons');
    assert.equal(plan.state.node_id, 'menu');
  });

  it('los ids de botón llevan el nodo adentro, así una respuesta vieja no se confunde', () => {
    const plan = advance(MENU, state(), { text: 'hola', selectionId: null });
    const step = plan.steps[0];
    assert.equal(step.kind, 'ask_buttons');
    if (step.kind !== 'ask_buttons') return;
    assert.deepEqual(
      step.buttons.map((b) => b.id),
      [flowTapId('menu', 'buy'), flowTapId('menu', 'shops'), flowTapId('menu', 'human')],
    );
  });

  it('sin catch-all, lo que no matchea NO se responde con cualquier cosa', () => {
    const sinFallback: FlowGraph = {
      ...MENU,
      nodes: MENU.nodes.map((n) => (n.id === 'inicio' ? { ...n, match: { keywords: ['hola'] } } : n)),
    };
    const plan = advance(sinFallback, state(), { text: 'cuanto sale el latex', selectionId: null });

    assert.equal(plan.handled, false);
    assert.equal(plan.reason, 'no_match');
    assert.deepEqual(plan.steps, []);
  });
});

describe('advance — respuestas', () => {
  it('un tap elige la rama y encadena hasta la acción', () => {
    const waiting = state({ node_id: 'menu' });
    const plan = advance(MENU, waiting, { text: null, selectionId: flowTapId('menu', 'buy') });

    // `message` no bloquea, `action` sí: los dos entran en el mismo turno.
    assert.deepEqual(
      plan.steps.map((s) => s.kind),
      ['send_text', 'run_tool'],
    );
    assert.equal(plan.state.answers.menu, 'buy');
    assert.equal(plan.state.node_id, 'buscar');
  });

  it('vale escribir la etiqueta en vez de tocar el botón', () => {
    const waiting = state({ node_id: 'menu' });
    const plan = advance(MENU, waiting, { text: 'Sucursales', selectionId: null });

    assert.equal(plan.state.answers.menu, 'shops');
    assert.equal(plan.steps[0].kind, 'run_tool');
  });

  it('el cliente puede cambiar de tema: un mensaje que no es la respuesta reentra por el start', () => {
    // Preso de la pregunta es el peor modo de falla de un árbol: el cliente
    // escribe otra cosa tres veces y el bot repite el mismo menú.
    const waiting = state({ node_id: 'menu' });
    const plan = advance(MENU, waiting, { text: 'hola de nuevo', selectionId: null });

    assert.equal(plan.handled, true);
    assert.equal(plan.state.node_id, 'menu');
    assert.equal(plan.state.answers.menu, undefined);
  });

  it('un tap de OTRO nodo no se toma como respuesta de éste', () => {
    const waiting = state({ node_id: 'menu' });
    const plan = advance(MENU, waiting, { text: null, selectionId: flowTapId('otro', 'buy') });

    assert.equal(plan.state.answers.menu, undefined);
  });

  it('después de una acción, el turno siguiente sale por su arista', () => {
    const afterAction = state({ node_id: 'buscar' });
    const plan = advance(MENU, afterAction, { text: 'gracias', selectionId: null });

    assert.equal(plan.reason, 'ended');
    assert.equal(plan.state.node_id, null);
    assert.equal(plan.steps[0].kind, 'send_text');
  });

  it('el handoff corta y libera el nodo', () => {
    const waiting = state({ node_id: 'menu' });
    const plan = advance(MENU, waiting, { text: null, selectionId: flowTapId('menu', 'human') });

    assert.equal(plan.reason, 'handoff');
    assert.equal(plan.steps[0].kind, 'handoff');
    assert.equal(plan.state.node_id, null);
  });
});

describe('advance — condiciones', () => {
  const CON_CONDICION: FlowGraph = {
    nodes: [
      { id: 'inicio', type: 'start', match: { fallback: true } },
      { id: 'chequeo', type: 'condition' },
      { id: 'con_carrito', type: 'message', body: 'Tenés cosas en el carrito.' },
      { id: 'sin_carrito', type: 'message', body: 'Tu carrito está vacío.' },
      { id: 'fin', type: 'end' },
    ],
    edges: [
      { id: 'e0', source: 'inicio', target: 'chequeo' },
      { id: 'e1', source: 'chequeo', target: 'con_carrito', when: { path: 'vars.cart_units', op: 'exists' } },
      { id: 'e2', source: 'chequeo', target: 'sin_carrito' },
      { id: 'e3', source: 'con_carrito', target: 'fin' },
      { id: 'e4', source: 'sin_carrito', target: 'fin' },
    ],
  };

  it('toma la rama cuya condición se cumple', () => {
    const plan = advance(CON_CONDICION, state({ vars: { cart_units: 3 } }), { text: 'hola', selectionId: null });
    assert.equal((plan.steps[0] as { body: string }).body, 'Tenés cosas en el carrito.');
  });

  it('cae a la rama por default cuando no se cumple ninguna', () => {
    const plan = advance(CON_CONDICION, state(), { text: 'hola', selectionId: null });
    assert.equal((plan.steps[0] as { body: string }).body, 'Tu carrito está vacío.');
  });

  it('un operador desconocido NO toma la rama por descarte', () => {
    const roto: FlowGraph = {
      ...CON_CONDICION,
      edges: CON_CONDICION.edges.map((e) =>
        e.id === 'e1' ? { ...e, when: { path: 'vars.x', op: 'gt' as never, value: 1 } } : e,
      ),
    };
    const plan = advance(roto, state({ vars: { x: 99 } }), { text: 'hola', selectionId: null });
    assert.equal((plan.steps[0] as { body: string }).body, 'Tu carrito está vacío.');
  });
});

describe('advance — grafos rotos', () => {
  it('un ciclo de nodos que no bloquean no cuelga el turno', () => {
    const bucle: FlowGraph = {
      nodes: [
        { id: 'inicio', type: 'start', match: { fallback: true } },
        { id: 'a', type: 'message', body: 'a' },
        { id: 'b', type: 'message', body: 'b' },
      ],
      edges: [
        { id: 'e0', source: 'inicio', target: 'a' },
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e2', source: 'b', target: 'a' },
      ],
    };
    const plan = advance(bucle, state(), { text: 'hola', selectionId: null });
    assert.equal(plan.reason, 'broken_graph');
    assert.ok(plan.steps.length > 0 && plan.steps.length < 100);
  });

  it('una arista colgada no lanza', () => {
    const colgada: FlowGraph = {
      nodes: [{ id: 'inicio', type: 'start', match: { fallback: true } }],
      edges: [{ id: 'e0', source: 'inicio', target: 'no_existe' }],
    };
    const plan = advance(colgada, state(), { text: 'hola', selectionId: null });
    assert.equal(plan.handled, false);
    assert.equal(plan.reason, 'broken_graph');
  });
});

describe('parseFlowTapId', () => {
  it('ida y vuelta', () => {
    assert.deepEqual(parseFlowTapId(flowTapId('menu', 'buy')), { nodeId: 'menu', value: 'buy' });
  });

  it('el valor puede traer dos puntos', () => {
    assert.deepEqual(parseFlowTapId(flowTapId('n', 'a:b')), { nodeId: 'n', value: 'a:b' });
  });

  it('ignora los ids del bot viejo', () => {
    for (const id of ['act:buy', 'adv:surface:wood', 'variant_123', 'flow:', 'flow:solo']) {
      assert.equal(parseFlowTapId(id), null, id);
    }
  });
});

describe('validateGraph', () => {
  it('el grafo de ejemplo está sano', () => {
    assert.deepEqual(validateGraph(MENU), []);
  });

  it('una opción sin arista es un botón que no hace nada', () => {
    const roto: FlowGraph = {
      ...MENU,
      edges: MENU.edges.filter((e) => e.id !== 'e2'),
    };
    const issues = validateGraph(roto);
    assert.ok(issues.some((i) => i.message.includes('Sucursales')));
  });

  it('sin catch-all avisa antes de publicar', () => {
    const sinFallback: FlowGraph = {
      ...MENU,
      nodes: MENU.nodes.map((n) => (n.id === 'inicio' ? { ...n, match: { keywords: ['hola'] } } : n)),
    };
    assert.ok(validateGraph(sinFallback).some((i) => i.message.includes('atiende lo inesperado')));
  });

  it('cuenta los botones contra el límite de WhatsApp', () => {
    const cuatro: FlowGraph = {
      nodes: [
        { id: 'inicio', type: 'start', match: { fallback: true } },
        {
          id: 'menu',
          type: 'ask_buttons',
          body: '¿?',
          options: ['a', 'b', 'c', 'd'].map((v) => ({ value: v, label: v })),
        },
        { id: 'fin', type: 'end' },
      ],
      edges: [
        { id: 'e0', source: 'inicio', target: 'menu' },
        ...['a', 'b', 'c', 'd'].map((v, i) => ({ id: `e${i + 1}`, source: 'menu', target: 'fin', on: v })),
      ],
    };
    assert.ok(validateGraph(cuatro).some((i) => i.message.includes('WhatsApp acepta 3')));
  });

  it('detecta un nodo al que no se llega', () => {
    const huerfano: FlowGraph = {
      ...MENU,
      nodes: [...MENU.nodes, { id: 'perdido', type: 'end', body: 'nadie me ve' }],
    };
    assert.ok(validateGraph(huerfano).some((i) => i.message.includes('no se llega')));
  });

  /**
   * Una bifurcación con UNA salida es válida, con condición o sin ella: puede ser
   * un desvío que a veces no se toma, y ahí el recorrido termina.
   *
   * Lo que NO puede pasar es que dos salidas no se distingan: el motor toma
   * siempre la primera y la segunda no corre nunca. Antes la regla estaba al
   * revés — bloqueaba el caso legítimo y dejaba pasar el ambiguo.
   */
  const conRamas = (edges: FlowGraph['edges']): FlowGraph => ({
    nodes: [
      { id: 'i', type: 'start', match: { fallback: true } },
      { id: 'c', type: 'condition' },
      { id: 'a', type: 'end', body: 'a' },
      { id: 'b', type: 'end', body: 'b' },
    ],
    edges: [{ id: 'e0', source: 'i', target: 'c' }, ...edges],
  });
  const problemasDeC = (g: FlowGraph) => validateGraph(g).filter((i) => i.nodeId === 'c');

  it('una sola salida vale, tenga condición o no', () => {
    assert.deepEqual(problemasDeC(conRamas([{ id: 'e1', source: 'c', target: 'a' }])), []);
    assert.deepEqual(
      problemasDeC(conRamas([{ id: 'e1', source: 'c', target: 'a', when: { path: 'vars.x', op: 'exists' } }])),
      [],
    );
  });

  it('una con condición y otra por default vale', () => {
    const g = conRamas([
      { id: 'e1', source: 'c', target: 'a', when: { path: 'vars.x', op: 'exists' } },
      { id: 'e2', source: 'c', target: 'b' },
    ]);
    assert.deepEqual(problemasDeC(g), []);
  });

  it('dos salidas sin condición NO se publican: la segunda no corre nunca', () => {
    const g = conRamas([
      { id: 'e1', source: 'c', target: 'a' },
      { id: 'e2', source: 'c', target: 'b' },
    ]);
    assert.ok(problemasDeC(g).some((i) => i.message.includes('no se recorren nunca')));
  });
});

describe('argumentos de una acción', () => {
  const BUSCAR: FlowGraph = {
    nodes: [
      { id: 'inicio', type: 'start', match: { fallback: true } },
      { id: 'que_buscas', type: 'ask_text', body: '¿Qué estás buscando?' },
      { id: 'buscar', type: 'action', tool: 'wa_search_products', args: { query: '{{text}}' } },
      { id: 'fin', type: 'end' },
    ],
    edges: [
      { id: 'e0', source: 'inicio', target: 'que_buscas' },
      { id: 'e1', source: 'que_buscas', target: 'buscar' },
      { id: 'e2', source: 'buscar', target: 'fin' },
    ],
  };

  it('un ask_text espera lo que el cliente escriba', () => {
    const plan = advance(BUSCAR, state(), { text: 'hola', selectionId: null });
    assert.equal(plan.steps[0].kind, 'ask_text');
    assert.equal(plan.state.node_id, 'que_buscas');
  });

  it('{{text}} se reemplaza por lo que escribió el cliente', () => {
    const waiting = state({ node_id: 'que_buscas' });
    const plan = advance(BUSCAR, waiting, { text: 'latex blanco 20 litros', selectionId: null });

    const step = plan.steps.find((s) => s.kind === 'run_tool');
    assert.ok(step && step.kind === 'run_tool');
    assert.deepEqual(step.args, { query: 'latex blanco 20 litros' });
    assert.equal(plan.state.answers.que_buscas, 'latex blanco 20 litros');
  });

  it('un tap NO cuenta como respuesta de texto libre', () => {
    // Si contara, el id del botón terminaría como término de búsqueda.
    const waiting = state({ node_id: 'que_buscas' });
    const plan = advance(BUSCAR, waiting, { text: null, selectionId: 'flow:menu:buy' });
    assert.equal(plan.state.answers.que_buscas, undefined);
  });

  it('no interpola parcialmente: sólo el string completo se reemplaza', () => {
    const conPrefijo: FlowGraph = {
      ...BUSCAR,
      nodes: BUSCAR.nodes.map((n) =>
        n.id === 'buscar' ? { ...n, args: { query: 'pintura {{text}}', fijo: 7 } } : n,
      ),
    };
    const plan = advance(conPrefijo, state({ node_id: 'que_buscas' }), { text: 'latex', selectionId: null });
    const step = plan.steps.find((s) => s.kind === 'run_tool');
    assert.ok(step && step.kind === 'run_tool');
    assert.deepEqual(step.args, { query: 'pintura {{text}}', fijo: 7 });
  });

  it('{{answers.nodo}} lee una respuesta anterior', () => {
    const conAnswer: FlowGraph = {
      ...BUSCAR,
      nodes: BUSCAR.nodes.map((n) =>
        n.id === 'buscar' ? { ...n, args: { query: '{{answers.que_buscas}}' } } : n,
      ),
    };
    const plan = advance(conAnswer, state({ node_id: 'que_buscas' }), { text: 'esmalte', selectionId: null });
    const step = plan.steps.find((s) => s.kind === 'run_tool');
    assert.ok(step && step.kind === 'run_tool');
    assert.deepEqual(step.args, { query: 'esmalte' });
  });
});

describe('los textos se personalizan', () => {
  const CON_NOMBRE: FlowGraph = {
    nodes: [
      { id: 'inicio', type: 'start', match: { fallback: true } },
      { id: 'que', type: 'ask_text', body: '¿Qué buscás?' },
      { id: 'ok', type: 'message', body: 'Perfecto, busco {{answers.que}} 🔎' },
      { id: 'fin', type: 'end', body: 'Listo {{vars.nombre}}. ¡Gracias!' },
    ],
    edges: [
      { id: 'e0', source: 'inicio', target: 'que' },
      { id: 'e1', source: 'que', target: 'ok' },
      { id: 'e2', source: 'ok', target: 'fin' },
    ],
  };

  it('usa la respuesta anterior dentro del mensaje', () => {
    const plan = advance(CON_NOMBRE, state({ node_id: 'que' }), { text: 'látex blanco', selectionId: null });
    const dicho = plan.steps.filter((s) => s.kind === 'send_text').map((s) => (s as { body: string }).body);
    assert.ok(dicho.includes('Perfecto, busco látex blanco 🔎'));
  });

  it('lo que no conoce se va en vacío, no deja el andamio a la vista', () => {
    // Un cliente que recibe "Listo {{vars.nombre}}" ve las tripas del sistema.
    const plan = advance(CON_NOMBRE, state({ node_id: 'que' }), { text: 'esmalte', selectionId: null });
    const fin = plan.steps.filter((s) => s.kind === 'send_text').map((s) => (s as { body: string }).body).pop();
    assert.equal(fin, 'Listo . ¡Gracias!');
    assert.ok(!fin?.includes('{{'));
  });

  it('una variable de sesión se interpola', () => {
    const plan = advance(
      CON_NOMBRE,
      { ...state({ node_id: 'que' }), vars: { nombre: 'Juan' } },
      { text: 'rodillo', selectionId: null },
    );
    const fin = plan.steps.filter((s) => s.kind === 'send_text').map((s) => (s as { body: string }).body).pop();
    assert.equal(fin, 'Listo Juan. ¡Gracias!');
  });

  it('los ARGUMENTOS siguen siendo estrictos: nada de interpolación parcial', () => {
    // Un argumento viaja a una tool; pegarle texto del cliente en el medio es una
    // vía de inyección. Un mensaje vuelve a quien lo escribió: ahí no hay riesgo.
    const conArg: FlowGraph = {
      nodes: [
        { id: 'inicio', type: 'start', match: { fallback: true } },
        { id: 'a', type: 'action', tool: 'wa_search_products', args: { query: 'pintura {{text}}' } },
        { id: 'fin', type: 'end' },
      ],
      edges: [
        { id: 'e0', source: 'inicio', target: 'a' },
        { id: 'e1', source: 'a', target: 'fin' },
      ],
    };
    const plan = advance(conArg, state(), { text: 'latex', selectionId: null });
    const tool = plan.steps.find((s) => s.kind === 'run_tool');
    assert.deepEqual((tool as { args: Record<string, unknown> }).args, { query: 'pintura {{text}}' });
  });
});

// ─── Bifurcación con salidas declaradas ───────────────────────────────────────

/**
 * Tres ramas sobre el mismo estado. La bifurcación DECLARA sus salidas y las
 * aristas sólo las atan por `on`: es el modelo del nodo `decide` de Kapso, donde
 * el nodo lleva la lista de condiciones y la arista matchea su label.
 */
const TRES_RAMAS: FlowGraph = {
  nodes: [
    { id: 'inicio', type: 'start', match: { keywords: ['hola'], fallback: true } },
    {
      id: 'decidir',
      type: 'condition',
      branches: [
        { value: 'vip', label: 'VIP', when: { path: 'vars.tier', op: 'eq', value: 'vip' } },
        { value: 'con_carrito', label: 'Con carrito', when: { path: 'vars.cart_units', op: 'exists' } },
        { value: 'resto', label: 'El resto' },
      ],
    },
    { id: 'fin_vip', type: 'end', body: 'Hola de nuevo.' },
    { id: 'fin_carrito', type: 'end', body: 'Tenés cosas en el carrito.' },
    { id: 'fin_resto', type: 'end', body: '¡Gracias!' },
  ],
  edges: [
    { id: 'e0', source: 'inicio', target: 'decidir' },
    { id: 'e1', source: 'decidir', target: 'fin_vip', on: 'vip' },
    { id: 'e2', source: 'decidir', target: 'fin_carrito', on: 'con_carrito' },
    { id: 'e3', source: 'decidir', target: 'fin_resto', on: 'resto' },
  ],
};

const textoDe = (plan: ReturnType<typeof advance>): string | undefined => {
  const step = plan.steps.find((s) => s.kind === 'send_text');
  return step && step.kind === 'send_text' ? step.body : undefined;
};

describe('advance — bifurcación con salidas declaradas', () => {
  it('el grafo de tres ramas es válido', () => {
    assert.deepEqual(validateGraph(TRES_RAMAS), []);
  });

  it('toma la primera rama cuya condición se cumple', () => {
    const plan = advance(TRES_RAMAS, state({ vars: { tier: 'vip', cart_units: 2 } }), {
      text: 'hola',
      selectionId: null,
    });
    assert.equal(textoDe(plan), 'Hola de nuevo.');
  });

  it('con la primera sin cumplirse, sigue por la segunda', () => {
    const plan = advance(TRES_RAMAS, state({ vars: { cart_units: 2 } }), { text: 'hola', selectionId: null });
    assert.equal(textoDe(plan), 'Tenés cosas en el carrito.');
  });

  it('sin ninguna condición cumplida, cae en la salida por default', () => {
    const plan = advance(TRES_RAMAS, state(), { text: 'hola', selectionId: null });
    assert.equal(textoDe(plan), '¡Gracias!');
  });

  it('sin salida por default y sin condición cumplida, el recorrido se corta', () => {
    // No se inventa un camino: el motor reporta el grafo roto en vez de irse por
    // la primera arista que encuentre.
    const sinDefault: FlowGraph = {
      ...TRES_RAMAS,
      nodes: TRES_RAMAS.nodes.map((n) =>
        n.id === 'decidir' ? { ...n, branches: (n.branches ?? []).filter((b) => b.value !== 'resto') } : n,
      ),
      edges: TRES_RAMAS.edges.filter((e) => e.on !== 'resto'),
    };
    const plan = advance(sinDefault, state(), { text: 'hola', selectionId: null });
    assert.equal(plan.reason, 'broken_graph');
  });

  it('la rama elegida SIN arista no se va por una suelta', () => {
    // Con la rama `vip` a medio cablear, caer al `pickEdge` general habría tomado
    // la arista incondicional y mandado al cliente por un camino que nadie eligió.
    const aMedioCablear: FlowGraph = {
      ...TRES_RAMAS,
      edges: [
        { id: 'e0', source: 'inicio', target: 'decidir' },
        { id: 'e_suelta', source: 'decidir', target: 'fin_resto' },
      ],
    };
    const plan = advance(aMedioCablear, state({ vars: { tier: 'vip' } }), { text: 'hola', selectionId: null });
    assert.equal(plan.reason, 'broken_graph');
  });

  it('una bifurcación del formato VIEJO sigue resolviéndose por el `when` de la arista', () => {
    // Es lo que hay guardado en los recorridos ya publicados: sin esta salida,
    // publicar esta versión los rompía a todos.
    const viejo: FlowGraph = {
      nodes: [
        { id: 'inicio', type: 'start', match: { keywords: ['hola'], fallback: true } },
        { id: 'decidir', type: 'condition' },
        { id: 'fin_a', type: 'end', body: 'Rama A.' },
        { id: 'fin_b', type: 'end', body: 'Rama B.' },
      ],
      edges: [
        { id: 'e0', source: 'inicio', target: 'decidir' },
        { id: 'e1', source: 'decidir', target: 'fin_a', when: { path: 'vars.tier', op: 'eq', value: 'vip' } },
        { id: 'e2', source: 'decidir', target: 'fin_b' },
      ],
    };

    assert.equal(textoDe(advance(viejo, state({ vars: { tier: 'vip' } }), { text: 'hola', selectionId: null })), 'Rama A.');
    assert.equal(textoDe(advance(viejo, state(), { text: 'hola', selectionId: null })), 'Rama B.');
  });
});

// ─── Opciones que llegan en vivo ──────────────────────────────────────────────

/**
 * "¿Qué presentación necesitás?" — la pregunta que el recorrido del documento hace
 * todo el tiempo y que hasta ahora no se podía dibujar: las presentaciones dependen
 * del producto que el cliente acaba de elegir.
 */
const CON_LISTA_VIVA: FlowGraph = {
  nodes: [
    { id: 'inicio', type: 'start', match: { keywords: ['hola'], fallback: true } },
    {
      id: 'presentacion',
      type: 'ask_list',
      body: '¿Qué presentación necesitás?',
      optionsFrom: 'vars.presentations',
      // Las dibujadas son la salida de emergencia y tienen su propia arista.
      options: [{ value: 'volver', label: 'Volver a resultados' }],
    },
    { id: 'agregar', type: 'action', tool: 'wa_add_to_cart', args: { variant_id: '{{answers.presentacion}}' }, silent: true },
    { id: 'fin', type: 'end', body: 'Listo.' },
    { id: 'resultados', type: 'end', body: 'Volvamos.' },
  ],
  edges: [
    { id: 'e0', source: 'inicio', target: 'presentacion' },
    { id: 'e1', source: 'presentacion', target: 'resultados', on: 'volver' },
    // La incondicional: por acá sale TODO lo que vino de la variable.
    { id: 'e2', source: 'presentacion', target: 'agregar' },
    { id: 'e3', source: 'agregar', target: 'fin' },
  ],
};

const conVars = (vars: Record<string, unknown>): FlowState => ({ ...emptyState('v1'), ...{ vars } });

describe('advance — opciones que llegan en vivo', () => {
  it('el grafo es válido', () => {
    assert.deepEqual(validateGraph(CON_LISTA_VIVA), []);
  });

  it('la lista sale con las opciones de la variable y la dibujada al final', () => {
    const plan = advance(
      CON_LISTA_VIVA,
      conVars({ presentations: [{ value: 'var_20l', label: '20 L · $12.345' }, { value: 'var_4l', label: '4 L · $3.200' }] }),
      { text: 'hola', selectionId: null },
    );
    const step = plan.steps[0];
    assert.equal(step.kind, 'ask_list');
    if (step.kind !== 'ask_list') return;
    assert.deepEqual(step.rows.map((r) => r.title), ['20 L · $12.345', '4 L · $3.200', 'Volver a resultados']);
    // El path viaja en el paso: el runtime lo vuelve a resolver con `vars` frescos.
    assert.equal(step.optionsFrom, 'vars.presentations');
  });

  it('un string pelado alcanza como opción', () => {
    const plan = advance(CON_LISTA_VIVA, conVars({ presentations: ['1 unidad', '2 unidades'] }), {
      text: 'hola',
      selectionId: null,
    });
    const step = plan.steps[0];
    if (step.kind !== 'ask_list') return assert.fail('no es una lista');
    assert.deepEqual(step.rows.map((r) => r.title), ['1 unidad', '2 unidades', 'Volver a resultados']);
  });

  it('cuando no entran todas, se recortan las de la variable y NO la salida de emergencia', () => {
    // Recortar "Volver a resultados" deja al cliente encerrado en la pregunta.
    const muchas = Array.from({ length: 20 }, (_, i) => ({ value: `v${i}`, label: `Opción ${i}` }));
    const plan = advance(CON_LISTA_VIVA, conVars({ presentations: muchas }), { text: 'hola', selectionId: null });
    const step = plan.steps[0];
    if (step.kind !== 'ask_list') return assert.fail('no es una lista');
    assert.equal(step.rows.length, 10);
    assert.equal(step.rows[9]?.title, 'Volver a resultados');
  });

  it('elegir una opción VIVA sale por la arista sin condición', () => {
    const state: FlowState = {
      ...conVars({ presentations: [{ value: 'var_20l', label: '20 L' }] }),
      node_id: 'presentacion',
    };
    const plan = advance(CON_LISTA_VIVA, state, { text: null, selectionId: flowTapId('presentacion', 'var_20l') });

    assert.equal(plan.state.answers.presentacion, 'var_20l');
    const tool = plan.steps.find((s) => s.kind === 'run_tool');
    assert.equal(tool?.kind, 'run_tool');
    if (tool?.kind !== 'run_tool') return;
    // Y el valor elegido llega al carrito: es un `variant_id`.
    assert.equal(tool.args.variant_id, 'var_20l');
  });

  it('elegir una opción DIBUJADA sigue saliendo por su arista', () => {
    const state: FlowState = {
      ...conVars({ presentations: [{ value: 'var_20l', label: '20 L' }] }),
      node_id: 'presentacion',
    };
    const plan = advance(CON_LISTA_VIVA, state, { text: null, selectionId: flowTapId('presentacion', 'volver') });
    const text = plan.steps.find((s) => s.kind === 'send_text');
    assert.equal(text?.kind === 'send_text' ? text.body : null, 'Volvamos.');
  });

  it('el cliente puede ESCRIBIR el nombre de una opción viva', () => {
    // Mucha gente contesta escribiendo en vez de tocar la fila. Antes el fallback
    // por texto sólo miraba las dibujadas, así que no matcheaba nada.
    const state: FlowState = {
      ...conVars({ presentations: [{ value: 'var_20l', label: '20 L' }] }),
      node_id: 'presentacion',
    };
    const plan = advance(CON_LISTA_VIVA, state, { text: '20 L', selectionId: null });
    assert.equal(plan.state.answers.presentacion, 'var_20l');
  });

  it('una opción viva que repite el valor de una dibujada se descarta', () => {
    // Si no, el motor rutearía por la arista de la dibujada y el recorrido iría a
    // un lado que nadie eligió.
    const plan = advance(CON_LISTA_VIVA, conVars({ presentations: [{ value: 'volver', label: 'Otra cosa' }] }), {
      text: 'hola',
      selectionId: null,
    });
    const step = plan.steps[0];
    if (step.kind !== 'ask_list') return assert.fail('no es una lista');
    assert.deepEqual(step.rows.map((r) => r.title), ['Volver a resultados']);
  });

  it('sin la variable, la lista queda sólo con lo dibujado', () => {
    const plan = advance(CON_LISTA_VIVA, emptyState('v1'), { text: 'hola', selectionId: null });
    const step = plan.steps[0];
    if (step.kind !== 'ask_list') return assert.fail('no es una lista');
    assert.deepEqual(step.rows.map((r) => r.title), ['Volver a resultados']);
  });

  it('sin arista incondicional, el validador avisa', () => {
    // Lo que el cliente elija de la variable no lo nombra ninguna arista: sin la
    // incondicional el recorrido se corta justo después de elegir.
    const roto: FlowGraph = { ...CON_LISTA_VIVA, edges: CON_LISTA_VIVA.edges.filter((e) => e.id !== 'e2') };
    assert.ok(validateGraph(roto).some((i) => i.message.includes('no lleva a ningún lado')));
  });

  it('una lista viva puede nacer SIN opciones dibujadas', () => {
    const soloVivas: FlowGraph = {
      nodes: [
        { id: 'inicio', type: 'start', match: { keywords: ['hola'], fallback: true } },
        { id: 'p', type: 'ask_list', body: '¿Cuál?', optionsFrom: 'vars.x' },
        { id: 'fin', type: 'end', body: 'Listo.' },
      ],
      edges: [
        { id: 'e0', source: 'inicio', target: 'p' },
        { id: 'e1', source: 'p', target: 'fin' },
      ],
    };
    assert.deepEqual(validateGraph(soloVivas), []);
  });

  it('`optionsFrom` en un nodo que no pregunta es un error', () => {
    const raro: FlowGraph = {
      nodes: [
        { id: 'inicio', type: 'start', match: { keywords: ['hola'], fallback: true } },
        { id: 'm', type: 'message', body: 'hola', optionsFrom: 'vars.x' },
        { id: 'fin', type: 'end', body: 'Listo.' },
      ],
      edges: [
        { id: 'e0', source: 'inicio', target: 'm' },
        { id: 'e1', source: 'm', target: 'fin' },
      ],
    };
    assert.ok(validateGraph(raro).some((i) => i.message.includes('no es una pregunta con respuestas')));
  });
});
