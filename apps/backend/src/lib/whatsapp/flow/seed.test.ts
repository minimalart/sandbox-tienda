import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { advance, emptyState, flowTapId } from './engine';
import { normalizeGraph, validateGraph } from './graph';
import { SEED_GRAPH } from './seed';

describe('SEED_GRAPH', () => {
  it('es publicable tal cual: cero problemas', () => {
    assert.deepEqual(validateGraph(SEED_GRAPH), []);
  });

  it('sobrevive a normalizar sin perder nada', () => {
    assert.deepEqual(normalizeGraph(SEED_GRAPH), SEED_GRAPH);
  });

  it('un "hola" abre el menú con las tres opciones de siempre', () => {
    const plan = advance(SEED_GRAPH, emptyState('v'), { text: 'hola', selectionId: null });
    const step = plan.steps[0];
    assert.ok(step && step.kind === 'ask_buttons');
    assert.deepEqual(
      step.buttons.map((b) => b.label),
      ['Comprar productos', 'Necesito ayuda', 'Mi pedido'],
    );
  });

  it('el recorrido de compra llega a la búsqueda con lo que escribió el cliente', () => {
    let state = emptyState('v');

    state = advance(SEED_GRAPH, state, { text: 'hola', selectionId: null }).state;
    state = advance(SEED_GRAPH, state, { text: null, selectionId: flowTapId('menu', 'buy') }).state;
    state = advance(SEED_GRAPH, state, { text: null, selectionId: flowTapId('sabe_producto', 'known') }).state;

    const plan = advance(SEED_GRAPH, state, { text: 'latex interior 20 lt', selectionId: null });
    const tool = plan.steps.find((s) => s.kind === 'run_tool');
    assert.ok(tool && tool.kind === 'run_tool');
    assert.equal(tool.tool, 'wa_search_products');
    assert.deepEqual(tool.args, { query: 'latex interior 20 lt' });
  });

  it('"Necesito ayuda" llega al asesor guiado desde las dos puertas', () => {
    // Desde la compra, derecho. Desde el menú, pasando por la pregunta de qué tipo
    // de ayuda necesita.
    const directo = advance(SEED_GRAPH, { ...emptyState('v'), node_id: 'sabe_producto' }, {
      text: null,
      selectionId: flowTapId('sabe_producto', 'help'),
    });
    const tool = directo.steps.find((s) => s.kind === 'run_tool');
    assert.ok(tool && tool.kind === 'run_tool');
    assert.equal(tool.tool, 'wa_guided_start');

    const desdeMenu = advance(SEED_GRAPH, { ...emptyState('v'), node_id: 'ayuda' }, {
      text: null,
      selectionId: flowTapId('ayuda', 'asesor'),
    });
    const tool2 = desdeMenu.steps.find((s) => s.kind === 'run_tool');
    assert.ok(tool2 && tool2.kind === 'run_tool');
    assert.equal(tool2.tool, 'wa_guided_start');
  });

  it('se puede pedir una persona y el recorrido corta', () => {
    const plan = advance(SEED_GRAPH, { ...emptyState('v'), node_id: 'ayuda' }, {
      text: null,
      selectionId: flowTapId('ayuda', 'persona'),
    });
    assert.equal(plan.reason, 'handoff');
  });

  /**
   * El recorrido completo de una venta, que es lo que el grafo NO podía hacer: el
   * tap del carrusel se descartaba y nunca se llamaba a `wa_add_to_cart`.
   */
  it('tocar "Agregar" en el carrusel agrega al carrito y ofrece seguir, en un solo mensaje', () => {
    const plan = advance(SEED_GRAPH, { ...emptyState('v'), node_id: 'buscar' }, {
      text: null,
      selectionId: 'variant_01ABC',
    });

    const tool = plan.steps.find((s) => s.kind === 'run_tool');
    assert.ok(tool && tool.kind === 'run_tool');
    assert.equal(tool.tool, 'wa_add_to_cart');
    assert.deepEqual(tool.args, { variant_id: '01ABC' });
    // Silenciosa: si la tool mandara sus propios botones, el cliente vería dos
    // preguntas seguidas para una sola decisión.
    assert.equal(tool.silent, true);

    const pregunta = plan.steps.find((s) => s.kind === 'ask_buttons');
    assert.ok(pregunta && pregunta.kind === 'ask_buttons');
    assert.deepEqual(
      pregunta.buttons.map((b) => b.label),
      ['Agregar algo más', 'Cerrar compra', 'Dejarlo acá'],
    );
    assert.equal(plan.state.node_id, 'que_sigue');
  });

  it('"Agregar algo más" vuelve a preguntar qué busca: el carrito se arma en ciclo', () => {
    const plan = advance(SEED_GRAPH, { ...emptyState('v'), node_id: 'que_sigue' }, {
      text: null,
      selectionId: flowTapId('que_sigue', 'mas'),
    });
    assert.equal(plan.reason, 'awaiting_reply');
    assert.equal(plan.state.node_id, 'que_busca');
  });

  it('"Cerrar compra" muestra el detalle del pedido para pagar', () => {
    const plan = advance(SEED_GRAPH, { ...emptyState('v'), node_id: 'que_sigue' }, {
      text: null,
      selectionId: flowTapId('que_sigue', 'cerrar'),
    });
    const tool = plan.steps.find((s) => s.kind === 'run_tool');
    assert.ok(tool && tool.kind === 'run_tool');
    assert.equal(tool.tool, 'wa_review_order');
  });

  it('si buscó y NO tocó ningún producto, el recorrido cede el turno sin hablar', () => {
    const plan = advance(SEED_GRAPH, { ...emptyState('v'), node_id: 'buscar' }, {
      text: 'mejor mostrame otra cosa',
      selectionId: null,
    });
    assert.deepEqual(plan.steps, []);
    assert.equal(plan.reason, 'ended');
  });

  /**
   * La regla que más fácil se rompe al dibujar: si el catch-all fuera el saludo,
   * cualquier pregunta en lenguaje natural recibiría el menú y ni el router ni el
   * modelo llegarían a verla nunca.
   */
  it('el texto libre NO abre el menú: sale del recorrido para que lo atienda otro', () => {
    const plan = advance(SEED_GRAPH, emptyState('v'), {
      text: '¿tienen sucursales en provincia?',
      selectionId: null,
    });
    assert.deepEqual(plan.steps, []);
  });

  /**
   * El bug que arruinó una conversación real: el cliente escribió
   * "Hola! Tienen sucursales en CABA?" y recibió el MENÚ. Con `keywords`, "hola"
   * matcheaba por estar adentro del mensaje, y la pregunta no llegaba ni al router
   * ni al modelo.
   */
  it('un saludo con una pregunta pegada NO abre el menú: manda la pregunta entera', () => {
    for (const texto of [
      'Hola! Tienen sucursales en CABA?',
      'buenas, me llegó mal el pedido',
      'hola quiero devolver algo',
    ]) {
      const plan = advance(SEED_GRAPH, emptyState('v'), { text: texto, selectionId: null });
      assert.deepEqual(plan.steps, [], texto);
    }
  });

  it('un saludo a secas sí abre el menú, con signos o sin ellos', () => {
    for (const texto of ['hola', '¡Hola!', 'Buenas', 'buen dia', 'MENU']) {
      const plan = advance(SEED_GRAPH, emptyState('v'), { text: texto, selectionId: null });
      const step = plan.steps[0];
      assert.ok(step && step.kind === 'ask_buttons', texto);
    }
  });
});
