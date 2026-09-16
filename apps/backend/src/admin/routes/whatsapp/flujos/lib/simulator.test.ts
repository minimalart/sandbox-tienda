import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { SEED_GRAPH } from '../../../../../lib/whatsapp/flow/seed';
import type { FlowStep } from './graph-contract';
import {
  choicesForStep,
  continueAfterAction,
  openers,
  sendText,
  startSession,
  tap,
  type SimSession,
  type SimTurn,
} from './simulator';

const ultimoBot = (s: SimSession): SimTurn | undefined =>
  [...s.turns].reverse().find((t) => t.role === 'bot');
const ultimoSistema = (s: SimSession): SimTurn | undefined =>
  [...s.turns].reverse().find((t) => t.role === 'system');

/** El paso del último mensaje del bot, ya narrowed. */
function pasoDelBot(s: SimSession): FlowStep {
  const turn = ultimoBot(s);
  assert.ok(turn && turn.role === 'bot', 'esperaba un mensaje del bot');
  return turn.step;
}

/** El paso de la última tarjeta de acción. */
function pasoDeLaAccion(s: SimSession): Extract<FlowStep, { kind: 'run_tool' }> {
  const turn = ultimoSistema(s);
  assert.ok(turn && turn.role === 'system' && turn.step?.kind === 'run_tool', 'esperaba una acción');
  return turn.step as Extract<FlowStep, { kind: 'run_tool' }>;
}
const textos = (s: SimSession): string[] =>
  s.turns.map((t) => (t.role === 'client' ? t.text : t.role === 'system' ? t.message : ''));

describe('probar el recorrido base sin publicarlo', () => {
  it('un saludo abre el menú con sus tres botones', () => {
    const s = sendText(SEED_GRAPH, startSession(), 'hola');
    const step = pasoDelBot(s);
    assert.equal(step.kind, 'ask_buttons');
    assert.equal(s.waiting, 'choice');
    assert.deepEqual(
      choicesForStep(SEED_GRAPH, s, step).map((c) => c.label),
      ['Comprar productos', 'Necesito ayuda', 'Mi pedido'],
    );
  });

  it('un saludo con una pregunta pegada NO abre el menú: cae al catch-all', () => {
    // Es el motivo por el que existe `match.exact`: con `keywords`, "Hola! ¿Tienen
    // sucursales?" recibía el menú y la pregunta se perdía. En el recorrido base el
    // catch-all es un final MUDO, que le suelta el turno al router.
    const s = sendText(SEED_GRAPH, startSession(), 'Hola! ¿Tienen sucursales en CABA?');
    assert.ok(!s.state.visited.includes('menu'), 'no tendría que haber abierto el menú');
    assert.ok(
      textos(s).some((t) => t.includes('cede el turno')),
      'el turno mudo tiene que explicarse, no verse como nada',
    );
  });

  it('tocar "Comprar" lleva a preguntar si sabe qué busca', () => {
    let s = sendText(SEED_GRAPH, startSession(), 'hola');
    s = tap(SEED_GRAPH, s, 'flow:menu:buy');
    const step = pasoDelBot(s);
    assert.equal(step.kind, 'ask_buttons');
    assert.ok(step.kind === 'ask_buttons' && step.body.includes('producto'));
  });

  it('escribir lo que busca llega a la acción de buscar, y NO la ejecuta', () => {
    // Ejecutarla mandaría mensajes de verdad a nombre de un cliente que no escribió.
    let s = sendText(SEED_GRAPH, startSession(), 'hola');
    s = tap(SEED_GRAPH, s, 'flow:menu:buy');
    s = tap(SEED_GRAPH, s, 'flow:sabe_producto:known');
    s = sendText(SEED_GRAPH, s, 'latex blanco');

    assert.equal(s.waiting, 'action');
    assert.equal(pasoDeLaAccion(s).tool, 'wa_search_products');
  });

  it('los argumentos de la acción llegan ya resueltos, no con la plantilla cruda', () => {
    // Es lo que deja ver si `{{text}}` estaba bien puesto: con la plantilla sin
    // resolver no se sabe con qué habría buscado.
    let s = sendText(SEED_GRAPH, startSession(), 'hola');
    s = tap(SEED_GRAPH, s, 'flow:menu:buy');
    s = tap(SEED_GRAPH, s, 'flow:sabe_producto:known');
    s = sendText(SEED_GRAPH, s, 'latex blanco');
    assert.equal(pasoDeLaAccion(s).args.query, 'latex blanco');
  });

  it('simular que el cliente tocó un producto sigue por la rama de compra', () => {
    // El tap del carrusel no es una opción del recorrido: viaja como `variant_<id>` y
    // el motor lo guarda en `vars.selected_variant`. Es el único camino que llega a
    // agregar al carrito, o sea el que más plata mueve.
    let s = sendText(SEED_GRAPH, startSession(), 'hola');
    s = tap(SEED_GRAPH, s, 'flow:menu:buy');
    s = tap(SEED_GRAPH, s, 'flow:sabe_producto:known');
    s = sendText(SEED_GRAPH, s, 'latex');
    s = tap(SEED_GRAPH, s, 'variant_123');

    assert.equal(s.state.vars.selected_variant, '123');
    assert.ok(s.state.visited.includes('agregar'));
  });

  it('después de agregar, la pregunta de seguimiento llega en el mismo turno', () => {
    // `agregar` está marcado como silencioso: si el motor cortara ahí, el cliente
    // tocaría "Agregar" y no vería NADA.
    let s = sendText(SEED_GRAPH, startSession(), 'hola');
    s = tap(SEED_GRAPH, s, 'flow:menu:buy');
    s = tap(SEED_GRAPH, s, 'flow:sabe_producto:known');
    s = sendText(SEED_GRAPH, s, 'latex');
    s = tap(SEED_GRAPH, s, 'variant_123');

    const step = pasoDelBot(s);
    assert.ok(step.kind === 'ask_buttons' && step.body.includes('agregué'));
  });

  it('pedir hablar con alguien termina en una derivación', () => {
    let s = sendText(SEED_GRAPH, startSession(), 'hola');
    s = tap(SEED_GRAPH, s, 'flow:menu:help');
    s = tap(SEED_GRAPH, s, 'flow:ayuda:persona');

    const sistema = ultimoSistema(s);
    assert.equal(sistema?.role === 'system' && sistema.kind, 'handoff');
    assert.equal(s.waiting, 'ended');
  });

  it('"Dejarlo acá" cierra el recorrido', () => {
    let s = sendText(SEED_GRAPH, startSession(), 'hola');
    s = tap(SEED_GRAPH, s, 'flow:menu:buy');
    s = tap(SEED_GRAPH, s, 'flow:sabe_producto:known');
    s = sendText(SEED_GRAPH, s, 'latex');
    s = tap(SEED_GRAPH, s, 'variant_123');
    s = tap(SEED_GRAPH, s, 'flow:que_sigue:no');

    assert.equal(s.waiting, 'ended');
    assert.ok(textos(s).length > 0);
  });
});

describe('seguir después de una acción', () => {
  const hastaLaBusqueda = (): SimSession => {
    let s = sendText(SEED_GRAPH, startSession(), 'hola');
    s = tap(SEED_GRAPH, s, 'flow:menu:buy');
    s = tap(SEED_GRAPH, s, 'flow:sabe_producto:known');
    return sendText(SEED_GRAPH, s, 'latex');
  };

  it('sin decir nada, sigue por la salida de la acción', () => {
    const s = continueAfterAction(SEED_GRAPH, hastaLaBusqueda());
    // Sin producto elegido, la búsqueda cede el turno por la arista incondicional.
    assert.ok(s.state.visited.includes('salida'));
  });

  it('las variables que deja la acción quedan disponibles para el paso siguiente', () => {
    const s = continueAfterAction(SEED_GRAPH, hastaLaBusqueda(), { presentations: ['20 L'] });
    assert.deepEqual(s.state.vars.presentations, ['20 L']);
  });
});

describe('las opciones que llegan en vivo', () => {
  it('una pregunta que las saca de una variable muestra las de la variable primero', () => {
    // Es la mitad del recorrido real: "¿qué presentación?" depende del producto que
    // el cliente acaba de elegir, y no se puede dibujar de antemano.
    const graph = {
      nodes: [
        { id: 'inicio', type: 'start' as const, match: { fallback: true } },
        {
          id: 'elegir',
          type: 'ask_list' as const,
          body: '¿Cuál?',
          optionsFrom: 'vars.presentations',
          options: [{ value: 'ninguna', label: 'Ninguna me sirve' }],
        },
        { id: 'fin', type: 'end' as const, body: 'Listo' },
      ],
      edges: [
        { id: 'e1', source: 'inicio', target: 'elegir' },
        { id: 'e2', source: 'elegir', target: 'fin' },
      ],
    };

    let s = startSession();
    s = { ...s, state: { ...s.state, vars: { presentations: [{ value: '20l', label: '20 L' }] } } };
    s = sendText(graph, s, 'hola');

    const opciones = choicesForStep(graph, s, pasoDelBot(s)).map((c) => c.label);
    assert.deepEqual(opciones, ['20 L', 'Ninguna me sirve']);
  });
});

describe('cuando el recorrido no atiende', () => {
  it('explica que en producción lo toma el bot anterior o la IA', () => {
    const graph = {
      nodes: [{ id: 'inicio', type: 'start' as const, match: { exact: ['hola'] } }],
      edges: [],
    };
    const s = sendText(graph, startSession(), 'cualquier cosa');
    assert.ok(textos(s).some((t) => t.includes('bot anterior')));
  });

  it('un recorrido cortado lo dice en vez de quedarse mudo', () => {
    const graph = {
      nodes: [{ id: 'inicio', type: 'start' as const, match: { fallback: true } }],
      edges: [],
    };
    const s = sendText(graph, startSession(), 'hola');
    const sistema = ultimoSistema(s);
    assert.equal(sistema?.role === 'system' && sistema.kind, 'broken');
  });
});

describe('arrancar la prueba', () => {
  it('ofrece las palabras que despiertan cada entrada', () => {
    // Sin esto hay que adivinar: si la entrada usa `exact`, una palabra de más no
    // matchea y parece que el recorrido está roto.
    assert.deepEqual(openers(SEED_GRAPH), ['hola']);
  });

  it('una sesión nueva no espera nada y no tiene mensajes', () => {
    const s = startSession();
    assert.equal(s.waiting, 'idle');
    assert.deepEqual(s.turns, []);
  });

  it('un mensaje vacío no hace nada', () => {
    const s = startSession();
    assert.equal(sendText(SEED_GRAPH, s, '   '), s);
  });
});
