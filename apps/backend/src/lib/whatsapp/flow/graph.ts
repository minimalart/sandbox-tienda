/**
 * El GRAFO de conversación: tipos y validación. Es DATO puro — no importa nada de
 * Medusa ni de WhatsApp, así que se puede tipar, validar y testear sin levantar
 * nada.
 *
 * El grafo se guarda entero como json en una fila de `whatsapp_flow_version` y no
 * en tablas de nodos y aristas. Se edita completo desde el canvas y no hay una
 * sola consulta que pida "los nodos tal": partirlo en tablas agregaría joins y una
 * migración por cada campo nuevo del editor, a cambio de nada. Mismo criterio que
 * `demo_store.home_puck_data` y `ai_workflow.steps`.
 */

// ─── Nodos ────────────────────────────────────────────────────────────────────

/**
 * Los ocho tipos que cubren el bot actual.
 *
 * No hay un tipo `search` ni `advisor`: los dos son un `action` sobre las tools que
 * ya existen (`wa_search_products`, `wa_guided_start`). Un tipo por tool sería
 * multiplicar el vocabulario del editor sin agregar poder.
 */
export const FLOW_NODE_TYPES = [
  /** Entrada al grafo. Su `match` decide qué mensajes lo despiertan. */
  'start',
  /** Manda texto y sigue. */
  'message',
  /** Pregunta con botones nativos (máx. 3). Espera respuesta. */
  'ask_buttons',
  /** Pregunta con lista interactiva (máx. 10 filas). Espera respuesta. */
  'ask_list',
  /**
   * Pregunta a mano abierta: manda el texto y espera lo que el cliente ESCRIBA.
   *
   * Es el nodo que hoy resuelve `awaiting_search_query` en el router. Sin él no hay
   * forma de que una búsqueda salga de las palabras del cliente: los `ask_*` de
   * opciones sólo aceptan una de las que se les dibujó.
   */
  'ask_text',
  /** Bifurca sin hablarle al cliente: elige arista por condición. */
  'condition',
  /** Ejecuta una tool de WhatsApp. Espera el próximo mensaje. */
  'action',
  /**
   * Le pasa el turno a un AGENTE del asistente y manda lo que conteste.
   *
   * Es la salida del recorrido hacia lo que no se puede dibujar. Un recorrido sabe
   * llevar una conversación con forma —menú, pregunta, rama—, y hay tramos que no la
   * tienen: "contame qué problema tenés con el producto" no se resuelve con tres
   * botones. Hasta acá la única forma de que hablara un agente era que NINGUNA Entrada
   * matcheara y el turno se cayera al router, o sea por accidente y para toda la
   * conversación.
   *
   * Contesta UNA vez y devuelve el turno al recorrido, que sigue por su salida. No se
   * queda con la conversación: un agente suelto adentro de un recorrido determinístico
   * es justo lo que el recorrido viene a evitar.
   */
  'agent',
  /** Deriva a una persona y corta. */
  'handoff',
  /** Fin del recorrido. */
  'end',
] as const;

export type FlowNodeType = (typeof FLOW_NODE_TYPES)[number];

/**
 * Nodos que CORTAN el tick porque lo que sigue depende del cliente o de una tool
 * que ya le habló. Los demás encadenan dentro del mismo turno.
 */
export const BLOCKING_NODE_TYPES: ReadonlySet<FlowNodeType> = new Set([
  'ask_buttons',
  'ask_list',
  'ask_text',
  'action',
  'agent',
  'handoff',
  'end',
]);

/**
 * Los pasos que se quedan esperando a que el cliente conteste — y que por eso
 * pueden quedarse esperando PARA SIEMPRE.
 *
 * `action` no está en la lista aunque también corta el turno: ahí ya habló una
 * tool y el recorrido sigue con el próximo mensaje sea cual sea, así que "no
 * contestó" no describe nada distinto de lo que ya pasa.
 */
export const WAITING_NODE_TYPES: ReadonlySet<FlowNodeType> = new Set([
  'ask_buttons',
  'ask_list',
  'ask_text',
]);

/**
 * El `on` reservado de la salida que se toma cuando el cliente NO contesta.
 *
 * Es una palabra legible y no un símbolo raro porque termina en el json del grafo
 * y en los logs, donde alguien la va a leer. Que ninguna respuesta se llame igual
 * lo verifica `validateGraph`: el editor genera los valores solo (`opcion_N`), así
 * que sólo puede chocar en un grafo escrito a mano.
 */
export const FLOW_TIMEOUT_ON = 'timeout';

/**
 * Cuánto puede esperar un paso, en segundos.
 *
 * El techo NO es una preferencia de diseño: la sesión de WhatsApp se recicla sola
 * a las 12 h (`WA_SESSION_IDLE_HOURS`) y con ella se va el estado del recorrido,
 * así que una espera más larga despertaría sobre una conversación que ya empezó de
 * cero — y el cliente recibiría el "¿seguís ahí?" de una charla que para el bot no
 * existe. Seis horas deja margen de sobra, y además es el orden de lo que tiene
 * sentido: pasada la ventana de 24 h de WhatsApp no se puede escribir sin una
 * plantilla aprobada por Meta, que es otra conversación y no esta.
 */
export const FLOW_TIMEOUT_MIN_SECONDS = 60;
export const FLOW_TIMEOUT_MAX_SECONDS = 6 * 60 * 60;

/** Una opción de `ask_buttons` / `ask_list`. El `value` es lo que matchea la arista. */
export type FlowOption = {
  value: string;
  label: string;
  /** Sólo en listas: la línea gris debajo del título. */
  description?: string;
};

/**
 * Una salida DECLARADA de una bifurcación.
 *
 * La bifurcación no tenía nada propio: las ramas vivían sólo en el `when` de cada
 * arista, así que el nodo no sabía cuántas salidas tenía y el inspector no podía
 * ofrecer "agregar una". La única forma de sumar una rama era arrastrar una segunda
 * flecha desde el mismo punto del rombo y descubrir después que había que editarla.
 *
 * Con `branches`, la bifurcación declara sus salidas igual que un `ask_buttons`
 * declara sus opciones, y la arista sólo las ATA por `value` con su `on`. Es el
 * modelo del nodo `decide` de Kapso, donde el nodo lleva la lista de `conditions`
 * con su `label` y las aristas matchean ese label.
 *
 * Una rama SIN `when` es la salida por default: se toma cuando ninguna otra aplica.
 */
export type FlowBranch = {
  /** Lo que matchea el `on` de la arista. */
  value: string;
  /** Nombre para el canvas y el inspector. */
  label: string;
  /** Sin condición, es la salida por default. */
  when?: FlowCondition;
};

export type FlowNode = {
  id: string;
  type: FlowNodeType;
  /** Nombre para el editor. No se le muestra nunca al cliente. */
  label?: string;
  /** Texto que se envía (`message`, `ask_buttons`, `ask_list`). */
  body?: string;
  /** Opciones de los `ask_*` DIBUJADAS en el canvas. */
  options?: FlowOption[];
  /**
   * Salidas de una `condition`. Vacío o ausente = bifurcación del formato viejo,
   * que sigue resolviéndose por el `when` de las aristas.
   */
  branches?: FlowBranch[];
  /**
   * De dónde salen las opciones que NO se pueden dibujar: un dot-path sobre
   * `{ answers, vars }`, con el mismo vocabulario que el `when` de una arista.
   *
   * Medio recorrido real no se puede escribir a mano. "¿Qué presentación
   * necesitás?" depende del producto que el cliente acaba de elegir; "elegí cuál
   * de tus pedidos querés consultar" depende de su teléfono. Hasta acá el editor
   * sólo sabía de opciones fijas, así que esas preguntas no había forma de
   * dibujarlas.
   *
   * Las dinámicas van PRIMERO y las dibujadas al final: las dibujadas son las
   * salidas de emergencia ("Ninguna me sirve", "Necesito ayuda") y son las únicas
   * que tienen arista propia. Si sobran opciones para lo que WhatsApp acepta, se
   * recortan las DINÁMICAS — recortar la salida de emergencia deja al cliente
   * encerrado en la pregunta.
   *
   * Lo que el cliente elija de la parte dinámica queda en `answers.<nodo>` y sale
   * por la arista incondicional, porque no hay ninguna arista que lo nombre.
   */
  optionsFrom?: string;
  /** Etiqueta del botón que abre la lista (`ask_list`). Máx. 20 chars. */
  listButton?: string;
  /**
   * Cuántos segundos espera la pregunta antes de seguir sola por su salida
   * `timeout`. Ausente = espera para siempre, que es como se comportó siempre.
   *
   * Sin esto, un cliente que abre una conversación y se va la deja colgada: el
   * recorrido queda parado en esa pregunta hasta que él vuelva a escribir, y si no
   * vuelve, nunca. No hay forma de mandarle un recordatorio ni de cerrarle el
   * turno, porque no existe ningún momento en el que el bot vuelva a pensar en esa
   * conversación.
   */
  timeout_seconds?: number;
  /** Nombre de la tool y sus argumentos (`action`). */
  tool?: string;
  args?: Record<string, unknown>;
  /**
   * Qué agente del asistente atiende este paso (`agent`), por su `key`.
   *
   * Va la key y no el id: es lo que se lee en el json del grafo y lo que sobrevive a
   * que alguien recree el agente. Si la key no existe cuando el turno pasa por acá, el
   * paso no contesta y el recorrido sigue — un agente mal configurado no puede dejar
   * mudo al bot.
   */
  agent_key?: string;
  /**
   * `action`: la tool NO manda su propio mensaje de seguimiento; lo que sigue lo
   * dibuja el grafo.
   *
   * Varias tools cierran su turno con botones propios —`wa_add_to_cart` pregunta
   * "¿Algo más o cerramos?", `wa_review_order` ofrece "Confirmar pago"— con ids que
   * entiende el ROUTER, no el grafo. Si el recorrido quiere seguir él con la
   * conversación esos botones sobran: el cliente veía la pregunta de la tool,
   * tocaba, y recién ahí le aparecía la del grafo. Dos preguntas seguidas para una
   * sola decisión.
   *
   * Ojo: sólo tiene sentido donde el mensaje de la tool es de SEGUIMIENTO. Marcarlo
   * en `wa_search_products` silenciaría el carrusel, que es el resultado mismo.
   */
  silent?: boolean;
  /** Motivo de la derivación (`handoff`). */
  reason?: string;
  /** Palabras y taps que despiertan un `start`. */
  match?: FlowMatch;
  /** Posición en el canvas. Sólo la usa el editor. */
  position?: { x: number; y: number };
};

/**
 * Qué despierta un `start`.
 *
 * `keywords` se compara sobre el texto en minúsculas y SIN TILDES (los clientes
 * escriben "sucursales" y "sucursáles"), y `fallback` marca el único start que
 * atiende lo que no matcheó nada.
 */
export type FlowMatch = {
  /**
   * El mensaje ENTERO tiene que ser uno de estos (sin signos, minúsculas, sin
   * tildes). Es lo que corresponde a un SALUDO.
   *
   * Con `keywords: ['hola']`, "Hola! ¿Tienen sucursales en CABA?" entraba por el
   * saludo —"hola" está adentro— y el cliente recibía el menú en vez de una
   * respuesta: la pregunta no llegaba ni al router ni al modelo. Un saludo sólo es
   * un saludo cuando el mensaje no dice nada más.
   */
  exact?: string[];
  /** Alcanza con que aparezcan DENTRO del mensaje ("sucursales", "devolución"). */
  keywords?: string[];
  /** Ids de botón/lista que entran directo a este start. */
  taps?: string[];
  /** El catch-all. Tiene que haber exactamente uno en el grafo. */
  fallback?: boolean;
};

// ─── Aristas ──────────────────────────────────────────────────────────────────

/**
 * Condición sobre el estado de la conversación, con el mismo vocabulario que
 * `ai_workflow.when`: un dot-path sobre `{ answers, vars }`.
 */
export type FlowCondition = {
  path: string;
  op: 'eq' | 'ne' | 'exists' | 'empty';
  value?: unknown;
};

export type FlowEdge = {
  id: string;
  source: string;
  target: string;
  /** Valor de la opción elegida, cuando `source` es un `ask_*`. */
  on?: string;
  /** Condición sobre el estado. Sin `on` ni `when`, la arista es incondicional. */
  when?: FlowCondition;
};

export type FlowGraph = {
  nodes: FlowNode[];
  edges: FlowEdge[];
};

export const EMPTY_GRAPH: FlowGraph = { nodes: [], edges: [] };

// ─── Límites de WhatsApp ──────────────────────────────────────────────────────

/**
 * Los mismos que ya codifica `send-whatsapp-text.ts`. Se repiten acá porque el
 * editor tiene que rechazarlos AL DIBUJAR: un botón de 24 caracteres que Meta
 * recorta se descubre en producción, con un cliente adelante.
 */
export const WA_LIMITS = {
  buttons: 3,
  buttonLabel: 20,
  listRows: 10,
  listButton: 20,
  rowTitle: 24,
  rowDescription: 72,
  body: 1024,
} as const;

// ─── Validación ───────────────────────────────────────────────────────────────

export type GraphIssue = { nodeId?: string; edgeId?: string; message: string };

const isBlank = (v: unknown): boolean => typeof v !== 'string' || v.trim() === '';

/**
 * Revisa el grafo ANTES de publicarlo. Devuelve todos los problemas, no el
 * primero: quien está dibujando quiere la lista completa, no arreglar de a uno y
 * volver a apretar publicar.
 *
 * No es una validación de tipos —eso lo hace TypeScript en el editor y Zod en la
 * ruta— sino de COHERENCIA: que el recorrido no tenga callejones sin salida, que
 * los textos entren en WhatsApp y que exista una puerta de entrada.
 */
export function validateGraph(graph: FlowGraph): GraphIssue[] {
  const issues: GraphIssue[] = [];
  const nodes = graph.nodes ?? [];
  const edges = graph.edges ?? [];

  const byId = new Map<string, FlowNode>();
  for (const node of nodes) {
    if (byId.has(node.id)) {
      issues.push({ nodeId: node.id, message: `Hay dos pasos con el mismo identificador ("${node.id}").` });
      continue;
    }
    byId.set(node.id, node);
  }

  // ── Entradas ────────────────────────────────────────────────────────────────
  const starts = nodes.filter((n) => n.type === 'start');
  if (starts.length === 0) {
    issues.push({ message: 'El recorrido no tiene ninguna Entrada: no hay por dónde empezar.' });
  }
  const fallbacks = starts.filter((n) => n.match?.fallback);
  if (starts.length > 0 && fallbacks.length === 0) {
    // Sin catch-all, un mensaje que no matchea deja al cliente sin respuesta — el
    // modo de falla que el bot NUNCA puede tener (ver el fallback anti-silencio
    // del webhook).
    issues.push({
      message:
        'Falta la Entrada que atiende lo inesperado. Si alguien escribe algo que ninguna Entrada reconoce, se queda sin respuesta: elegí una Entrada y prendé "Atender lo que no coincida con ninguna otra".',
    });
  }
  if (fallbacks.length > 1) {
    issues.push({
      message: `Hay ${fallbacks.length} Entradas marcadas para atender lo inesperado: sólo puede haber una.`,
    });
  }

  // ── Aristas ─────────────────────────────────────────────────────────────────
  const outgoing = new Map<string, FlowEdge[]>();
  for (const edge of edges) {
    if (!byId.has(edge.source)) {
      issues.push({ edgeId: edge.id, message: 'Hay una conexión que sale de un paso que ya no existe.' });
    }
    if (!byId.has(edge.target)) {
      issues.push({ edgeId: edge.id, message: 'Hay una conexión que lleva a un paso que ya no existe.' });
    }
    const list = outgoing.get(edge.source) ?? [];
    list.push(edge);
    outgoing.set(edge.source, list);
  }

  // ── Nodos, uno por uno ──────────────────────────────────────────────────────
  for (const node of nodes) {
    const out = outgoing.get(node.id) ?? [];

    // Una bifurcación con ramas declaradas reporta la suya, salida por salida, más
    // abajo. Sin esta excepción decía las dos cosas a la vez y la específica —cuál
    // de las ramas falta cablear— quedaba tapada por la genérica.
    const declara = node.type === 'condition' && (node.branches ?? []).length > 0;
    if (node.type !== 'end' && node.type !== 'handoff' && out.length === 0 && !declara) {
      issues.push({
        nodeId: node.id,
        message: `"${node.label ?? node.id}" no lleva a ningún lado: la conversación se corta ahí.`,
      });
    }

    if (
      (node.type === 'message' ||
        node.type === 'ask_buttons' ||
        node.type === 'ask_list' ||
        node.type === 'ask_text') &&
      isBlank(node.body)
    ) {
      issues.push({
        nodeId: node.id,
        message: `"${node.label ?? node.id}" no tiene texto: el cliente recibiría un mensaje vacío.`,
      });
    }
    if (typeof node.body === 'string' && node.body.length > WA_LIMITS.body) {
      issues.push({ nodeId: node.id, message: `El texto de "${node.label ?? node.id}" supera los ${WA_LIMITS.body} caracteres que acepta WhatsApp.` });
    }

    if (node.optionsFrom && node.type !== 'ask_buttons' && node.type !== 'ask_list') {
      issues.push({
        nodeId: node.id,
        message: `"${node.label ?? node.id}" espera respuestas en vivo, pero no es una pregunta con respuestas.`,
      });
    }

    if (node.type === 'ask_buttons' || node.type === 'ask_list') {
      const options = node.options ?? [];
      const max = node.type === 'ask_buttons' ? WA_LIMITS.buttons : WA_LIMITS.listRows;
      // Con `optionsFrom` la lista puede nacer vacía: las opciones llegan en vivo.
      if (options.length === 0 && !node.optionsFrom) {
        issues.push({
          nodeId: node.id,
          message: `"${node.label ?? node.id}" no tiene respuestas: WhatsApp no deja mandar una pregunta sin nada para elegir.`,
        });
      }
      /**
       * Lo que el cliente elija de la parte DINÁMICA no lo nombra ninguna arista,
       * así que sale por la incondicional. Sin ella el recorrido se corta justo
       * después de que el cliente eligió — y encima sólo para algunas respuestas,
       * que es la falla más difícil de ver.
       */
      if (node.optionsFrom && !out.some((e) => !e.on && !e.when)) {
        issues.push({
          nodeId: node.id,
          message: `"${node.label ?? node.id}" espera respuestas en vivo pero su salida "Otras respuestas" no lleva a ningún lado: lo que el cliente elija de esa lista se pierde.`,
        });
      }
      if (options.length > max) {
        issues.push({
          nodeId: node.id,
          message: `"${node.label ?? node.id}" tiene ${options.length} respuestas y WhatsApp acepta ${max}.`,
        });
      }
      const labelMax = node.type === 'ask_buttons' ? WA_LIMITS.buttonLabel : WA_LIMITS.rowTitle;
      for (const option of options) {
        if (isBlank(option.label)) {
          issues.push({
            nodeId: node.id,
            message: `Una respuesta de "${node.label ?? node.id}" no tiene texto: el cliente vería un botón en blanco.`,
          });
        } else if (option.label.length > labelMax) {
          issues.push({
            nodeId: node.id,
            message: `La respuesta "${option.label}" no entra: WhatsApp corta en ${labelMax} caracteres.`,
          });
        }
        if (option.description && option.description.length > WA_LIMITS.rowDescription) {
          issues.push({
            nodeId: node.id,
            message: `La descripción de "${option.label}" no entra: WhatsApp corta en ${WA_LIMITS.rowDescription} caracteres.`,
          });
        }
        // Una opción sin arista deja al cliente tocando un botón que no hace nada.
        if (!out.some((e) => e.on === option.value)) {
          issues.push({
            nodeId: node.id,
            message: `La respuesta "${option.label}" no lleva a ningún lado: el cliente la toca y no pasa nada.`,
          });
        }
      }
      if (node.type === 'ask_list' && node.listButton && node.listButton.length > WA_LIMITS.listButton) {
        issues.push({
          nodeId: node.id,
          message: `El botón que abre la lista de "${node.label ?? node.id}" no entra: WhatsApp corta en ${WA_LIMITS.listButton} caracteres.`,
        });
      }
    }

    /**
     * LA ESPERA CON PLAZO. Se valida entera acá porque las tres partes —el plazo,
     * la salida y el nombre reservado— sólo tienen sentido juntas: un plazo sin
     * salida cableada deja la conversación exactamente igual de colgada que sin
     * plazo, y encima con la promesa dibujada en el canvas de que no lo está.
     */
    if (node.timeout_seconds !== undefined) {
      if (!WAITING_NODE_TYPES.has(node.type)) {
        issues.push({
          nodeId: node.id,
          message: `"${node.label ?? node.id}" tiene un plazo de espera, pero no es un paso que espere una respuesta del cliente.`,
        });
      } else if (
        !Number.isInteger(node.timeout_seconds) ||
        node.timeout_seconds < FLOW_TIMEOUT_MIN_SECONDS ||
        node.timeout_seconds > FLOW_TIMEOUT_MAX_SECONDS
      ) {
        issues.push({
          nodeId: node.id,
          message: `La espera de "${node.label ?? node.id}" tiene que estar entre ${FLOW_TIMEOUT_MIN_SECONDS / 60} minuto y ${FLOW_TIMEOUT_MAX_SECONDS / 3600} horas.`,
        });
      } else if (!out.some((e) => e.on === FLOW_TIMEOUT_ON)) {
        issues.push({
          nodeId: node.id,
          message: `"${node.label ?? node.id}" espera un rato y después no sabe a dónde ir: conectá su salida "Si no contesta".`,
        });
      }
      if ((node.options ?? []).some((o) => o.value === FLOW_TIMEOUT_ON)) {
        issues.push({
          nodeId: node.id,
          message: `Una respuesta de "${node.label ?? node.id}" se llama "${FLOW_TIMEOUT_ON}", que es el nombre reservado de la salida "Si no contesta".`,
        });
      }
    } else if (out.some((e) => e.on === FLOW_TIMEOUT_ON)) {
      issues.push({
        nodeId: node.id,
        message: `"${node.label ?? node.id}" tiene una salida "Si no contesta" pero no tiene plazo de espera: nunca se va a tomar.`,
      });
    }

    if (node.type === 'action' && isBlank(node.tool)) {
      issues.push({ nodeId: node.id, message: `"${node.label ?? node.id}" no tiene elegida ninguna acción.` });
    }

    if (node.type === 'agent' && isBlank(node.agent_key)) {
      issues.push({ nodeId: node.id, message: `"${node.label ?? node.id}" no tiene elegido ningún agente: no habría quién conteste.` });
    }

    /**
     * Bifurcación con salidas DECLARADAS: se valida la lista del nodo, igual que
     * las opciones de un `ask_*`. Las aristas sólo la atan por `on`.
     */
    if (node.type === 'condition' && (node.branches ?? []).length > 0) {
      const branches = node.branches as FlowBranch[];
      const seen = new Set<string>();
      for (const branch of branches) {
        if (isBlank(branch.value)) {
          issues.push({ nodeId: node.id, message: `Una salida de "${node.label ?? node.id}" no tiene nombre.` });
          continue;
        }
        if (seen.has(branch.value)) {
          issues.push({ nodeId: node.id, message: `"${node.label ?? node.id}" tiene dos salidas llamadas "${branch.value}".` });
        }
        seen.add(branch.value);
        // Una rama declarada sin arista es un conector dibujado que no lleva a
        // ningún lado: el motor la elige y el recorrido se corta ahí.
        if (!out.some((e) => e.on === branch.value)) {
          issues.push({ nodeId: node.id, message: `La salida "${branch.label || branch.value}" de "${node.label ?? node.id}" no lleva a ningún lado.` });
        }
        if (branch.when && isBlank(branch.when.path)) {
          issues.push({ nodeId: node.id, message: `La condición de la salida "${branch.label || branch.value}" no dice qué mirar.` });
        }
      }
      const defaults = branches.filter((b) => !b.when);
      if (defaults.length > 1) {
        issues.push({
          nodeId: node.id,
          message: `"${node.label ?? node.id}" tiene ${defaults.length} salidas sin condición: sólo una puede ser la que se toma cuando no se cumple ninguna.`,
        });
      }
      for (const edge of out) {
        if (!edge.on) {
          issues.push({
            edgeId: edge.id,
            message: `Hay una conexión que sale de "${node.label ?? node.id}" sin corresponder a ninguna de sus salidas.`,
          });
        } else if (!seen.has(edge.on)) {
          issues.push({
            edgeId: edge.id,
            message: `Una conexión de "${node.label ?? node.id}" sale de "${edge.on}", que ya no es una de sus salidas.`,
          });
        }
      }
    } else if (out.length > 1) {
      /**
       * Bifurcación del formato VIEJO, sin ramas declaradas: las condiciones viven
       * en las aristas. Una sola salida es válida, tenga condición o no — puede ser
       * un desvío que a veces no se toma, y ahí el recorrido termina.
       *
       * Lo que NO es válido es que dos salidas no se distingan. El motor evalúa en
       * orden y toma la primera que aplica, así que la segunda no corre NUNCA.
       */
      const indistinguibles = out.filter((e) => !e.when && !e.on);
      if (indistinguibles.length > 1) {
        issues.push({
          nodeId: node.id,
          message: `"${node.label ?? node.id}" tiene ${indistinguibles.length} salidas sin condición: se toma siempre la primera y las otras no se recorren nunca.`,
        });
      }
    }
  }

  // ── Nodos inalcanzables ─────────────────────────────────────────────────────
  const reachable = new Set<string>();
  const queue = starts.map((n) => n.id);
  while (queue.length) {
    const id = queue.shift() as string;
    if (reachable.has(id)) continue;
    reachable.add(id);
    for (const edge of outgoing.get(id) ?? []) queue.push(edge.target);
  }
  for (const node of nodes) {
    if (!reachable.has(node.id)) {
      issues.push({
        nodeId: node.id,
        message: `A "${node.label ?? node.id}" no se llega desde ninguna Entrada: ninguna conversación va a pasar por ahí.`,
      });
    }
  }

  return issues;
}

// ─── Normalización ────────────────────────────────────────────────────────────

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v : undefined);

function normalizeOption(raw: unknown): FlowOption | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const value = str(o.value);
  if (!value) return null;
  return {
    value,
    label: str(o.label) ?? value,
    ...(str(o.description) ? { description: str(o.description) as string } : {}),
  };
}

function normalizeMatch(raw: unknown): FlowMatch | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const m = raw as Record<string, unknown>;
  const exact = Array.isArray(m.exact) ? m.exact.map(str).filter(Boolean) as string[] : [];
  const keywords = Array.isArray(m.keywords) ? m.keywords.map(str).filter(Boolean) as string[] : [];
  const taps = Array.isArray(m.taps) ? m.taps.map(str).filter(Boolean) as string[] : [];
  const out: FlowMatch = {};
  if (exact.length) out.exact = exact;
  if (keywords.length) out.keywords = keywords;
  if (taps.length) out.taps = taps;
  if (m.fallback === true) out.fallback = true;
  return Object.keys(out).length ? out : undefined;
}

const CONDITION_OPS = new Set(['eq', 'ne', 'exists', 'empty']);

function normalizeCondition(raw: unknown): FlowCondition | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const c = raw as Record<string, unknown>;
  const path = str(c.path);
  const op = str(c.op);
  if (!path || !op || !CONDITION_OPS.has(op)) return undefined;
  return { path, op: op as FlowCondition['op'], ...(c.value !== undefined ? { value: c.value } : {}) };
}

function normalizeBranch(raw: unknown): FlowBranch | null {
  if (!raw || typeof raw !== 'object') return null;
  const b = raw as Record<string, unknown>;
  const value = str(b.value);
  if (!value) return null;
  const when = normalizeCondition(b.when);
  return {
    value,
    label: str(b.label) ?? value,
    ...(when ? { when } : {}),
  };
}

/**
 * Convierte json de origen desconocido en un grafo usable, tirando lo que no
 * entiende en vez de fallar.
 *
 * Mismo contrato que `mergeAdvisorConfig`: el llamador nunca tiene que chequear
 * campos. Y la misma razón para no usar Zod acá — lo que llega del editor puede
 * ser de una versión anterior del formato, y rechazar el guardado entero por un
 * campo que sobra le haría perder el trabajo al operador. Los problemas REALES los
 * reporta `validateGraph`, que no borra nada.
 */
export function normalizeGraph(raw: unknown): FlowGraph {
  if (!raw || typeof raw !== 'object') return { nodes: [], edges: [] };
  const g = raw as Partial<{ nodes: unknown; edges: unknown }>;

  const types = new Set<string>(FLOW_NODE_TYPES);
  const nodes: FlowNode[] = (Array.isArray(g.nodes) ? g.nodes : [])
    .map((raw): FlowNode | null => {
      if (!raw || typeof raw !== 'object') return null;
      const n = raw as Record<string, unknown>;
      const id = str(n.id);
      const type = str(n.type);
      if (!id || !type || !types.has(type)) return null;

      const options = Array.isArray(n.options)
        ? (n.options.map(normalizeOption).filter(Boolean) as FlowOption[])
        : undefined;
      const branches = Array.isArray(n.branches)
        ? (n.branches.map(normalizeBranch).filter(Boolean) as FlowBranch[])
        : undefined;
      const position =
        n.position && typeof n.position === 'object'
          ? {
              x: Number((n.position as Record<string, unknown>).x) || 0,
              y: Number((n.position as Record<string, unknown>).y) || 0,
            }
          : undefined;

      return {
        id,
        type: type as FlowNodeType,
        ...(str(n.label) ? { label: str(n.label) as string } : {}),
        ...(typeof n.body === 'string' ? { body: n.body } : {}),
        ...(options?.length ? { options } : {}),
        ...(branches?.length ? { branches } : {}),
        ...(str(n.optionsFrom) ? { optionsFrom: str(n.optionsFrom) as string } : {}),
        ...(str(n.listButton) ? { listButton: str(n.listButton) as string } : {}),
        ...(Number.isFinite(Number(n.timeout_seconds)) && Number(n.timeout_seconds) > 0
          ? { timeout_seconds: Math.round(Number(n.timeout_seconds)) }
          : {}),
        ...(str(n.tool) ? { tool: str(n.tool) as string } : {}),
        ...(str(n.agent_key) ? { agent_key: str(n.agent_key) as string } : {}),
        ...(n.args && typeof n.args === 'object' ? { args: n.args as Record<string, unknown> } : {}),
        ...(n.silent === true ? { silent: true } : {}),
        ...(str(n.reason) ? { reason: str(n.reason) as string } : {}),
        ...(normalizeMatch(n.match) ? { match: normalizeMatch(n.match) as FlowMatch } : {}),
        ...(position ? { position } : {}),
      };
    })
    .filter(Boolean) as FlowNode[];

  const known = new Set(nodes.map((n) => n.id));
  const edges: FlowEdge[] = (Array.isArray(g.edges) ? g.edges : [])
    .map((raw): FlowEdge | null => {
      if (!raw || typeof raw !== 'object') return null;
      const e = raw as Record<string, unknown>;
      const id = str(e.id);
      const source = str(e.source);
      const target = str(e.target);
      if (!id || !source || !target) return null;
      // Una arista a un nodo borrado se descarta en silencio: el editor puede
      // haber sacado el nodo y no la arista, y guardarla dejaría el grafo con
      // referencias muertas que `validateGraph` reportaría para siempre.
      if (!known.has(source) || !known.has(target)) return null;
      const when = normalizeCondition(e.when);
      return {
        id,
        source,
        target,
        ...(str(e.on) !== undefined ? { on: e.on as string } : {}),
        ...(when ? { when } : {}),
      };
    })
    .filter(Boolean) as FlowEdge[];

  return { nodes, edges };
}
