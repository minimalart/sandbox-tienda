import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { advance, emptyState, flowTapId, renderText, type FlowState } from './engine';
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

  /**
   * EL RECORRIDO YA NO PREGUNTA "¿QUÉ VAS A PINTAR?".
   *
   * El documento pide una pregunta de contexto antes de mostrar productos, y estaba
   * dibujada. Pero las ocho superficies iban al MISMO nodo de búsqueda y la búsqueda
   * corría con el texto del cliente: la respuesta se guardaba y no filtraba nada. QA
   * midió el resultado — un fijador para cielorraso ofrecido a quien contestó
   * "madera"— y además la pregunta salía aunque estuvieras comprando un rodillo.
   *
   * Una pregunta que promete "quiero confirmar que sea adecuado" y no filtra es peor
   * que no preguntar. El camino que SÍ filtra por superficie es el asesor guiado, y
   * el recorrido lo ofrece en "Ayudame a elegir".
   */
  it('lo que escribe el cliente va DERECHO a la búsqueda', () => {
    let s = escribir(emptyState('v1'), 'hola').state;
    s = tap(s, 'menu', 'comprar').state;
    s = tap(s, 'como_buscar', 'se_cual').state;
    const plan = escribir(s, 'albalatex 20 litros');
    const accion = plan.steps.find((x) => x.kind === 'run_tool');
    assert.equal((accion as { tool: string }).tool, 'wa_search_products');
    assert.equal((accion as { args: Record<string, unknown> }).args.query, 'albalatex 20 litros');
    assert.equal((accion as { args: Record<string, unknown> }).args.save_as, 'resultados');
  });

  it('ya no queda ningún nodo que pregunte la superficie', () => {
    assert.equal(COMPRA_GRAPH.nodes.find((n) => n.id === 'superficie'), undefined);
  });

  it('la búsqueda es silenciosa: el recorrido sigue y dibuja él la lista', () => {
    let s = escribir(emptyState('v1'), 'hola').state;
    s = tap(s, 'menu', 'comprar').state;
    s = tap(s, 'como_buscar', 'se_cual').state;
    const plan = escribir(s, 'rodillo');
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
    s = conResultados(escribir(s, 'rodillo').state);
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
    // La tool no habla: publica en `vars` y el mensaje siguiente es el que sale.
    const plan = tap({ ...emptyState('v1'), node_id: 'agregado' }, 'agregado', 'cerrar');
    const accion = plan.steps.find((x) => x.kind === 'run_tool') as {
      tool: string;
      args: Record<string, unknown>;
    };
    assert.equal(accion.tool, 'wa_checkout_link');
    assert.equal(accion.args.save_as, 'link_pago');
    /**
     * Este assert decía `/Tu compra está lista/` y esa frase ERA el bug: la tool
     * puede negarse —pedido por debajo del mínimo de compra— y entonces publica el
     * MOTIVO en esa misma variable. El runtime corre todos los pasos del plan igual,
     * así que el cierre sale siempre; con el texto viejo el cliente leía "tu compra
     * está lista" y a continuación por qué no lo estaba. Lo reportó QA.
     */
    /**
     * `body` sale VACÍO del plan y tiene que ser así: `wa_checkout_link` todavía no
     * corrió. Lo que importa es que el paso se lleve el texto CRUDO, porque el
     * runtime lo vuelve a resolver contra los `vars` ya escritos justo antes de
     * mandarlo. Sin eso el cierre salía sin link — la venta moría en el último
     * paso, con el carrito armado.
     */
    const mensaje = plan.steps.find((x) => x.kind === 'send_text') as {
      body: string;
      template?: string;
    };
    assert.equal(mensaje.body, '');
    assert.equal(mensaje.template, '{{vars.link_pago}}');
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


describe('el cierre no puede dar la compra por hecha', () => {
  /**
   * `wa_checkout_link` puede NEGARSE —hoy cuando el pedido no llega al mínimo de
   * compra— y en ese caso publica el MOTIVO en la misma variable en vez del link.
   * El runtime corre todos los pasos del plan igual, así que el cierre sale
   * siempre: si su texto afirma que la compra está lista, el cliente lee una
   * mentira seguida de la explicación de por qué no lo está. Lo reportó QA.
   */
  it('el mensaje de cierre es sólo la variable, sin texto que prometa nada', () => {
    const cierre = COMPRA_GRAPH.nodes.find((n) => n.id === 'cerrar_compra');
    assert.equal(cierre?.type, 'message');
    assert.equal((cierre as { body?: string }).body, '{{vars.link_pago}}');
  });

  /**
   * El cierre resuelto EN VIVO, que es el camino real: primero con el link (compra
   * que pasa) y después con el aviso que publica la tool cuando el pedido no llega
   * al mínimo. Los dos salen del mismo `{{vars.link_pago}}`, y por eso el texto del
   * nodo no puede dar nada por hecho.
   */
  it('el mismo cierre sirve para el link y para el motivo del rechazo', () => {
    const cierre = COMPRA_GRAPH.nodes.find((n) => n.id === 'cerrar_compra') as { body: string };
    const conLink: FlowState = {
      ...emptyState('v1'),
      vars: { link_pago: 'https://tienda.test/ar/c/abc123' },
    };
    assert.equal(
      renderText(cierre.body, conLink, { text: null, selectionId: null }),
      'https://tienda.test/ar/c/abc123',
    );

    const bloqueado: FlowState = {
      ...emptyState('v1'),
      vars: { link_pago: 'Te faltan $145.660,35 para llegar al mínimo.' },
    };
    assert.equal(
      renderText(cierre.body, bloqueado, { text: null, selectionId: null }),
      'Te faltan $145.660,35 para llegar al mínimo.',
    );
  });
});

/**
 * "MI PEDIDO" YA NO LE CEDE EL TURNO AL ROUTER (DESDEELSUR-81).
 *
 * Las dos preguntas son del recorrido y la acción recibe las RESPUESTAS: número y
 * email. Nada del pedido sale hasta que la acción verifica que son de la misma orden.
 */
describe('Mi pedido: número, email y recién después el estado', () => {
  const hastaElEmail = () => {
    let state = escribir(emptyState('v1'), 'hola').state;
    const pideNumero = tap(state, 'menu', 'pedido');
    state = pideNumero.state;
    const pideEmail = escribir(state, 'es el #1234');
    return { pideNumero, pideEmail };
  };

  it('primero pide el número y después el email, sin consultar nada todavía', () => {
    const { pideNumero, pideEmail } = hastaElEmail();
    assert.equal(pideNumero.steps[0]?.kind, 'ask_text');
    assert.match((pideNumero.steps[0] as { body: string }).body, /número de pedido/);
    assert.equal(pideEmail.steps[0]?.kind, 'ask_text');
    assert.match((pideEmail.steps[0] as { body: string }).body, /email/);
    assert.ok(![...pideNumero.steps, ...pideEmail.steps].some((s) => s.kind === 'run_tool'));
  });

  it('con el email, corre la consulta con las DOS respuestas y muestra lo que publicó', () => {
    const { pideEmail } = hastaElEmail();
    const plan = escribir(pideEmail.state, 'ana@mail.com');
    const [accion, mensaje, siguiente] = plan.steps;

    assert.equal(accion?.kind, 'run_tool');
    const tool = accion as { tool: string; args: Record<string, unknown>; silent?: boolean };
    assert.equal(tool.tool, 'wa_lookup_order');
    assert.deepEqual(tool.args, { order_number: 'es el #1234', email: 'ana@mail.com', save_as: 'estado_pedido' });
    assert.equal(tool.silent, true);

    // El mensaje se lleva el texto CRUDO: la variable la escribe la acción DESPUÉS de
    // armarse el plan, y el runtime lo resuelve justo antes de mandar.
    assert.equal(mensaje?.kind, 'send_text');
    const template = (mensaje as { template?: string }).template ?? '';
    assert.equal(template, '{{vars.estado_pedido}}');
    const conRespuesta = { ...plan.state, vars: { ...plan.state.vars, estado_pedido: '*Pedido #1234*' } };
    assert.equal(renderText(template, conRespuesta, { text: null, selectionId: null }), '*Pedido #1234*');

    assert.equal(siguiente?.kind, 'ask_buttons');
    assert.deepEqual(
      (siguiente as { buttons: Array<{ label: string }> }).buttons.map((b) => b.label),
      ['Consultar otro', 'Comprar productos', 'Necesito ayuda'],
    );
  });

  it('"Consultar otro" vuelve a pedir el número (es también el reintento)', () => {
    const { pideEmail } = hastaElEmail();
    const despues = escribir(pideEmail.state, 'ana@mail.com').state;
    const plan = tap(despues, 'despues_pedido', 'otro_pedido');
    assert.equal(plan.steps[0]?.kind, 'ask_text');
    assert.match((plan.steps[0] as { body: string }).body, /número de pedido/);
  });
});
