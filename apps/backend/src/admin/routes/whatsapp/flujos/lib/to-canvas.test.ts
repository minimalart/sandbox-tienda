import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { SEED_GRAPH } from '../../../../../lib/whatsapp/flow/seed';
import { addNode, connect, nextPosition, patchNode, type Graph } from '../_editor';
import { liveIssues, type EditorIssue } from './issues';
import { CARD_WIDTH, mergeCanvasState, toCanvas, type WaCardData, type WaEdgeData } from './to-canvas';

const vista = (over: Partial<Parameters<typeof toCanvas>[1]> = {}) => ({
  issues: [] as EditorIssue[],
  isDark: false,
  selectedIds: [] as string[],
  selectedEdgeId: null,
  ...over,
});

const seed = SEED_GRAPH as Graph;
const cardOf = (nodes: ReturnType<typeof toCanvas>['nodes'], id: string) =>
  nodes.find((n) => n.id === id)?.data as unknown as WaCardData;
const edgeDataOf = (edges: ReturnType<typeof toCanvas>['edges'], id: string) =>
  edges.find((e) => e.id === id)?.data as unknown as WaEdgeData;

describe('toda flecha se engancha a un conector que existe', () => {
  /**
   * EL TEST QUE MÁS IMPORTA de este archivo. Una arista con un `sourceHandle` que el
   * nodo no dibuja es el error 008 de React Flow: no se dibuja, no avisa, y el
   * operador ve el recorrido con una conexión menos de las que tiene guardadas.
   */
  it('en el recorrido base, cada `sourceHandle` es un conector del nodo de origen', () => {
    const { nodes, edges } = toCanvas(seed, vista());
    for (const edge of edges) {
      const card = cardOf(nodes, edge.source);
      assert.ok(
        card.outputs.some((o) => o.id === edge.sourceHandle),
        `${edge.id} se engancha a "${edge.sourceHandle}", que ${edge.source} no dibuja`,
      );
    }
  });

  it('ninguna flecha queda sin conector declarado', () => {
    for (const edge of toCanvas(seed, vista()).edges) {
      assert.ok(edge.sourceHandle, `${edge.id} salió sin sourceHandle`);
    }
  });

  it('la flecha de una opción se engancha a esa opción', () => {
    const { edges } = toCanvas(seed, vista());
    assert.equal(edges.find((e) => e.id === 'e_buy')?.sourceHandle, 'buy');
    assert.equal(edges.find((e) => e.id === 'e_help')?.sourceHandle, 'help');
  });

  it('una flecha atada a una opción borrada cae al conector de rescate y no se pierde', () => {
    let g = addNode({ nodes: [], edges: [] }, 'ask_buttons').graph;
    g = patchNode(g, 'ask_buttons_1', { options: [{ value: 'a', label: 'A' }] });
    g = addNode(g, 'end').graph;
    g = connect(g, { source: 'ask_buttons_1', target: 'end_1', sourceHandle: 'a' });
    g = patchNode(g, 'ask_buttons_1', { options: [] });

    const { nodes, edges } = toCanvas(g, vista());
    assert.equal(edges.length, 1);
    assert.ok(cardOf(nodes, 'ask_buttons_1').outputs.some((o) => o.id === edges[0]?.sourceHandle));
  });
});

describe('lo que muestra la tarjeta', () => {
  it('trae el resumen del contenido, no sólo el tipo', () => {
    // Es lo que permite leer el recorrido sin abrir paso por paso.
    const { nodes } = toCanvas(seed, vista());
    assert.equal(cardOf(nodes, 'menu').summary, '¡Hola! 👋 ¿En qué puedo ayudarte?');
  });

  it('trae el nombre que le puso el operador, y nada si no le puso ninguno', () => {
    const { nodes } = toCanvas(seed, vista());
    assert.equal(cardOf(nodes, 'menu').name, 'Menú principal');

    const suelto = addNode({ nodes: [], edges: [] }, 'message').graph;
    assert.equal(cardOf(toCanvas(suelto, vista()).nodes, 'message_1').name, undefined);
  });

  it('una pregunta trae un conector por opción', () => {
    const { nodes } = toCanvas(seed, vista());
    assert.deepEqual(
      cardOf(nodes, 'menu').outputs.map((o) => o.id),
      ['buy', 'help', 'orders'],
    );
  });

  it('sabe si recibe flechas: una Entrada no', () => {
    const { nodes } = toCanvas(seed, vista());
    assert.equal(cardOf(nodes, 'inicio').hasTarget, false);
    assert.equal(cardOf(nodes, 'menu').hasTarget, true);
  });

  it('trae los problemas de ese paso y si alguno impide publicar', () => {
    let g = addNode({ nodes: [], edges: [] }, 'start').graph;
    g = patchNode(g, 'start_1', { match: { fallback: true } });
    g = addNode(g, 'message').graph;
    g = connect(g, { source: 'start_1', target: 'message_1' });

    const issues = liveIssues(g);
    const card = cardOf(toCanvas(g, vista({ issues })).nodes, 'message_1');
    assert.ok(card.issues.length > 0);
    assert.equal(card.blocked, true);
  });

  it('un paso sano no queda marcado', () => {
    const { nodes } = toCanvas(seed, vista({ issues: liveIssues(seed) }));
    assert.equal(cardOf(nodes, 'menu').blocked, false);
    assert.deepEqual(cardOf(nodes, 'menu').issues, []);
  });
});

describe('la geometría y la selección', () => {
  it('las tarjetas tienen ancho fijo y alto libre', () => {
    // Fijar el alto recortaría el texto de los pasos largos, que es justamente lo
    // que se vino a mostrar.
    for (const node of toCanvas(seed, vista()).nodes) {
      assert.equal(node.width, CARD_WIDTH);
      assert.equal(node.height, undefined);
    }
  });

  it('un paso sin posición guardada cae en la grilla y no en el origen', () => {
    const g = addNode({ nodes: [], edges: [] }, 'message').graph;
    const sinPosicion: Graph = { nodes: [{ id: 'x', type: 'message' }], edges: [] };
    assert.deepEqual(toCanvas(sinPosicion, vista()).nodes[0]?.position, nextPosition(0));
    assert.ok(g.nodes[0]?.position);
  });

  it('el paso seleccionado y sus flechas se marcan', () => {
    const { nodes, edges } = toCanvas(seed, vista({ selectedIds: ['menu'] }));
    assert.equal(nodes.find((n) => n.id === 'menu')?.selected, true);
    assert.equal(edgeDataOf(edges, 'e_buy').highlighted, true);
    assert.equal(edgeDataOf(edges, 'e_inicio').highlighted, true, 'la que LLEGA también');
    assert.equal(edgeDataOf(edges, 'e_asesor').highlighted, false);
  });

  it('todos los nodos y flechas son del tipo propio del editor', () => {
    const { nodes, edges } = toCanvas(seed, vista());
    assert.ok(nodes.every((n) => n.type === 'wa'));
    assert.ok(edges.every((e) => e.type === 'wa'));
  });
});

describe('las flechas dicen algo', () => {
  it('el chip muestra el nombre de la opción, no su id', () => {
    // Una flecha etiquetada "salida_2" no le dice nada a nadie.
    assert.equal(edgeDataOf(toCanvas(seed, vista()).edges, 'e_buy').label, 'Comprar productos');
  });

  it('una flecha condicional muestra la condición en castellano', () => {
    assert.equal(
      edgeDataOf(toCanvas(seed, vista()).edges, 'e_elegido').label,
      'vars.selected_variant tiene valor',
    );
  });

  it('una flecha de una cadena lineal no lleva chip', () => {
    // Un rótulo en cada flecha de una cadena es ruido.
    assert.equal(edgeDataOf(toCanvas(seed, vista()).edges, 'e_inicio').label, '');
  });

  it('una flecha de respuesta lleva el color de SU paso, no un gris', () => {
    // Es lo que deja seguir una rama con la vista: las tres salidas de un menú se ven
    // como tres caminos y no como tres líneas grises iguales.
    const { nodes, edges } = toCanvas(seed, vista());
    const acento = cardOf(nodes, 'menu').skin.accent;
    assert.equal(edgeDataOf(edges, 'e_buy').color, acento);
    assert.equal(edgeDataOf(edges, 'e_help').color, acento);
  });

  it('y lo conserva esté o no seleccionado el paso', () => {
    // Si cambiara al seleccionar, la rama que estás mirando dejaría de distinguirse
    // de las otras justo cuando la estás mirando.
    const reposo = edgeDataOf(toCanvas(seed, vista()).edges, 'e_buy').color;
    const elegida = edgeDataOf(toCanvas(seed, vista({ selectedIds: ['menu'] })).edges, 'e_buy').color;
    assert.equal(reposo, elegida);
  });

  it('una flecha de una cadena lineal SÍ se resalta al elegir su paso', () => {
    // Ahí no hay ninguna rama que distinguir, así que el resalte es lo único que dice
    // qué está conectado con qué.
    const reposo = edgeDataOf(toCanvas(seed, vista()).edges, 'e_inicio').color;
    const resaltada = edgeDataOf(toCanvas(seed, vista({ selectedIds: ['menu'] })).edges, 'e_inicio').color;
    assert.notEqual(reposo, resaltada);
  });

  it('una flecha con problema se pinta de error', () => {
    const issues: EditorIssue[] = [{ edgeId: 'e_buy', message: 'rota', severity: 'blocking' }];
    const data = edgeDataOf(toCanvas(seed, vista({ issues })).edges, 'e_buy');
    assert.equal(data.broken, true);
    assert.deepEqual(data.issues, ['rota']);
  });
});

describe('el tema cambia los colores, no la estructura', () => {
  it('claro y oscuro proyectan los mismos nodos y flechas', () => {
    const claro = toCanvas(seed, vista({ isDark: false }));
    const oscuro = toCanvas(seed, vista({ isDark: true }));
    assert.deepEqual(claro.nodes.map((n) => n.id), oscuro.nodes.map((n) => n.id));
    assert.deepEqual(
      claro.edges.map((e) => e.sourceHandle),
      oscuro.edges.map((e) => e.sourceHandle),
    );
  });

  it('pero sí las pinturas', () => {
    const claro = cardOf(toCanvas(seed, vista({ isDark: false })).nodes, 'menu');
    const oscuro = cardOf(toCanvas(seed, vista({ isDark: true })).nodes, 'menu');
    assert.notEqual(claro.skin.bg, oscuro.skin.bg);
  });
});

describe('repintar no puede pisar lo que sólo sabe el canvas', () => {
  const base = toCanvas(seed, vista()).nodes;

  it('conserva la medida que React Flow calculó', () => {
    // Sin la medida, el `fitView` y el minimapa salen mal el primer frame.
    const previo = base.map((n) => ({ ...n, measured: { width: 240, height: 120 } }));
    const merged = mergeCanvasState(toCanvas(seed, vista()).nodes, previo);
    assert.deepEqual(merged[0]?.measured, { width: 240, height: 120 });
  });

  it('durante un arrastre conserva la posición que todavía no llegó al grafo', () => {
    // Repintar por un cambio de tema en medio de un arrastre teletransportaba la
    // tarjeta al lugar donde estaba antes de agarrarla.
    const previo = base.map((n) =>
      n.id === 'menu' ? { ...n, dragging: true, position: { x: 999, y: 999 } } : n,
    );
    const merged = mergeCanvasState(toCanvas(seed, vista()).nodes, previo);
    assert.deepEqual(merged.find((n) => n.id === 'menu')?.position, { x: 999, y: 999 });
  });

  it('un nodo que ya no está desaparece', () => {
    const sinMenu: Graph = {
      nodes: seed.nodes.filter((n) => n.id !== 'menu'),
      edges: seed.edges.filter((e) => e.source !== 'menu' && e.target !== 'menu'),
    };
    const merged = mergeCanvasState(toCanvas(sinMenu, vista()).nodes, base);
    assert.ok(!merged.some((n) => n.id === 'menu'));
  });

  it('un nodo nuevo entra sin medida, para que la calcule', () => {
    const conNuevo = addNode(seed, 'message').graph;
    const merged = mergeCanvasState(toCanvas(conNuevo, vista()).nodes, base);
    assert.equal(merged.find((n) => n.id === 'message_1')?.measured, undefined);
  });
});
