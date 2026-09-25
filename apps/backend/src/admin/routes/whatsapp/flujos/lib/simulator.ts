/**
 * EL SIMULADOR: probar el recorrido sin publicarlo y sin tocar nada.
 *
 * Hasta acá la única forma de saber si un recorrido funcionaba era PUBLICARLO y
 * escribirle al bot desde un teléfono. O sea: probar en producción, con los clientes
 * adentro, y con el recorrido anterior ya reemplazado.
 *
 * Corre el MISMO `advance()` que atiende en producción, acá en el navegador y contra
 * el grafo que hay en el canvas —guardado o no—. No hay forma de que el simulador y
 * el bot difieran, porque son el mismo código.
 *
 * ─── LO QUE NO HACE ──────────────────────────────────────────────────────────────
 *
 * No ejecuta las acciones. Un `action` busca productos de verdad, agrega al carrito
 * de verdad y puede escalarle la conversación a una persona de verdad; ejecutarlas
 * desde una prueba sería mandar mensajes a nombre de un cliente que no escribió.
 * En su lugar el recorrido muestra una tarjeta con la acción y sus argumentos ya
 * resueltos, y el operador puede decirle qué habría devuelto: el producto que el
 * cliente hubiera tocado, o las opciones que la acción deja en `vars` para la
 * pregunta siguiente. Sin eso, todo lo que vive detrás de una acción —que es la
 * mitad del recorrido— sería imposible de probar.
 */

import {
  advance,
  emptyState,
  flowTapId,
  parseFlowTapId,
  renderText,
  resolveNodeOptions,
  type FlowGraph,
  type FlowPlan,
  type FlowState,
  type FlowStep,
} from './graph-contract';

/** La versión que ve el simulador. No es la de ninguna versión publicada. */
export const SIMULATOR_VERSION_ID = 'simulador';

export type SimTurn =
  | { role: 'client'; text: string }
  | { role: 'bot'; step: FlowStep }
  /** Lo que no es un mensaje: una acción, una derivación, o el recorrido cediendo. */
  | {
      role: 'system';
      kind: 'action' | 'agent' | 'handoff' | 'passthrough' | 'broken' | 'timeout';
      step?: FlowStep;
      message: string;
    };

/** Qué espera el simulador que haga el operador ahora. */
export type SimWaiting = 'idle' | 'text' | 'choice' | 'action' | 'ended';

export type SimSession = {
  state: FlowState;
  turns: SimTurn[];
  waiting: SimWaiting;
  /** Cuántos nodos había visitado antes de este turno: el resto es el camino nuevo. */
  visitedBefore: number;
};

export function startSession(): SimSession {
  return { state: emptyState(SIMULATOR_VERSION_ID), turns: [], waiting: 'idle', visitedBefore: 0 };
}

/** El cliente escribe. */
export function sendText(graph: FlowGraph, session: SimSession, text: string): SimSession {
  const limpio = text.trim();
  if (!limpio) return session;
  return run(graph, session, { text: limpio, selectionId: null }, { role: 'client', text: limpio });
}

/**
 * El cliente toca un botón o una fila.
 *
 * Vale tanto para los taps del recorrido (`flow:<nodo>:<valor>`) como para los que
 * mandan las acciones con ids propios (`variant_<id>` del carrusel). Los segundos son
 * los que el motor guarda en `vars.selection` y son la única forma de probar el
 * camino de compra, que es el que más plata mueve.
 */
export function tap(
  graph: FlowGraph,
  session: SimSession,
  selectionId: string,
  label?: string,
): SimSession {
  const id = selectionId.trim();
  if (!id) return session;
  const visible = label ?? parseFlowTapId(id)?.value ?? id;
  return run(graph, session, { text: null, selectionId: id }, { role: 'client', text: visible });
}

/**
 * Seguir después de una acción, opcionalmente con lo que la acción habría dejado.
 *
 * El motor, parado en un `action`, avanza por la arista de ese nodo con un turno
 * vacío: es exactamente lo que pasa en producción cuando el cliente contesta después
 * de que la tool le habló.
 */
export function continueAfterAction(
  graph: FlowGraph,
  session: SimSession,
  vars?: Record<string, unknown>,
): SimSession {
  const conVars: SimSession = vars
    ? { ...session, state: { ...session.state, vars: { ...session.state.vars, ...vars } } }
    : session;
  return run(graph, conVars, { text: null, selectionId: null }, null);
}

/**
 * LO QUE LA ACCIÓN DEJÓ EN `vars`, SIN MOVER EL RECORRIDO.
 *
 * Una acción `silent` no pausa: el motor la corre y dibuja la pregunta siguiente EN EL
 * MISMO TURNO. O sea que para el caso más común —buscar en el catálogo y ofrecer los
 * resultados— nunca había un momento en el que el operador pudiera decir qué había
 * devuelto la acción: la lista ya estaba en pantalla, vacía, con sólo las salidas de
 * emergencia. El campo de JSON de "seguir después de una acción" ni siquiera aparecía.
 *
 * Por eso esto NO avanza el turno: escribe la variable y listo. `choicesForStep` vuelve
 * a resolver las opciones contra el estado VIVO —igual que hace el runtime justo antes
 * de mandar el mensaje— así que la pregunta que ya está dibujada se rellena sola con
 * los productos que la vista previa acaba de traer del catálogo real.
 *
 * Con los TEXTOS pasa lo mismo y la solución es otra. Un mensaje que dice
 * `{{vars.estado_pedido}}` detrás de una acción silenciosa salía vacío en la prueba:
 * el plan lo resolvió antes de que la vista previa trajera la respuesta. El runtime
 * lo resuelve justo antes de mandar (`template`), así que acá se hace lo mismo con los
 * mensajes que vienen DESPUÉS de la última acción, en el momento en que la variable
 * se escribe. Resolverlos en cada render contra el estado vivo sería peor: consultar
 * un segundo pedido reescribiría también la burbuja del primero.
 */
export function applyActionVars(session: SimSession, vars: Record<string, unknown>): SimSession {
  const state = { ...session.state, vars: { ...session.state.vars, ...vars } };
  const desde = session.turns.reduce(
    (found, turn, index) => (turn.role === 'system' && turn.kind === 'action' ? index : found),
    -1,
  );
  if (desde < 0) return { ...session, state };
  const cliente = [...session.turns.slice(0, desde)].reverse().find((t) => t.role === 'client');
  const input = { text: cliente?.role === 'client' ? cliente.text : null, selectionId: null };
  const turns = session.turns.map((turn, index) => {
    if (index <= desde || turn.role !== 'bot' || !('template' in turn.step) || !turn.step.template) return turn;
    return { ...turn, step: { ...turn.step, body: renderText(turn.step.template, state, input) } } as SimTurn;
  });
  return { ...session, state, turns };
}

/**
 * QUÉ PASA SI EL CLIENTE NO CONTESTA.
 *
 * El plazo real puede ser de horas, así que esperarlo no sería una forma de
 * probarlo: acá se lo hace vencer a mano y el recorrido sigue por donde seguiría en
 * serio. Es la única manera de ver ese camino antes de publicarlo — en producción no
 * se puede provocar, hay que esperar a que un cliente de verdad abandone.
 */
export function letTimeoutFire(graph: FlowGraph, session: SimSession): SimSession {
  return run(
    graph,
    session,
    { text: null, selectionId: null, timedOut: true },
    { role: 'system', kind: 'timeout', message: 'Pasó el plazo sin que el cliente contestara.' },
  );
}

/** Si el paso donde está esperando tiene plazo, el simulador puede hacerlo vencer. */
export function canTimeOut(graph: FlowGraph, session: SimSession): boolean {
  const node = graph.nodes.find((n) => n.id === session.state.node_id);
  return Boolean(node?.timeout_seconds);
}

// ─── El turno ─────────────────────────────────────────────────────────────────

function run(
  graph: FlowGraph,
  session: SimSession,
  input: { text: string | null; selectionId: string | null; timedOut?: boolean },
  entrada: SimTurn | null,
): SimSession {
  const plan = advance(graph, session.state, input);
  const turns = [...session.turns, ...(entrada ? [entrada] : []), ...turnosDe(plan)];
  return {
    state: plan.state,
    turns,
    waiting: esperaDe(plan),
    visitedBefore: session.state.visited.length,
  };
}

function turnosDe(plan: FlowPlan): SimTurn[] {
  const turns: SimTurn[] = plan.steps.map((step): SimTurn => {
    if (step.kind === 'run_tool') {
      return {
        role: 'system',
        kind: 'action',
        step,
        message: step.silent
          ? 'Acá corre la acción sin hablarle al cliente, y el recorrido sigue en el mismo mensaje.'
          : 'Acá corre la acción y le habla al cliente ella misma. En la prueba no se ejecuta.',
      };
    }
    if (step.kind === 'run_agent') {
      /**
       * El agente NO se ejecuta en la prueba: cuesta una llamada al modelo por turno y
       * su respuesta cambia cada vez, así que probar el recorrido dejaría de ser
       * repetible. Lo que importa verificar acá es que el turno LLEGA hasta este paso
       * y por dónde sigue después.
       */
      return {
        role: 'system',
        kind: 'agent',
        step,
        message: `Acá contesta el agente "${step.agentKey}" y el recorrido sigue por la salida de este paso. En la prueba no se lo llama.`,
      };
    }
    if (step.kind === 'handoff') {
      return {
        role: 'system',
        kind: 'handoff',
        step,
        message: `Se deriva a una persona (${step.reason}). El bot deja de responder hasta que alguien lo reactive.`,
      };
    }
    return { role: 'bot', step };
  });

  /**
   * UN TURNO SIN MENSAJES NO PUEDE VERSE COMO NADA.
   *
   * Pasa en tres casos y los tres son normales: ninguna entrada matcheó, el recorrido
   * llegó a un final SIN TEXTO —el recorrido base tiene uno a propósito, para soltarle
   * el turno al router— o el grafo está cortado. En producción los tres ceden el turno
   * y lo atiende otro; en la prueba, sin decirlo, el operador escribe y no ve pasar
   * absolutamente nada, que es indistinguible de "el simulador está roto".
   */
  if (turns.length === 0) {
    turns.push(explicarSilencio(plan.reason));
  }

  return turns;
}

function esperaDe(plan: FlowPlan): SimWaiting {
  if (plan.reason === 'ended' || plan.reason === 'handoff') return 'ended';
  const ultimo = plan.steps[plan.steps.length - 1];
  if (!ultimo) return 'idle';
  if (ultimo.kind === 'ask_text') return 'text';
  if (ultimo.kind === 'ask_buttons' || ultimo.kind === 'ask_list') return 'choice';
  if (ultimo.kind === 'run_tool' || ultimo.kind === 'run_agent') return 'action';
  return 'idle';
}

// ─── Las opciones que se ven ──────────────────────────────────────────────────

export type SimChoice = { id: string; label: string; description?: string };

/**
 * Las opciones que le llegarían al cliente en esta pregunta.
 *
 * Se vuelven a resolver contra el estado VIVO en vez de usar las del plan, que es
 * exactamente lo que hace el runtime antes de mandar el mensaje: `advance()` arma el
 * plan entero de una, así que una acción silenciosa del mismo turno escribe `vars`
 * DESPUÉS de que la pregunta ya se armó, y en el plan sale vacía.
 */
export function choicesForStep(
  graph: FlowGraph,
  session: SimSession,
  step: FlowStep,
): SimChoice[] {
  if (step.kind !== 'ask_buttons' && step.kind !== 'ask_list') return [];

  const node = graph.nodes.find((n) => n.id === step.nodeId);
  if (node && (node.type === 'ask_buttons' || node.type === 'ask_list')) {
    return resolveNodeOptions(node, session.state).map((option) => ({
      id: flowTapId(node.id, option.value),
      label: option.label,
      ...(option.description ? { description: option.description } : {}),
    }));
  }

  // El nodo ya no está en el grafo (lo borraron con la prueba abierta): se muestra
  // lo que el plan había resuelto, para no dejar la pregunta sin nada que tocar.
  if (step.kind === 'ask_buttons') return step.buttons.map((b) => ({ id: b.id, label: b.label }));
  return step.rows.map((r) => ({
    id: r.id,
    label: r.title,
    ...(r.description ? { description: r.description } : {}),
  }));
}

/**
 * Los saludos con los que se puede arrancar la prueba.
 *
 * Sin esto, el operador tiene que adivinar qué palabra despierta el recorrido —y si
 * la entrada usa `exact`, una palabra de más no matchea y parece que está roto.
 */
export function openers(graph: FlowGraph): string[] {
  const palabras: string[] = [];
  for (const node of graph.nodes) {
    if (node.type !== 'start') continue;
    const primera = node.match?.exact?.[0] ?? node.match?.keywords?.[0];
    if (primera && !palabras.includes(primera)) palabras.push(primera);
  }
  return palabras;
}

/** Por qué este turno no le dijo nada al cliente. */
function explicarSilencio(reason: FlowPlan['reason']): SimTurn {
  if (reason === 'broken_graph') {
    return {
      role: 'system',
      kind: 'broken',
      message: 'El recorrido se corta acá: falta una flecha, o la que hay no lleva a ningún lado.',
    };
  }
  if (reason === 'no_match') {
    return {
      role: 'system',
      kind: 'passthrough',
      message:
        'Ninguna entrada matchea este mensaje. En producción lo atiende el bot anterior o la IA — salvo que el recorrido esté marcado como "atiende todo", que responde con el menú.',
    };
  }
  return {
    role: 'system',
    kind: 'passthrough',
    message:
      'El recorrido llega a un final sin texto: no le responde nada al cliente y le cede el turno al bot anterior o a la IA. Es a propósito en el recorrido base.',
  };
}
