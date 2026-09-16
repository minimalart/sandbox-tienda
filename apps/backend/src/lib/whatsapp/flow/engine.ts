/**
 * El intérprete del grafo. PURO: no manda mensajes, no llama tools, no toca la
 * base. Recibe el grafo, el estado de la conversación y lo que escribió el
 * cliente, y devuelve un PLAN — qué hacer y en qué nodo quedar.
 *
 * La separación es la misma que ya usa el asesor guiado (`advisor/engine.ts`
 * decide, `advisor/flow.ts` hace I/O), y por el mismo motivo: un motor sin efectos
 * se prueba con una tabla de casos en milisegundos, y todo lo que se puede probar
 * así es lo que después no explota con un cliente adelante.
 *
 * ─── Cómo avanza ──────────────────────────────────────────────────────────────
 *
 * Un TICK atiende un mensaje entrante. El motor entra a un nodo, junta sus
 * efectos y sigue por la arista que corresponda, encadenando nodos hasta topar con
 * uno BLOQUEANTE (`BLOCKING_NODE_TYPES`): una pregunta, una acción, una derivación
 * o el final. Ahí guarda dónde quedó y devuelve.
 *
 * Por qué `action` bloquea: las tools de WhatsApp le hablan al cliente ellas
 * mismas (mandan el carrusel, los botones, el detalle del pedido). Si el motor
 * siguiera encadenando después de una, el turno terminaría con dos o tres mensajes
 * pisándose — que es exactamente el bug que los PRs #541-551 arreglaron a mano en
 * el bot viejo.
 *
 * La excepción es `silent` (ver `FlowNode.silent`): esa acción NO le habla al
 * cliente, así que no hay nada que se pise y el recorrido sigue en el mismo turno.
 * Sin eso no se puede expresar "agregá al carrito y preguntá si quiere algo más"
 * en un solo mensaje, que es el corazón de comprar por chat.
 */

import {
  BLOCKING_NODE_TYPES,
  FLOW_TIMEOUT_ON,
  WAITING_NODE_TYPES,
  WA_LIMITS,
  type FlowCondition,
  type FlowEdge,
  type FlowGraph,
  type FlowNode,
  type FlowOption,
} from './graph';

// ─── Estado ───────────────────────────────────────────────────────────────────

/**
 * Dónde está la conversación dentro del grafo. Vive en `whatsapp_conversation.session`
 * bajo la clave `graph`, que es json libre: no hace falta migración.
 */
export type FlowState = {
  /** Versión del grafo que se está recorriendo. Si cambia, el recorrido se reinicia. */
  version_id: string;
  /** Nodo en el que quedó esperando. `null` = todavía no entró. */
  node_id: string | null;
  /** Respuestas a los `ask_*`, por id de nodo. */
  answers: Record<string, string>;
  /** Variables sueltas que escriben las acciones. */
  vars: Record<string, unknown>;
  /** Nodos recorridos en esta sesión, en orden. Alimenta la traza. */
  visited: string[];
  /**
   * Cuándo vence la espera del paso en el que quedó (ISO), o `null` si no vence.
   *
   * Vive en el ESTADO y no se recalcula al leerlo porque es lo único que hace
   * visible una conversación abandonada: nadie vuelve a pensar en ella hasta que
   * el cliente escribe, así que si el instante no está escrito en algún lado, no
   * hay nada que un barrido pueda encontrar.
   */
  awaiting_until: string | null;
};

export const emptyState = (versionId: string): FlowState => ({
  version_id: versionId,
  node_id: null,
  answers: {},
  vars: {},
  visited: [],
  awaiting_until: null,
});

/**
 * Lee el estado del grafo de la sesión.
 *
 * Si la versión activa cambió mientras la conversación estaba a mitad de camino, se
 * empieza de nuevo: el `node_id` guardado apunta a un nodo del grafo VIEJO y seguir
 * con él sería recorrer un mapa que ya no existe.
 */
export function readState(session: Record<string, unknown> | null | undefined, versionId: string): FlowState {
  const raw = (session?.graph ?? null) as Partial<FlowState> | null;
  if (!raw || raw.version_id !== versionId) return emptyState(versionId);
  // Cada campo se valida por separado, no con un cast: lo guardado es json de una
  // versión anterior del código o de una sesión que quedó a medias, y un `answers`
  // que resultó ser un string reventaría recién al leer una respuesta.
  const asRecord = (value: unknown): Record<string, never> =>
    value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, never>)
      : {};

  return {
    version_id: versionId,
    node_id: typeof raw.node_id === 'string' ? raw.node_id : null,
    answers: asRecord(raw.answers) as Record<string, string>,
    vars: asRecord(raw.vars) as Record<string, unknown>,
    visited: Array.isArray(raw.visited) ? raw.visited.filter((v): v is string => typeof v === 'string') : [],
    awaiting_until: typeof raw.awaiting_until === 'string' ? raw.awaiting_until : null,
  };
}

/** Lo que llega del cliente en este turno. */
export type FlowInput = {
  /** Texto libre, ya normalizado por el caller. `null` si fue un tap. */
  text: string | null;
  /** Id del botón o fila que tocó. `null` si escribió. */
  selectionId: string | null;
  /**
   * El turno lo dispara el RELOJ y no el cliente: venció la espera del paso donde
   * quedó. Va acá y no en un `advance` aparte porque el resto del turno es
   * idéntico —se elige una arista y se recorre hasta el próximo bloqueante—; lo
   * único distinto es de dónde sale la primera arista.
   */
  timedOut?: boolean;
};

// ─── Plan ─────────────────────────────────────────────────────────────────────

export type FlowStep =
  | { kind: 'send_text'; nodeId: string; body: string }
  | { kind: 'ask_text'; nodeId: string; body: string }
  | {
      kind: 'ask_buttons';
      nodeId: string;
      body: string;
      buttons: Array<{ id: string; label: string }>;
      /**
       * Presente cuando las opciones salen de una variable. El runtime las vuelve
       * a resolver justo antes de mandar el mensaje: una acción SILENCIOSA de este
       * mismo turno escribe `vars` DESPUÉS de que se armó el plan, y sin volver a
       * mirar el paso saldría con la lista del turno anterior — o vacío.
       */
      optionsFrom?: string;
    }
  | {
      kind: 'ask_list';
      nodeId: string;
      body: string;
      button: string;
      rows: Array<{ id: string; title: string; description?: string }>;
      /** Ver `optionsFrom` en `ask_buttons`. */
      optionsFrom?: string;
    }
  | {
      kind: 'run_tool';
      nodeId: string;
      tool: string;
      args: Record<string, unknown>;
      /**
       * `true` = la tool NO tiene que mandar su propio mensaje de seguimiento; el
       * grafo dibuja lo que sigue. Ver `FlowNode.silent`.
       */
      silent: boolean;
    }
  | {
      kind: 'run_agent';
      nodeId: string;
      /** `key` del agente del asistente que atiende este turno. */
      agentKey: string;
      /** Lo que escribió el cliente. Es la pregunta que el agente tiene que contestar. */
      message: string;
      /** Instrucción extra de ESTE paso ("contestá sólo sobre envíos"), ya resuelta. */
      context?: string;
    }
  | { kind: 'handoff'; nodeId: string; reason: string };

/**
 * Por qué arista avanzó el recorrido en cada salto.
 *
 * `visited` dice por qué NODOS pasó, y con eso alcanza para reconstruir el camino
 * salvo en un caso que en los recorridos reales es común: dos salidas distintas del
 * mismo paso que terminan en el mismo destino ("Sí" y "No" cerrando las dos en el
 * cierre). Ahí el par de nodos no alcanza para saber cuál se tomó, y la analítica por
 * rama —que existe justamente para ver qué opción elige la gente— tendría que
 * adivinar.
 */
export type FlowHop = { from: string; to: string; edgeId: string };

export type FlowPlan = {
  /** Qué ejecutar, en orden. Vacío = el grafo no tenía nada que decir. */
  steps: FlowStep[];
  /** Los saltos de este turno, con la arista de cada uno. Ver `FlowHop`. */
  trail: FlowHop[];
  /** El estado con el que arranca el próximo turno. */
  state: FlowState;
  /**
   * `false` cuando ningún `start` matcheó y no hay catch-all: el caller decide qué
   * hacer (hoy, el menú anti-silencio). Nunca se responde con nada.
   */
  handled: boolean;
  /** Por qué el tick terminó donde terminó. Va al event log. */
  reason: 'awaiting_reply' | 'ended' | 'handoff' | 'no_match' | 'broken_graph';
};

/**
 * Tope de saltos por tick. Un grafo con un ciclo de nodos no bloqueantes
 * (`message → condition → message`) colgaría el webhook; `validateGraph` no lo
 * detecta porque un ciclo puede ser legítimo si pasa por un `ask`.
 */
const MAX_HOPS = 50;

// ─── Ids de botón ─────────────────────────────────────────────────────────────

/**
 * Prefijo propio, distinto de `act:` / `adv:` / `variant_` del bot viejo, para que
 * los dos motores puedan convivir mientras se migra sin pisarse los taps.
 */
export const FLOW_TAP_PREFIX = 'flow:';

export const flowTapId = (nodeId: string, value: string): string =>
  `${FLOW_TAP_PREFIX}${nodeId}:${value}`;

export function parseFlowTapId(id: string): { nodeId: string; value: string } | null {
  if (!id.startsWith(FLOW_TAP_PREFIX)) return null;
  const rest = id.slice(FLOW_TAP_PREFIX.length);
  // El VALOR puede traer `:`; el id de nodo no, así que se parte en el primero.
  const at = rest.indexOf(':');
  if (at <= 0 || at === rest.length - 1) return null;
  return { nodeId: rest.slice(0, at), value: rest.slice(at + 1) };
}

/**
 * Prefijo de los taps de PRODUCTO que mandan las tools (`wa_search_products` arma
 * el carrusel con `variant_<id>`). No es del grafo, pero el grafo necesita poder
 * usarlo.
 */
const VARIANT_TAP_PREFIX = 'variant_';

/**
 * Guarda en `vars` el tap que NO es del grafo.
 *
 * Las tools le hablan al cliente ellas mismas y sus botones viajan con ids propios
 * (`variant_…` del carrusel, `act:…` del router). El motor no puede rutearlos por
 * `on` —no salieron de un `ask_*` dibujado en el canvas—, pero dejarlos a mano en
 * `vars` alcanza para que una arista los mire con `when` y una acción los use con
 * `{{vars.selected_variant}}`.
 *
 * Sin esto el grafo NO PODÍA VENDER: parado en el `action` de la búsqueda,
 * descartaba el tap de "Agregar" y seguía por la arista incondicional, así que
 * `wa_add_to_cart` no se llamaba nunca.
 *
 * Se limpia SIEMPRE, aunque el turno no traiga selección: si quedara la del turno
 * anterior, la arista condicional volvería a tomar la rama de agregar y el pedido
 * se duplicaría solo.
 */
function rememberSelection(state: FlowState, selectionId: string | null): void {
  delete state.vars.selection;
  delete state.vars.selected_variant;
  // Un tap del propio grafo ya se rutea por `on`; meterlo acá sería darle dos
  // caminos a lo mismo.
  if (!selectionId || parseFlowTapId(selectionId)) return;
  state.vars.selection = selectionId;
  if (selectionId.startsWith(VARIANT_TAP_PREFIX)) {
    state.vars.selected_variant = selectionId.slice(VARIANT_TAP_PREFIX.length);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Saca signos y espacios de más para comparar el mensaje ENTERO: "¡Hola!", "hola"
 * y "hola..." son el mismo saludo.
 */
export function stripPunctuation(folded: string): string {
  return folded
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Minúsculas sin tildes: los clientes escriben "sucursales" y "sucursáles". */
export function foldText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Reemplaza `{{...}}` dentro de un TEXTO que se le manda al cliente.
 *
 * Acá sí es interpolación parcial —"Perfecto, busco {{answers.que_busca}} 🔎"— y en
 * `resolveArgs` no, y la asimetría es deliberada: un argumento viaja a una tool y
 * pegarle texto del cliente en el medio es una vía de inyección; un mensaje vuelve
 * a la misma persona que lo escribió, así que no hay nada que inyectar.
 *
 * Lo que no se conoce se reemplaza por VACÍO y no se deja el `{{...}}` crudo: un
 * cliente que recibe "Hola {{customer_name}}" ve el andamio del sistema.
 */
export function renderText(template: string, state: FlowState, input: FlowInput): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_match, path: string) => {
    if (path === 'text') return input.text ?? '';
    if (path.startsWith('answers.')) return state.answers[path.slice('answers.'.length)] ?? '';
    if (path.startsWith('vars.')) {
      const value = state.vars[path.slice('vars.'.length)];
      return value === undefined || value === null ? '' : String(value);
    }
    return '';
  });
}

/** Lee un dot-path sobre `{ answers, vars }`. Devuelve `undefined` si no existe. */
function readPath(state: FlowState, path: string): unknown {
  let current: unknown = { answers: state.answers, vars: state.vars };
  for (const segment of path.split('.')) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

/**
 * Una opción que llegó por `vars`, normalizada.
 *
 * Se acepta `{ value, label, description? }` y también un string pelado, que es lo
 * más cómodo para una lista de cantidades o de terminaciones: ahí el texto ES el
 * valor. Lo que no tenga `value` se descarta en silencio — una fila sin valor le
 * llega al cliente como un botón que no hace nada.
 */
function normalizeDynamicOption(raw: unknown): FlowOption | null {
  if (typeof raw === 'string') {
    const value = raw.trim();
    return value ? { value, label: value } : null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const value = typeof o.value === 'string' && o.value.trim() ? o.value.trim() : null;
  if (!value) return null;
  const label = typeof o.label === 'string' && o.label.trim() ? o.label.trim() : value;
  const description =
    typeof o.description === 'string' && o.description.trim() ? o.description.trim() : undefined;
  return { value, label, ...(description ? { description } : {}) };
}

/**
 * Las opciones REALES de un `ask_*`: las que llegan por `optionsFrom` primero y las
 * dibujadas en el canvas al final.
 *
 * El orden no es estético. Las dibujadas son las salidas de emergencia —"Ninguna me
 * sirve", "Hacer otra búsqueda", "Necesito ayuda"— y son las únicas con arista
 * propia. Por eso, cuando no entran todas, se recortan las DINÁMICAS: recortar la
 * salida de emergencia deja al cliente encerrado en la pregunta, que es peor que
 * mostrarle un producto menos.
 *
 * Es pura a propósito. El runtime la vuelve a llamar justo antes de mandar el
 * mensaje, porque una acción silenciosa del mismo turno puede haber escrito `vars`
 * DESPUÉS de que se armó el plan.
 */
export function resolveNodeOptions(node: FlowNode, state: FlowState): FlowOption[] {
  const drawn = node.options ?? [];
  if (!node.optionsFrom) return drawn;

  const raw = readPath(state, node.optionsFrom);
  const dynamic = (Array.isArray(raw) ? raw : [])
    .map(normalizeDynamicOption)
    .filter(Boolean) as FlowOption[];

  // Una opción dinámica que repite el valor de una dibujada haría que el motor
  // rutee por la arista de la dibujada: se descarta la dinámica.
  const taken = new Set(drawn.map((o) => o.value));
  const fresh = dynamic.filter((o) => !taken.has(o.value) && (taken.add(o.value), true));

  const max = node.type === 'ask_buttons' ? WA_LIMITS.buttons : WA_LIMITS.listRows;
  const room = Math.max(0, max - drawn.length);
  return [...fresh.slice(0, room), ...drawn];
}

function matchesCondition(state: FlowState, condition: FlowCondition): boolean {
  const actual = readPath(state, condition.path);
  switch (condition.op) {
    case 'eq':
      return actual === condition.value;
    case 'ne':
      return actual !== condition.value;
    case 'exists':
      return actual !== undefined && actual !== null && actual !== '';
    case 'empty':
      return actual === undefined || actual === null || actual === '';
    default:
      // Un operador que el editor todavía no conoce NO puede dar `true` por
      // descarte: sería tomar una rama por un typo.
      return false;
  }
}

/**
 * La arista que sale de un nodo.
 *
 * Orden deliberado: primero la que matchea la opción elegida, después la primera
 * cuya condición se cumple, y al final la incondicional. Así la rama por default
 * se puede dibujar en cualquier lado del canvas sin cambiar el resultado.
 */
/**
 * Qué rama toma una bifurcación con salidas DECLARADAS.
 *
 * Devuelve el `value` de la primera rama cuya condición se cumple y, si ninguna
 * aplica, el de la rama sin condición — la salida por default. Ese valor entra a
 * `pickEdge` como si fuera la opción que eligió el cliente, así que la bifurcación
 * reusa exactamente el mismo mecanismo que un `ask_buttons`: el nodo declara las
 * salidas y la arista las ata por `on`.
 *
 * `null` cuando el nodo NO declara ramas: es una bifurcación del formato viejo y el
 * motor sigue resolviéndola por el `when` de cada arista. Sin esta salida, publicar
 * esta versión rompería todos los recorridos que ya están atendiendo.
 */
export function resolveBranch(node: FlowNode, state: FlowState): string | null {
  const branches = node.branches ?? [];
  if (branches.length === 0) return null;
  const hit = branches.find((b) => b.when && matchesCondition(state, b.when));
  if (hit) return hit.value;
  return branches.find((b) => !b.when)?.value ?? null;
}

function pickEdge(edges: FlowEdge[], state: FlowState, choice: string | null): FlowEdge | null {
  if (choice !== null) {
    const byChoice = edges.find((e) => e.on === choice);
    if (byChoice) return byChoice;
  }
  const byCondition = edges.find((e) => e.when && !e.on && matchesCondition(state, e.when));
  if (byCondition) return byCondition;
  return edges.find((e) => !e.when && !e.on) ?? null;
}

/**
 * Resuelve `{{text}}`, `{{answers.<nodo>}}` y `{{vars.<nombre>}}` en los argumentos
 * de un `action`.
 *
 * Sin esto, una búsqueda sólo podría llevar un texto fijo dibujado en el canvas, y
 * el flujo más común del bot —"contame qué buscás" seguido de buscarlo— sería
 * imposible de expresar.
 *
 * `{{vars.selected_variant}}` es lo que habilita el otro flujo imprescindible:
 * agregar al carrito lo que el cliente TOCÓ en el carrusel. Ver `rememberSelection`.
 *
 * El reemplazo es sobre strings COMPLETOS y no interpolación parcial: `{{text}}`
 * solo se reemplaza por el valor; `hola {{text}}` queda tal cual. Interpolar
 * abriría la puerta a que un cliente inyecte contenido en un argumento que después
 * viaja a una tool.
 */
function resolveArgs(
  args: Record<string, unknown>,
  state: FlowState,
  input: FlowInput,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    if (typeof value !== 'string') {
      out[key] = value;
      continue;
    }
    if (value === '{{text}}') {
      out[key] = input.text ?? '';
      continue;
    }
    const answer = /^\{\{answers\.([A-Za-z0-9_-]+)\}\}$/.exec(value);
    if (answer) {
      out[key] = state.answers[answer[1] as string] ?? '';
      continue;
    }
    const variable = /^\{\{vars\.([A-Za-z0-9_-]+)\}\}$/.exec(value);
    if (variable) {
      const stored = state.vars[variable[1] as string];
      out[key] = stored === undefined || stored === null ? '' : stored;
      continue;
    }
    out[key] = value;
  }
  return out;
}

type Indexed = {
  byId: Map<string, FlowNode>;
  outgoing: Map<string, FlowEdge[]>;
};

function indexGraph(graph: FlowGraph): Indexed {
  const byId = new Map<string, FlowNode>();
  for (const node of graph.nodes ?? []) byId.set(node.id, node);
  const outgoing = new Map<string, FlowEdge[]>();
  for (const edge of graph.edges ?? []) {
    const list = outgoing.get(edge.source) ?? [];
    list.push(edge);
    outgoing.set(edge.source, list);
  }
  return { byId, outgoing };
}

/**
 * El `start` que atiende este mensaje: primero por tap, después por palabra, y el
 * catch-all sólo si no matcheó nada.
 */
export function findEntry(graph: FlowGraph, input: FlowInput): FlowNode | null {
  const starts = (graph.nodes ?? []).filter((n) => n.type === 'start');

  if (input.selectionId) {
    const byTap = starts.find((n) => n.match?.taps?.includes(input.selectionId as string));
    if (byTap) return byTap;
  }

  if (input.text) {
    const folded = foldText(input.text);

    // `exact` va ANTES que `keywords` y compara el mensaje ENTERO. Es lo que un
    // saludo necesita: con `keywords: ['hola']`, "Hola! ¿Tienen sucursales en
    // CABA?" entraba por el saludo y el cliente recibía el menú en vez de una
    // respuesta — la pregunta no llegaba ni al router ni al modelo.
    const bare = stripPunctuation(folded);
    const byExact = starts.find((n) =>
      (n.match?.exact ?? []).some((k) => stripPunctuation(foldText(k)) === bare),
    );
    if (byExact) return byExact;

    const byKeyword = starts.find((n) =>
      (n.match?.keywords ?? []).some((k) => folded.includes(foldText(k))),
    );
    if (byKeyword) return byKeyword;
  }

  return starts.find((n) => n.match?.fallback) ?? null;
}

// ─── El tick ──────────────────────────────────────────────────────────────────

/**
 * Atiende un mensaje: resuelve dónde entra, recorre hasta el próximo nodo
 * bloqueante y devuelve el plan.
 *
 * Nunca lanza. Un grafo roto devuelve `handled: false` con
 * `reason: 'broken_graph'` y el caller cae a su fallback: que el bot se quede
 * mudo por una arista mal dibujada es peor que cualquier respuesta.
 */
export function advance(
  graph: FlowGraph,
  state: FlowState,
  input: FlowInput,
  now: Date = new Date(),
): FlowPlan {
  const { byId, outgoing } = indexGraph(graph);
  const steps: FlowStep[] = [];
  const trail: FlowHop[] = [];
  const next: FlowState = {
    ...state,
    answers: { ...state.answers },
    vars: { ...state.vars },
    visited: [...state.visited],
  };

  const done = (reason: FlowPlan['reason'], handled = true): FlowPlan => ({
    steps,
    trail,
    state: next,
    handled,
    reason,
  });

  /**
   * Deja el recorrido esperando en un paso y, si ese paso tiene plazo, anota
   * cuándo vence.
   *
   * El plazo se cuenta desde que la pregunta SE MANDA, cada vez que se manda. Si el
   * cliente escribe cualquier otra cosa y el recorrido lo trae de vuelta a esta
   * misma pregunta, el reloj arranca de nuevo — y tiene que arrancar de nuevo,
   * porque acaba de verla otra vez. Lo que se mide es hace cuánto que el cliente
   * tiene una pregunta delante sin contestar, no hace cuánto que existe el paso.
   */
  const esperar = (node: FlowNode): FlowPlan => {
    next.node_id = node.id;
    next.awaiting_until =
      node.timeout_seconds && WAITING_NODE_TYPES.has(node.type)
        ? new Date(now.getTime() + node.timeout_seconds * 1000).toISOString()
        : null;
    return done('awaiting_reply');
  };

  /** Anota el salto y devuelve el nodo destino. */
  const seguir = (from: string, edge: FlowEdge): FlowNode | null => {
    trail.push({ from, to: edge.target, edgeId: edge.id });
    return byId.get(edge.target) ?? null;
  };

  // El tap que no es del grafo se anota ANTES de elegir arista, para que una
  // condición pueda mirarlo en el mismo turno en que llegó.
  rememberSelection(next, input.selectionId);

  // ── 1. ¿Dónde arranca este turno? ───────────────────────────────────────────
  let current: FlowNode | null = null;
  let choice: string | null = null;

  const waiting = state.node_id ? byId.get(state.node_id) ?? null : null;

  if (input.timedOut) {
    /**
     * Venció la espera. Sólo puede vencer el paso donde quedó y sólo si tiene
     * plazo: un barrido puede llegar tarde —la conversación siguió y ya está en
     * otro lado— y entonces no hay nada que vencer.
     */
    if (!waiting || !waiting.timeout_seconds || !WAITING_NODE_TYPES.has(waiting.type)) {
      next.awaiting_until = null;
      return done('ended', false);
    }
    /**
     * La salida se busca por nombre EXACTO y no con `pickEdge`. Si el paso no tiene
     * salida de vencimiento, `pickEdge` terminaría cayendo en la arista
     * incondicional y el recorrido seguiría como si el cliente hubiera contestado
     * —con `answers` vacío—, que es peor que no hacer nada.
     */
    const vencida = (outgoing.get(waiting.id) ?? []).find((e) => e.on === FLOW_TIMEOUT_ON);
    next.awaiting_until = null;
    if (!vencida) return done('ended', false);
    current = seguir(waiting.id, vencida);
    if (!current) return done('broken_graph', false);
  } else if (waiting && (waiting.type === 'ask_buttons' || waiting.type === 'ask_list')) {
    // Estaba esperando una respuesta. Vale el tap, y también el texto que coincida
    // con una etiqueta: mucha gente contesta "sí" en vez de tocar el botón.
    const tapped = input.selectionId ? parseFlowTapId(input.selectionId) : null;
    if (tapped && tapped.nodeId === waiting.id) {
      choice = tapped.value;
    } else if (input.text) {
      const folded = foldText(input.text);
      // Se buscan sobre las opciones RESUELTAS y no sobre las dibujadas: si el
      // cliente escribe "20 L" en vez de tocar la fila, esa fila salió de `vars`.
      // Los `vars` del turno anterior siguen en el estado, así que acá ya están.
      const typed = resolveNodeOptions(waiting, state).find(
        (o) => foldText(o.label) === folded || foldText(o.value) === folded,
      );
      if (typed) choice = typed.value;
    }

    if (choice !== null) {
      next.answers[waiting.id] = choice;
      const edge = pickEdge(outgoing.get(waiting.id) ?? [], next, choice);
      if (!edge) return done('broken_graph', false);
      current = seguir(waiting.id, edge);
    }
    // Sin elección válida se cae abajo: el mensaje se trata como uno nuevo, así el
    // cliente puede cambiar de tema en vez de quedar preso de la pregunta.
  } else if (waiting && waiting.type === 'ask_text') {
    // Lo que escribió el cliente ES la respuesta. Un tap no lo es: si tocó un botón
    // viejo, el turno reentra por el start en vez de guardar un id como si fuera
    // texto que después terminaría en una búsqueda de "flow:menu:buy".
    const answer = input.text?.trim();
    if (answer) {
      next.answers[waiting.id] = answer;
      const edge = pickEdge(outgoing.get(waiting.id) ?? [], next, null);
      if (!edge) return done('broken_graph', false);
      current = seguir(waiting.id, edge);
    }
  } else if (waiting && (waiting.type === 'action' || waiting.type === 'agent')) {
    // La acción —o el agente— del turno anterior ya corrió; ahora se sigue por su
    // arista. El agente contesta UNA vez: el turno siguiente vuelve al recorrido.
    const edge = pickEdge(outgoing.get(waiting.id) ?? [], next, null);
    if (edge) current = seguir(waiting.id, edge);
  }

  if (!current) {
    const entry = findEntry(graph, input);
    if (!entry) return done('no_match', false);
    const edge = pickEdge(outgoing.get(entry.id) ?? [], next, null);
    next.visited.push(entry.id);
    if (!edge) return done('broken_graph', false);
    current = seguir(entry.id, edge);
  }

  if (!current) return done('broken_graph', false);

  // ── 2. Recorrer hasta el próximo bloqueante ─────────────────────────────────
  for (let hop = 0; hop < MAX_HOPS; hop++) {
    const node: FlowNode = current;
    next.visited.push(node.id);

    switch (node.type) {
      case 'message':
        if (node.body) {
          steps.push({ kind: 'send_text', nodeId: node.id, body: renderText(node.body, next, input) });
        }
        break;

      case 'ask_buttons':
        steps.push({
          kind: 'ask_buttons',
          nodeId: node.id,
          body: renderText(node.body ?? '', next, input),
          buttons: resolveNodeOptions(node, next).map((o) => ({
            id: flowTapId(node.id, o.value),
            label: o.label,
          })),
          // El runtime las vuelve a resolver con los `vars` frescos: una acción
          // SILENCIOSA de este mismo turno todavía no corrió cuando se armó el plan.
          ...(node.optionsFrom ? { optionsFrom: node.optionsFrom } : {}),
        });
        return esperar(node);

      case 'ask_list':
        steps.push({
          kind: 'ask_list',
          nodeId: node.id,
          body: renderText(node.body ?? '', next, input),
          button: node.listButton || 'Ver opciones',
          rows: resolveNodeOptions(node, next).map((o) => ({
            id: flowTapId(node.id, o.value),
            title: o.label,
            description: o.description,
          })),
          ...(node.optionsFrom ? { optionsFrom: node.optionsFrom } : {}),
        });
        return esperar(node);

      case 'ask_text':
        steps.push({ kind: 'ask_text', nodeId: node.id, body: renderText(node.body ?? '', next, input) });
        return esperar(node);

      case 'agent':
        /**
         * El agente recibe lo que el cliente escribió en ESTE turno. Si llegó por un
         * tap no hay texto, y el agente igual tiene que poder arrancar: el `body` del
         * paso es lo que le dice de qué se trata.
         */
        steps.push({
          kind: 'run_agent',
          nodeId: node.id,
          agentKey: node.agent_key as string,
          message: input.text ?? '',
          ...(node.body ? { context: renderText(node.body, next, input) } : {}),
        });
        return esperar(node);

      case 'action':
        steps.push({
          kind: 'run_tool',
          nodeId: node.id,
          tool: node.tool as string,
          args: resolveArgs(node.args ?? {}, next, input),
          silent: node.silent === true,
        });
        // Una acción SILENCIOSA no le habla al cliente: no hay mensaje que se pise
        // ni respuesta que esperar, así que el recorrido sigue en el mismo turno.
        // Es lo que permite "agregar al carrito y preguntar si sigue" en un solo
        // mensaje; cortando acá, el cliente tocaba "Agregar" y no veía NADA.
        if (node.silent === true) break;
        return esperar(node);

      case 'handoff':
        steps.push({ kind: 'handoff', nodeId: node.id, reason: node.reason ?? 'flow' });
        next.node_id = null;
        return done('handoff');

      case 'end':
        if (node.body) {
          steps.push({ kind: 'send_text', nodeId: node.id, body: renderText(node.body, next, input) });
        }
        next.node_id = null;
        return done('ended');

      case 'condition':
      case 'start':
        break;

      default:
        return done('broken_graph', steps.length > 0);
    }

    const out = outgoing.get(node.id) ?? [];
    /**
     * Una bifurcación con ramas declaradas se resuelve SÓLO por su `on`: la rama
     * elegida tiene que tener su arista dibujada. Cayendo al `pickEdge` general, un
     * grafo con la rama a medio cablear se iría por la primera arista suelta —
     * tomaría un camino que nadie eligió, en silencio.
     */
    const branch = node.type === 'condition' ? resolveBranch(node, next) : null;
    const edge = branch !== null
      ? out.find((e) => e.on === branch) ?? null
      : pickEdge(out, next, null);
    if (!edge) return done('broken_graph', steps.length > 0);
    const target = seguir(node.id, edge);
    if (!target) return done('broken_graph', steps.length > 0);
    current = target;
  }

  // Se agotaron los saltos: hay un ciclo de nodos no bloqueantes. Se devuelve lo
  // que se juntó hasta acá en vez de colgar el turno.
  if (!BLOCKING_NODE_TYPES.has(current.type)) next.node_id = null;
  return done('broken_graph', steps.length > 0);
}
