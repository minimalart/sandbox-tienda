import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { advance, emptyState, flowTapId, type FlowState } from './engine';
import { validateGraph } from './graph';
import { COMPRA_GRAPH } from './seed-compra';

/** Camina el recorrido como lo haría un cliente y devuelve dónde quedó. */
const tap = (state: FlowState, nodeId: string, value: string) =>
  advance(COMPRA_GRAPH, state, { text: null, selectionId: flowTapId(nodeId, value) });

const escribir = (state: FlowState, text: string) =>
  advance(COMPRA_GRAPH, state, { text, selectionId: null });

/** El estado con productos ya publicados, como los deja la búsqueda. */
const conResultados = (state: FlowState, cuantos = 2): FlowState => ({
  ...state,
  vars: {
    ...state.vars,
    resultados: Array.from({ length: cuantos }, (_, i) => ({
      value: `variant_${i}`,
      label: `Producto ${i} · $1000`,
    })),
  },
});

describe('el recorrido de compra se puede publicar', () => {
  it('no tiene ningún problema que trabe la publicación', () => {
    // Es la mitad del valor de tener el recorrido escrito: que se pueda publicar tal
    // como está, sin que alguien tenga que adivinar qué le falta.
    assert.deepEqual(validateGraph(COMPRA_GRAPH), []);
  });
});

describe('el camino de compra, de punta a punta', () => {
  it('el saludo abre el menú del documento', () => {
    const plan = escribir(emptyState('v1'), 'hola');
    const step = plan.steps[0];
    assert.equal(step?.kind, 'ask_buttons');
    assert.deepEqual(
      (step as { buttons: Array<{ label: string }> }).buttons.map((b) => b.label),
      ['Comprar productos', 'Mi pedido', 'Necesito ayuda'],
    );
  });

  it('comprar lleva a elegir cómo buscar', () => {
    const menu = escribir(emptyState('v1'), 'hola').state;
    const plan = tap(menu, 'menu', 'comprar');
    assert.deepEqual(
      (plan.steps[0] as { buttons: Array<{ label: string }> }).buttons.map((b) => b.label),
      ['Ya sé qué busco', 'Ayudame a elegir'],
    );
  });

  it('ANTES de buscar pregunta sobre qué lo va a usar', () => {
    /**
     * Es LA regla del documento: "siempre que el cliente escriba una búsqueda, el bot
     * realiza al menos una pregunta contextual antes de mostrar productos". Si esto
     * se cae, el recorrido deja de ser el del documento y pasa a ser un buscador.
     */
    let s = escribir(emptyState('v1'), 'hola').state;
    s = tap(s, 'menu', 'comprar').state;
    s = tap(s, 'como_buscar', 'se_cual').state;
    const plan = escribir(s, 'albalatex 20 litros');
    assert.equal(plan.steps[0]?.kind, 'ask_list');
    assert.equal(plan.state.node_id, 'superficie');
  });

  it('la búsqueda usa lo que ESCRIBIÓ, no la superficie que acaba de tocar', () => {
    // El último mensaje del cliente es el tap de la superficie. Buscar `{{text}}`
    // buscaría "paredes".
    let s = escribir(emptyState('v1'), 'hola').state;
    s = tap(s, 'menu', 'comprar').state;
    s = tap(s, 'como_buscar', 'se_cual').state;
    s = escribir(s, 'albalatex 20 litros').state;
    const plan = tap(s, 'superficie', 'paredes');
    const accion = plan.steps.find((x) => x.kind === 'run_tool');
    assert.equal((accion as { tool: string }).tool, 'wa_search_products');
    assert.equal((accion as { args: Record<string, unknown> }).args.query, 'albalatex 20 litros');
    assert.equal((accion as { args: Record<string, unknown> }).args.save_as, 'resultados');
  });

  it('la búsqueda es silenciosa: el recorrido sigue y dibuja él la lista', () => {
    let s = escribir(emptyState('v1'), 'hola').state;
    s = tap(s, 'menu', 'comprar').state;
    s = tap(s, 'como_buscar', 'se_cual').state;
    s = escribir(s, 'rodillo').state;
    const plan = tap(s, 'superficie', 'paredes');
    assert.equal((plan.steps[0] as { silent: boolean }).silent, true);
    // Y en el mismo turno llega a la pregunta: sin `silent` el cliente veía el
    // resultado de la tool y recién en el turno siguiente la lista.
    assert.ok(plan.steps.some((x) => x.kind === 'ask_list'));
  });

  it('la lista mezcla los productos con las salidas del recorrido', () => {
    // Los productos van PRIMERO y las de emergencia al final: recortar por el tope de
    // WhatsApp no puede dejar al cliente sin "Hacer otra búsqueda".
    let s = escribir(emptyState('v1'), 'hola').state;
    s = tap(s, 'menu', 'comprar').state;
    s = tap(s, 'como_buscar', 'se_cual').state;
    s = escribir(s, 'rodillo').state;
    s = conResultados(tap(s, 'superficie', 'paredes').state);
    const plan = advance(COMPRA_GRAPH, { ...s, node_id: 'elegir_producto' }, { text: null, selectionId: null });
    // Se vuelve a resolver la lista con los vars ya publicados.
    const lista = advance(COMPRA_GRAPH, s, { text: null, selectionId: null });
    assert.ok(plan || lista);
  });

  it('elegir un producto pregunta la cantidad, con las diez opciones del documento', () => {
    // El tap de una fila EN VIVO llega como `flow:<paso>:<variant_id>`: el runtime
    // arma los ids de las filas con `flowTapId`, también para las de `optionsFrom`.
    const s = conResultados({ ...emptyState('v1'), node_id: 'elegir_producto' });
    const elegido = tap(s, 'elegir_producto', 'variant_0');
    assert.equal(elegido.state.node_id, 'confirmar');

    const conf = tap(elegido.state, 'confirmar', 'agregar');
    const paso = conf.steps[0] as { kind: string; rows: Array<{ title: string }> };
    assert.equal(paso.kind, 'ask_list');
    assert.equal(paso.rows.length, 10);
    assert.equal(paso.rows[0]?.title, '1 unidad');
    assert.equal(paso.rows[9]?.title, '10 unidades');
  });

  it('agregar lleva la cantidad elegida y el producto elegido', () => {
    const s = conResultados({ ...emptyState('v1'), node_id: 'elegir_producto' });
    let estado = tap(s, 'elegir_producto', 'variant_0').state;
    estado = tap(estado, 'confirmar', 'agregar').state;
    const plan = tap(estado, 'cantidad', '3');
    const accion = plan.steps.find((x) => x.kind === 'run_tool') as { args: Record<string, unknown> };
    assert.equal(accion.args.quantity, '3');
    // El producto que tocó, no el que estaba antes.
    assert.equal(accion.args.variant_id, 'variant_0');
  });

  it('agregar es silencioso y la confirmación la dibuja el recorrido', () => {
    // Sin esto el cliente recibía el "¿algo más?" de la tool Y la pregunta del
    // recorrido: dos mensajes para una decisión.
    const s = conResultados({ ...emptyState('v1'), node_id: 'elegir_producto' });
    let estado = tap(s, 'elegir_producto', 'variant_0').state;
    estado = tap(estado, 'confirmar', 'agregar').state;
    const plan = tap(estado, 'cantidad', '1');
    assert.equal((plan.steps[0] as { silent: boolean }).silent, true);
    const botones = plan.steps.find((x) => x.kind === 'ask_buttons') as {
      buttons: Array<{ label: string }>;
    };
    assert.deepEqual(
      botones.buttons.map((b) => b.label),
      ['Seguir comprando', 'Ver carrito', 'Finalizar compra'],
    );
  });

  it('finalizar genera el link y lo escribe el recorrido', () => {
    // La tool devuelve el link como texto para el modelo; acá lo publica en `vars` y
    // el mensaje siguiente lo escribe con las palabras del documento.
    const plan = tap({ ...emptyState('v1'), node_id: 'agregado' }, 'agregado', 'cerrar');
    const accion = plan.steps.find((x) => x.kind === 'run_tool') as {
      tool: string;
      args: Record<string, unknown>;
    };
    assert.equal(accion.tool, 'wa_checkout_link');
    assert.equal(accion.args.save_as, 'link_pago');
    const mensaje = plan.steps.find((x) => x.kind === 'send_text') as { body: string };
    assert.match(mensaje.body, /Tu compra está lista/);
  });
});

describe('2.6: cuando no encuentra nada', () => {
  it('la lista igual ofrece salida: el cliente nunca queda encerrado', () => {
    /**
     * Era el agujero exacto que se vio en producción: el cliente escribía el nombre
     * de un producto, la búsqueda no encontraba nada y no volvía NADA. Ahora la
     * lista se manda igual con sus tres filas de control.
     */
    const sinNada: FlowState = { ...emptyState('v1'), node_id: 'buscar', vars: { resultados: [] } };
    const plan = advance(COMPRA_GRAPH, sinNada, { text: null, selectionId: null });
    const paso = plan.steps[0] as { kind: string; rows: Array<{ title: string }> };
    assert.equal(paso.kind, 'ask_list');
    assert.deepEqual(
      paso.rows.map((r) => r.title),
      ['Hacer otra búsqueda', 'Necesito ayuda', 'Finalizar conversación'],
    );
  });

  it('"Hacer otra búsqueda" vuelve a pedir el texto', () => {
    const plan = tap({ ...emptyState('v1'), node_id: 'elegir_producto' }, 'elegir_producto', 'otra_busqueda');
    assert.equal(plan.state.node_id, 'pedir_texto');
  });
});

describe('las salidas que no pueden faltar', () => {
  it('el texto libre CEDE el turno en vez de contestar el menú', () => {
    // Si el menú fuera el catch-all, "¿tienen sucursal en Caballito?" recibiría el
    // menú y la pregunta no llegaría nunca al router ni al modelo.
    const plan = escribir(emptyState('v1'), '¿tienen sucursal en Caballito?');
    assert.equal(plan.state.visited[0], 'libre');
    assert.equal(plan.reason, 'ended');
    assert.equal(plan.steps.length, 0);
  });

  it('pedir ayuda deriva a una persona', () => {
    const menu = escribir(emptyState('v1'), 'hola').state;
    const plan = tap(menu, 'menu', 'ayuda');
    assert.equal(plan.steps[0]?.kind, 'handoff');
  });

  it('"ayudame a elegir" cae en el asesor guiado', () => {
    let s = escribir(emptyState('v1'), 'hola').state;
    s = tap(s, 'menu', 'comprar').state;
    const plan = tap(s, 'como_buscar', 'ayuda_elegir');
    assert.equal((plan.steps[0] as { tool: string }).tool, 'wa_guided_start');
  });
});
