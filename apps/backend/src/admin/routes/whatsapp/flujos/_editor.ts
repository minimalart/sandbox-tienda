/**
 * Las operaciones del canvas, sin React.
 *
 * Están acá y no dentro de `page.tsx` porque `src/admin` NO lo typechequea el CI y
 * no hay forma de probar un componente del admin: extraerlas es la única manera de
 * que "agregar un nodo no borra las conexiones" sea algo que un test afirme en vez
 * de algo que alguien recuerde probar a mano.
 *
 * REGLA QUE ORDENA TODO: `Graph` es la ÚNICA fuente de verdad. El estado de React
 * Flow es una proyección que se puede tirar y volver a calcular. Antes las
 * conexiones nuevas vivían sólo en el estado de React Flow, así que cualquier cosa
 * que repintara el canvas —agregar un nodo, editar un texto, cambiar el tema— las
 * borraba sin avisar.
 *
 * SEGUNDA REGLA: los tipos y la validación son los del SERVER, importados por
 * `lib/graph-contract.ts`. Ver ahí por qué el cruce de frontera vale la pena.
 */

import { midpoint, below, nudgeFree, type XY } from './lib/placement';
import {
  EMPTY_GRAPH,
  FLOW_NODE_TYPES,
  FLOW_TIMEOUT_ON,
  WA_LIMITS,
  type FlowBranch,
  type FlowCondition,
  type FlowEdge,
  type FlowGraph,
  type FlowNode,
  type FlowNodeType,
  type FlowOption,
} from './lib/graph-contract';

export const NODE_TYPES = FLOW_NODE_TYPES;

export type NodeType = FlowNodeType;

export const TYPE_LABEL: Record<NodeType, string> = {
  start: 'Entrada',
  message: 'Mensaje',
  ask_buttons: 'Pregunta (botones)',
  ask_list: 'Pregunta (lista)',
  ask_text: 'Pregunta abierta',
  condition: 'Bifurcación',
  action: 'Acción',
  agent: 'Agente',
  handoff: 'Derivar a una persona',
  end: 'Fin',
};

/** Los tipos que pueden tener MÁS de una salida. */
export const BRANCHING_TYPES: ReadonlySet<NodeType> = new Set([
  'condition',
  'ask_buttons',
  'ask_list',
  'start',
]);

/**
 * LOS TIPOS SON LOS DEL SERVER, no una copia.
 *
 * Eran una transcripción a mano de `lib/whatsapp/flow/graph.ts`, y le faltaban tres
 * campos que el motor SÍ lee: `silent` (la acción que no habla y deja seguir el
 * turno), `match.exact` (el saludo que compara el mensaje entero) y la
 * `description` de una fila de lista. El editor no podía ofrecerlos porque su
 * propio tipo decía que no existían, y cada lectura del grafo necesitaba un
 * `as unknown as Graph` que apagaba justamente el chequeo que los habría delatado.
 */
export type EditorCondition = FlowCondition;
export type EditorBranch = FlowBranch;
export type GraphNode = FlowNode;
export type GraphEdge = FlowEdge;
export type Graph = FlowGraph;

export { EMPTY_GRAPH };

// ─── Argumentos de una acción ─────────────────────────────────────────────────

/**
 * Qué campos pide cada acción, para poder configurarla desde el inspector.
 *
 * El nodo `action` guardaba `args` desde el principio pero el inspector NUNCA los
 * editó: sólo dejaba elegir la tool. Así, `wa_add_to_cart` no tenía cómo saber QUÉ
 * agregar y `wa_list_presentations` no tenía de qué producto listar — las dos
 * quedaban dibujables pero inservibles.
 *
 * La lista vive acá y no se deriva del `parameters` de cada tool porque el admin se
 * empaqueta aparte del backend: importar el módulo de tools desde `src/admin`
 * arrastraría Medusa entero al bundle. Son pocas y cambian poco.
 *
 * `kind` decide con qué se edita:
 *   text     → un input, admite `{{answers.<paso>}}` y `{{vars.<clave>}}`
 *   products → buscador de catálogo con foto, en el orden en que los ve el cliente
 *   variant  → un producto concreto elegido por su foto, o el que eligió el cliente
 */
export type ActionArgKind = 'text' | 'products' | 'variant';

export type ActionArgField = {
  name: string;
  label: string;
  kind: ActionArgKind;
  placeholder?: string;
  help?: string;
};

export const ACTION_ARGS: Record<string, ActionArgField[]> = {
  wa_search_products: [
    { name: 'query', label: 'Qué buscar', kind: 'text', placeholder: '{{text}}', help: 'Dejalo en {{text}} para buscar lo que el cliente escribió.' },
  ],
  wa_product_detail: [
    { name: 'variant_id', label: 'Producto a mostrar', kind: 'variant', placeholder: '{{vars.selected_variant}}' },
  ],
  wa_list_presentations: [
    { name: 'variant_id', label: 'Producto del que listar presentaciones', kind: 'variant', placeholder: '{{vars.selected_variant}}' },
    { name: 'save_as', label: 'Dónde dejar las opciones', kind: 'text', placeholder: 'presentations', help: 'La pregunta siguiente las lee con vars.<esta clave>.' },
  ],
  wa_list_pinned: [
    { name: 'product_ids', label: 'Productos', kind: 'products', help: 'El orden es el que ve el cliente. Los que no estén en el canal de venta del bot no se muestran.' },
    { name: 'save_as', label: 'Dónde dejar las opciones', kind: 'text', placeholder: 'pinned', help: 'La pregunta siguiente las lee con vars.<esta clave>.' },
  ],
  wa_add_to_cart: [
    { name: 'variant_id', label: 'Qué agregar', kind: 'variant', placeholder: '{{answers.elegir_producto}}' },
    { name: 'quantity', label: 'Cantidad', kind: 'text', placeholder: '1', help: 'Podés atarla a un paso: {{answers.cantidad}}.' },
  ],
  wa_set_quantity: [
    { name: 'variant_id', label: 'Qué producto', kind: 'variant', placeholder: '{{answers.elegir_producto}}' },
    { name: 'quantity', label: 'Nueva cantidad', kind: 'text', placeholder: '{{answers.cantidad}}', help: '0 lo saca del carrito.' },
  ],
};

export const argsOf = (tool: string | undefined): ActionArgField[] =>
  (tool && ACTION_ARGS[tool]) || [];

/**
 * Guarda un argumento. Un valor vacío BORRA la clave en vez de dejarla como cadena
 * vacía: las tools chequean `if (!variant_id)` para dar su propio error, y un `''`
 * guardado pasa ese chequeo como si el operador hubiera puesto algo.
 */
export function patchArg(graph: Graph, nodeId: string, name: string, value: unknown): Graph {
  const node = graph.nodes.find((n) => n.id === nodeId);
  if (!node) return graph;
  const next = { ...(node.args ?? {}) };
  const vacio =
    value === undefined ||
    value === null ||
    (typeof value === 'string' && value.trim() === '') ||
    (Array.isArray(value) && value.length === 0);
  if (vacio) delete next[name];
  else next[name] = value;
  return patchNode(graph, nodeId, { args: next });
}

// ─── Nombres ──────────────────────────────────────────────────────────────────

/**
 * Lo que se lee dentro del nodo: el tipo arriba y el nombre abajo.
 *
 * El nombre NO se pre-rellena con el tipo al crear el nodo. Si se hiciera —y se
 * hacía— la tarjeta decía "Entrada / Entrada", y el operador tenía que borrar un
 * texto que él no escribió para poder ponerle el suyo.
 */
export function nodeTitle(node: GraphNode): string {
  const name = (node.label ?? '').trim();
  return name ? `${TYPE_LABEL[node.type] ?? node.type}\n${name}` : TYPE_LABEL[node.type] ?? node.type;
}

// ─── Ids ──────────────────────────────────────────────────────────────────────

export function nextNodeId(graph: Graph, type: NodeType): string {
  const taken = new Set(graph.nodes.map((n) => n.id));
  for (let i = 1; ; i++) {
    const candidate = `${type}_${i}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/**
 * Id de arista.
 *
 * NO se usa el timestamp: dos conexiones dibujadas en el mismo milisegundo —que es
 * lo que pasa arrastrando rápido las dos ramas de una bifurcación— salían con el
 * mismo id y la segunda pisaba a la primera.
 */
export function nextEdgeId(graph: Graph): string {
  const taken = new Set(graph.edges.map((e) => e.id));
  for (let i = 1; ; i++) {
    const candidate = `e_${i}`;
    if (!taken.has(candidate)) return candidate;
  }
}

// ─── Operaciones ──────────────────────────────────────────────────────────────

/**
 * Agrega un paso.
 *
 * `position` es la del lugar donde el operador lo pidió: el centro de lo que está
 * mirando si lo agregó desde la biblioteca, el punto donde soltó si lo arrastró, el
 * medio de la flecha si lo insertó. Sin posición cae en la grilla, que es lo que
 * hacía siempre — y sigue siendo lo correcto cuando nadie señaló un lugar.
 */
export function addNode(graph: Graph, type: NodeType, position?: XY): { graph: Graph; id: string } {
  const id = nextNodeId(graph, type);
  const node: GraphNode = {
    id,
    type,
    // Sin `label`: lo pone el operador. Ver `nodeTitle`.
    position: position ?? nextPosition(graph.nodes.length),
    ...(type === 'ask_buttons' || type === 'ask_list' ? { options: [] } : {}),
    // Una bifurcación nace con UNA salida y no con cero: sin ninguna no tendría
    // conector y no habría forma de sacarle una flecha. La primera no lleva
    // condición — es la de por default — y de ahí se suman las que hagan falta.
    ...(type === 'condition' ? { branches: [{ value: 'salida_1', label: 'Salida 1' }] } : {}),
  };
  // Las aristas se mantienen intactas: agregar un paso no puede tocar el cableado.
  return { graph: { nodes: [...graph.nodes, node], edges: graph.edges }, id };
}

// ─── Salidas de una bifurcación ───────────────────────────────────────────────

/**
 * El `value` es un id ESTABLE y no el nombre: el operador renombra la salida en el
 * inspector y la arista, que la ata por `on`, tiene que seguir enganchada. Con el
 * nombre como clave, cambiarle una letra desconectaba la rama en silencio.
 */
function nextBranchValue(branches: EditorBranch[]): string {
  const taken = new Set(branches.map((b) => b.value));
  for (let i = 1; ; i++) {
    const candidate = `salida_${i}`;
    if (!taken.has(candidate)) return candidate;
  }
}

export function addBranch(graph: Graph, nodeId: string): Graph {
  const node = graph.nodes.find((n) => n.id === nodeId);
  if (!node || node.type !== 'condition') return graph;
  const branches = node.branches ?? [];
  const value = nextBranchValue(branches);
  return patchNode(graph, nodeId, {
    branches: [...branches, { value, label: `Salida ${branches.length + 1}` }],
  });
}

export function patchBranch(graph: Graph, nodeId: string, value: string, patch: Partial<EditorBranch>): Graph {
  const node = graph.nodes.find((n) => n.id === nodeId);
  if (!node) return graph;
  return patchNode(graph, nodeId, {
    branches: (node.branches ?? []).map((b) => {
      if (b.value !== value) return b;
      const next = { ...b, ...patch };
      // Una condición sin `path` no dice qué mirar: se BORRA en vez de guardarse a
      // medias, y la rama vuelve a ser la de por default. Es el mismo criterio que
      // `patchEdge` con el `when` de la arista.
      if (next.when && !next.when.path) delete next.when;
      return next;
    }),
  });
}

/**
 * Saca una salida y, con ella, la arista que la ataba.
 *
 * Dejar la arista huérfana la convertiría en una flecha con un `on` que ya no
 * corresponde a ninguna rama: el motor nunca la tomaría y `validateGraph` la
 * reportaría para siempre.
 */
export function removeBranch(graph: Graph, nodeId: string, value: string): Graph {
  const node = graph.nodes.find((n) => n.id === nodeId);
  if (!node) return graph;
  const withoutBranch = patchNode(graph, nodeId, {
    branches: (node.branches ?? []).filter((b) => b.value !== value),
  });
  return {
    nodes: withoutBranch.nodes,
    edges: withoutBranch.edges.filter((e) => !(e.source === nodeId && e.on === value)),
  };
}

/** Las salidas declaradas de un nodo. Vacío en todo lo que no sea una bifurcación. */
export function branchesOf(node: GraphNode | null | undefined): EditorBranch[] {
  if (!node || node.type !== 'condition') return [];
  return node.branches ?? [];
}

// ─── Opciones de una pregunta ─────────────────────────────────────────────────

/** Las opciones DIBUJADAS de un `ask_buttons` / `ask_list`. Vacío en todo lo demás. */
export function optionsOf(node: GraphNode | null | undefined): FlowOption[] {
  if (!node || (node.type !== 'ask_buttons' && node.type !== 'ask_list')) return [];
  return node.options ?? [];
}

/**
 * Los valores por los que un nodo puede sacar una flecha DISTINGUIBLE: las ramas de
 * una bifurcación o las opciones de una pregunta.
 *
 * Es una sola función y no dos porque es la regla que tiene que coincidir en tres
 * lugares: el conector que dibuja la tarjeta, el `on` que le pone `connect` a la
 * flecha nueva, y el `sourceHandle` con el que se reengancha al repintar. Cuando
 * cada uno decidía por su cuenta, una flecha podía nacer atada a una opción que el
 * canvas no dibujaba y desaparecía en el próximo repintado.
 */
export function declaredOutputValues(node: GraphNode | null | undefined): string[] {
  if (!node) return [];
  /**
   * La salida del plazo es una salida DECLARADA como cualquier otra. Sin esto, la
   * flecha arrastrada desde "Si no contesta" nacería sin `on` y el motor la tomaría
   * como la salida normal del paso: el recorrido seguiría por ahí cuando el cliente
   * contesta, y el vencimiento no llevaría a ningún lado.
   */
  const plazo = node.timeout_seconds ? [FLOW_TIMEOUT_ON] : [];
  if (node.type === 'condition') return [...branchesOf(node).map((b) => b.value), ...plazo];
  return [
    ...optionsOf(node)
      .map((o) => o.value)
      .filter((v) => v.trim() !== ''),
    ...plazo,
  ];
}

/**
 * El `value` de una opción es un id ESTABLE generado acá, igual que el de una rama.
 *
 * Antes lo escribía el operador en un input llamado "valor", al lado de otro llamado
 * "lo que ve el cliente". Dos campos para una sola idea, y el primero era un id
 * interno disfrazado de dato: dejarlo vacío rompía la arista, y cambiarlo después
 * de cablear la despegaba en silencio. Ahora se escribe UNA cosa —la etiqueta— y el
 * id lo pone el editor.
 */
function nextOptionValue(options: FlowOption[]): string {
  const taken = new Set(options.map((o) => o.value));
  for (let i = 1; ; i++) {
    const candidate = `opcion_${i}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** Suma una opción, respetando el tope de WhatsApp para el tipo de pregunta. */
export function addOption(graph: Graph, nodeId: string): Graph {
  const node = graph.nodes.find((n) => n.id === nodeId);
  if (!node || (node.type !== 'ask_buttons' && node.type !== 'ask_list')) return graph;
  const options = node.options ?? [];
  // Se corta ACÁ y no al guardar: una cuarta opción en un paso de botones no la va
  // a mostrar WhatsApp, y descubrirlo al publicar es rehacer la rama.
  if (options.length >= maxOptions(node.type)) return graph;
  return patchNode(graph, nodeId, {
    options: [...options, { value: nextOptionValue(options), label: '' }],
  });
}

/**
 * Edita una opción. Si le cambia el `value` —que hoy no hace la UI, pero puede
 * venir de un grafo importado— ARRASTRA su arista, para no despegarla en silencio.
 */
export function patchOption(
  graph: Graph,
  nodeId: string,
  value: string,
  patch: Partial<FlowOption>,
): Graph {
  const node = graph.nodes.find((n) => n.id === nodeId);
  if (!node) return graph;
  const next = patchNode(graph, nodeId, {
    options: optionsOf(node).map((o) => (o.value === value ? { ...o, ...patch } : o)),
  });
  const nuevoValor = patch.value;
  if (!nuevoValor || nuevoValor === value) return next;
  return {
    nodes: next.nodes,
    edges: next.edges.map((e) =>
      e.source === nodeId && e.on === value ? { ...e, on: nuevoValor } : e,
    ),
  };
}

/**
 * Saca una opción y, con ella, su arista.
 *
 * Dejarla huérfana la convertiría en una flecha con un `on` que ya no corresponde a
 * ninguna opción: el motor no la tomaría nunca y `validateGraph` la reportaría para
 * siempre. Es el mismo criterio que `removeBranch`.
 */
export function removeOption(graph: Graph, nodeId: string, value: string): Graph {
  const node = graph.nodes.find((n) => n.id === nodeId);
  if (!node) return graph;
  const sinOpcion = patchNode(graph, nodeId, {
    options: optionsOf(node).filter((o) => o.value !== value),
  });
  return {
    nodes: sinOpcion.nodes,
    edges: sinOpcion.edges.filter((e) => !(e.source === nodeId && e.on === value)),
  };
}

export function patchNode(graph: Graph, id: string, patch: Partial<GraphNode>): Graph {
  return {
    nodes: graph.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
    edges: graph.edges,
  };
}

export function removeNode(graph: Graph, id: string): Graph {
  return {
    nodes: graph.nodes.filter((n) => n.id !== id),
    // Las aristas que colgaban del nodo se van con él: dejarlas sería guardar
    // referencias muertas que `validateGraph` reportaría para siempre.
    edges: graph.edges.filter((e) => e.source !== id && e.target !== id),
  };
}

export type ConnectInput = {
  source?: string | null;
  target?: string | null;
  /** El conector del que se arrastró. En una bifurcación es el `value` de la rama. */
  sourceHandle?: string | null;
};

/**
 * Conecta dos nodos. Devuelve el grafo igual si la conexión no es válida.
 *
 * Se permiten VARIAS salidas del mismo nodo —una bifurcación sin dos ramas no
 * bifurca nada— y la arista queda ATADA a la salida de la que se arrastró: el
 * conector del que sale ES la rama o la opción, así que el `on` sale de ahí y no
 * hay que ir después a la arista a decirle cuál era.
 *
 * ESO AHORA VALE TAMBIÉN PARA LAS PREGUNTAS. Antes sólo la bifurcación tenía un
 * conector por salida; un `ask_buttons` con tres opciones tenía UNO solo, las tres
 * flechas nacían del mismo punto sin `on`, y había que tocar cada una y elegir a
 * qué opción correspondía en un desplegable. Nada en el canvas decía cuál era cuál,
 * y una opción sin cablear se descubría recién al publicar.
 *
 * La unicidad es por (origen, salida, destino) y no por (origen, destino): dos
 * salidas distintas pueden terminar en el mismo paso —"Sí" y "No" cayendo las dos
 * en el cierre es un recorrido normal— y la regla vieja rechazaba la segunda sin
 * decir nada.
 */
export function connect(graph: Graph, connection: ConnectInput): Graph {
  const { source, target } = connection;
  if (!source || !target) return graph;
  // Un nodo conectado a sí mismo es un ciclo que el motor corta por el tope de
  // saltos, y en el canvas se ve como un rulo que no dice nada.
  if (source === target) return graph;

  const node = graph.nodes.find((n) => n.id === source);
  const handle = connection.sourceHandle ?? undefined;
  // Sólo se toma como salida si el conector corresponde a una DECLARADA: un id de
  // handle de React Flow que no sea una rama ni una opción —el conector por
  // default, o el de las opciones que llegan en vivo— no puede terminar como `on`.
  const on = handle && declaredOutputValues(node).includes(handle) ? handle : undefined;

  if (graph.edges.some((e) => e.source === source && e.target === target && e.on === on)) return graph;
  // Una rama ya cableada no acepta una segunda flecha: el motor toma una sola y la
  // otra no se recorrería nunca.
  if (on !== undefined && graph.edges.some((e) => e.source === source && e.on === on)) return graph;

  return {
    nodes: graph.nodes,
    edges: [...graph.edges, { id: nextEdgeId(graph), source, target, ...(on ? { on } : {}) }],
  };
}

export function patchEdge(graph: Graph, id: string, patch: Partial<GraphEdge>): Graph {
  return {
    nodes: graph.nodes,
    edges: graph.edges.map((e) => {
      if (e.id !== id) return e;
      const next = { ...e, ...patch };
      // Un `on` vacío se BORRA en vez de guardarse como cadena vacía: el motor
      // compara contra el valor de la opción, y `on: ''` no matchea ninguna pero
      // tampoco deja pasar la arista como incondicional.
      if (next.on !== undefined && String(next.on).trim() === '') delete next.on;
      if (next.when && !next.when.path) delete next.when;
      return next;
    }),
  };
}

export function removeEdge(graph: Graph, id: string): Graph {
  return { nodes: graph.nodes, edges: graph.edges.filter((e) => e.id !== id) };
}

/** Vuelca al grafo las posiciones que el operador movió en el canvas. */
export function applyPositions(
  graph: Graph,
  positions: Array<{ id: string; position: { x: number; y: number } }>,
): Graph {
  const byId = new Map(positions.map((p) => [p.id, p.position]));
  return {
    nodes: graph.nodes.map((n) => ({ ...n, position: byId.get(n.id) ?? n.position })),
    edges: graph.edges,
  };
}

// ─── Ayudas para el inspector ─────────────────────────────────────────────────

/**
 * Qué falta para que las salidas de un nodo sean distinguibles.
 *
 * Es el aviso que faltaba en la bifurcación: dos aristas sin condición salen del
 * mismo nodo y el motor toma siempre la primera, así que la segunda rama nunca
 * corre — sin que nada lo diga.
 */
export function outgoingProblems(graph: Graph, nodeId: string): string[] {
  const node = graph.nodes.find((n) => n.id === nodeId);
  if (!node) return [];
  const out = graph.edges.filter((e) => e.source === nodeId);

  const problems: string[] = [];

  // Bifurcación con salidas DECLARADAS: se mira la lista del nodo, no las aristas.
  // Y se mira con UNA sola salida, porque el problema más común —la salida sin
  // cablear— aparece justo ahí, cuando todavía no hay dos aristas que comparar.
  const branches = branchesOf(node);
  if (branches.length > 0) {
    const defaults = branches.filter((b) => !b.when);
    if (defaults.length > 1) {
      problems.push(
        `Hay ${defaults.length} salidas sin condición: sólo una puede ser la de por default. Poné condición en las otras.`,
      );
    }
    if (defaults.length === 0) {
      problems.push('Ninguna salida es la de por default: si no se cumple ninguna condición, el recorrido se corta acá.');
    }
    const sinCablear = branches.filter((b) => !out.some((e) => e.on === b.value));
    if (sinCablear.length > 0) {
      problems.push(
        `${sinCablear.length === 1 ? 'La salida' : 'Las salidas'} "${sinCablear.map((b) => b.label || b.value).join('", "')}" ${sinCablear.length === 1 ? 'no lleva' : 'no llevan'} a ningún lado: arrastrá una flecha desde su conector.`,
      );
    }
    return problems;
  }

  /**
   * Los avisos de una PREGUNTA se miran siempre, no sólo con dos flechas.
   *
   * La regla vieja (`out.length < 2`) venía de cuando el problema era "dos salidas
   * que no se distinguen". Con un conector por opción el problema típico es otro y
   * aparece con UNA sola flecha: una opción sin etiqueta, dos con el mismo texto, o
   * una flecha atada a una opción que ya no existe. Callarse hasta la segunda
   * flecha era callarse justo cuando todavía se podía arreglar barato.
   */
  if (node.type === 'ask_buttons' || node.type === 'ask_list') {
    const options = optionsOf(node);
    const values = new Set(options.map((o) => o.value));

    const vistas = new Set<string>();
    for (const option of options) {
      const etiqueta = (option.label ?? '').trim();
      if (!etiqueta) {
        problems.push('Hay una opción sin texto: el cliente vería un botón en blanco.');
        continue;
      }
      if (vistas.has(etiqueta.toLowerCase())) {
        problems.push(
          `Hay dos opciones que dicen "${etiqueta}": el cliente no puede saber cuál es cuál.`,
        );
      }
      vistas.add(etiqueta.toLowerCase());
    }

    for (const edge of out) {
      if (!edge.on) {
        // Sin `on` la flecha es la salida de lo que llega EN VIVO. Con opciones
        // dinámicas es obligatoria; sin ellas, es una flecha que no sale de ninguna
        // opción y el motor la toma para cualquier respuesta.
        if (!node.optionsFrom) {
          problems.push(
            'Hay una flecha que no sale de ninguna opción: se toma para cualquier respuesta.',
          );
        }
        continue;
      }
      if (!values.has(edge.on)) {
        problems.push(`La salida "${edge.on}" ya no corresponde a ninguna opción de este paso.`);
      }
    }

    return problems;
  }

  if (out.length < 2) return [];

  // Bifurcación del formato VIEJO, con las condiciones en las aristas.
  if (node.type === 'condition') {
    const plain = out.filter((e) => !e.when && !e.on);
    if (plain.length > 1) {
      problems.push(
        `Hay ${plain.length} salidas sin condición: el recorrido va a tomar siempre la primera. Poné una condición en todas menos una, que queda como la salida por default.`,
      );
    }
    if (plain.length === 0) {
      problems.push('Ninguna salida es la de por default: si no se cumple ninguna condición, el recorrido se corta.');
    }
  }


  return problems;
}

// ─── Forma del nodo en el canvas ──────────────────────────────────────────────

/**
 * Qué conectores tiene cada tipo, en el vocabulario de React Flow:
 * `input` sólo saca, `output` sólo recibe, `default` las dos.
 *
 * No es cosmético. Con conectores en los dos lados de todo, el canvas deja
 * dibujar recorridos que el motor NUNCA va a correr —una salida desde un `end`,
 * una flecha que entra a la `start`— y nada se lo dice al operador: el grafo se
 * guarda, se publica y esa rama simplemente no pasa.
 */
export function canvasKind(type: NodeType): 'input' | 'output' | 'default' {
  if (type === 'start') return 'input';
  // `end` y `handoff` cortan el recorrido: lo que se dibuje después no corre.
  if (type === 'end' || type === 'handoff') return 'output';
  return 'default';
}

/**
 * Cuántas opciones acepta WhatsApp en este tipo de pregunta. `0` = no aplica.
 *
 * Los números salen de `WA_LIMITS` y no se escriben acá: son los mismos que valida
 * el server y los mismos que codifica el envío. Tres copias del "3" es una de más.
 */
export function maxOptions(type: NodeType): number {
  if (type === 'ask_buttons') return WA_LIMITS.buttons;
  if (type === 'ask_list') return WA_LIMITS.listRows;
  return 0;
}

/**
 * Dónde cae un nodo nuevo.
 *
 * En COLUMNA se iban de la pantalla: con seis pasos ya había nodos abajo del
 * borde y otros tapados por la paleta, imposibles de tocar. En grilla de a tres
 * el canvas crece parejo y `fitView` los alcanza.
 */
export function nextPosition(count: number): { x: number; y: number } {
  const perRow = 3;
  return { x: 60 + (count % perRow) * 260, y: 60 + Math.floor(count / perRow) * 150 };
}

// ─── Qué se puede poner dónde ─────────────────────────────────────────────────

/**
 * Los tipos que se pueden meter EN EL MEDIO de una flecha: tienen que recibir y
 * sacar. Un "Fin" insertado entre dos pasos cortaría el recorrido y dejaría el
 * segundo colgado; una "Entrada" no recibe nada y la flecha entrante moriría ahí.
 */
export const INSERTABLE_TYPES: readonly NodeType[] = NODE_TYPES.filter(
  (t) => canvasKind(t) === 'default',
);

/** Los tipos que se pueden colgar de un conector: cualquiera que reciba. */
export const CONNECTABLE_TARGET_TYPES: readonly NodeType[] = NODE_TYPES.filter(
  (t) => canvasKind(t) !== 'input',
);

// ─── Las acciones que puede ejecutar un paso ──────────────────────────────────

/**
 * Las tools que un nodo `action` puede ejecutar, con el nombre que ve el operador.
 *
 * La lista vive acá y no se deriva del `parameters` de cada tool porque el admin se
 * empaqueta aparte del backend: importar el módulo de tools desde `src/admin`
 * arrastraría Medusa entero al bundle. Son pocas y cambian poco.
 */
export const ACTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'wa_search_products', label: 'Buscar productos' },
  { value: 'wa_guided_start', label: 'Asesor guiado' },
  { value: 'wa_product_detail', label: 'Mostrar un producto' },
  { value: 'wa_list_presentations', label: 'Buscar las presentaciones de un producto' },
  { value: 'wa_list_pinned', label: 'Mostrar productos elegidos a mano' },
  { value: 'wa_add_to_cart', label: 'Agregar al carrito' },
  { value: 'wa_set_quantity', label: 'Cambiar la cantidad' },
  { value: 'wa_view_cart', label: 'Ver el carrito' },
  { value: 'wa_review_order', label: 'Revisar el pedido' },
  { value: 'wa_checkout_link', label: 'Link de pago' },
  { value: 'wa_clear_cart', label: 'Vaciar el carrito' },
  { value: 'wa_start_return', label: 'Iniciar devolución' },
];

/** El nombre que ve el operador, o el id crudo si es una tool que no está en la lista. */
export const actionLabel = (tool: string | undefined): string =>
  (tool && ACTIONS.find((a) => a.value === tool)?.label) || tool || '';

// ─── Insertar, duplicar y colgar ──────────────────────────────────────────────

/**
 * Mete un paso NUEVO en el medio de una flecha: `A → B` pasa a `A → NUEVO → B`.
 *
 * Es el cambio que más baja la fricción para alguien que no es técnico: agregar un
 * mensaje entre dos pasos era agregar el nodo suelto, borrar la flecha vieja y
 * dibujar dos nuevas, acordándose de volver a atar la primera a la opción que tenía.
 *
 * LA ARISTA ENTRANTE SE CONSERVA, no se borra y se rehace: mantiene su `id`, su
 * `on` y su `when`, y sólo cambia de destino. Rehacerla perdía la opción a la que
 * estaba atada —el operador insertaba un mensaje y la rama dejaba de funcionar— y
 * encima le cambiaba el id, que es lo que la traza usa para contar por dónde pasó
 * cada conversación.
 */
export function insertBetween(
  graph: Graph,
  edgeId: string,
  type: NodeType,
): { graph: Graph; id: string | null } {
  const edge = graph.edges.find((e) => e.id === edgeId);
  if (!edge) return { graph, id: null };
  // Un "Fin" o un "Derivar" en el medio cortan el recorrido y dejan a B inalcanzable;
  // una "Entrada" no recibe la flecha que le llega.
  if (canvasKind(type) !== 'default') return { graph, id: null };

  const source = graph.nodes.find((n) => n.id === edge.source);
  const target = graph.nodes.find((n) => n.id === edge.target);
  const position = nudgeFree(
    midpoint(source?.position ?? { x: 0, y: 0 }, target?.position ?? { x: 0, y: 160 }),
    graph.nodes.map((n) => n.position),
  );

  const { graph: conNodo, id } = addNode(graph, type, position);

  // La salida del nodo nuevo hacia B. Una bifurcación nace con una rama declarada,
  // así que su flecha tiene que salir atada a ella o el motor no la recorre.
  const nuevo = conNodo.nodes.find((n) => n.id === id);
  const primeraSalida = declaredOutputValues(nuevo)[0];

  return {
    graph: {
      nodes: conNodo.nodes,
      edges: [
        ...conNodo.edges.map((e) => (e.id === edgeId ? { ...e, target: id } : e)),
        {
          id: nextEdgeId(conNodo),
          source: id,
          target: edge.target,
          ...(primeraSalida ? { on: primeraSalida } : {}),
        },
      ],
    },
    id,
  };
}

/**
 * Copia un paso con todo su contenido, al lado del original y SIN sus flechas.
 *
 * Sin flechas a propósito: duplicar un paso es querer una variante, y arrastrar las
 * conexiones del original dejaría dos flechas saliendo de la misma opción —que el
 * motor no puede desambiguar— o dos pasos escuchando la misma entrada.
 */
export function duplicateNode(graph: Graph, id: string): { graph: Graph; id: string | null } {
  const node = graph.nodes.find((n) => n.id === id);
  if (!node) return { graph, id: null };

  const nuevoId = nextNodeId(graph, node.type);
  const copia: GraphNode = {
    ...node,
    id: nuevoId,
    ...(node.label ? { label: `${node.label} (copia)` } : {}),
    // Copias por valor: con el mismo array, editar una opción de la copia editaba
    // también la del original.
    ...(node.options ? { options: node.options.map((o) => ({ ...o })) } : {}),
    ...(node.branches ? { branches: node.branches.map((b) => ({ ...b })) } : {}),
    ...(node.args ? { args: { ...node.args } } : {}),
    ...(node.match ? { match: { ...node.match } } : {}),
    position: nudgeFree(
      { x: (node.position?.x ?? 0) + 40, y: (node.position?.y ?? 0) + 40 },
      graph.nodes.map((n) => n.position),
    ),
  };

  // Una entrada duplicada NO se lleva el catch-all: tiene que haber exactamente uno
  // en el grafo, así que copiarlo dejaría el recorrido impublicable de entrada.
  if (copia.type === 'start' && copia.match?.fallback) {
    const sinFallback = { ...copia.match };
    delete sinFallback.fallback;
    if (Object.keys(sinFallback).length) copia.match = sinFallback;
    else delete copia.match;
  }

  return { graph: { nodes: [...graph.nodes, copia], edges: graph.edges }, id: nuevoId };
}

/**
 * Crea un paso y lo cuelga de un conector suelto, en un solo gesto.
 *
 * Es el "+" que aparece bajo una salida sin cablear. Sin esto, cablear una opción
 * son tres movimientos —agregar el paso, encontrarlo en el canvas, arrastrar la
 * flecha desde el conector correcto— y el del medio se vuelve imposible apenas el
 * recorrido tiene más de una pantalla de alto.
 */
export function addAndConnect(
  graph: Graph,
  sourceId: string,
  sourceHandle: string | null | undefined,
  type: NodeType,
): { graph: Graph; id: string | null } {
  const source = graph.nodes.find((n) => n.id === sourceId);
  if (!source) return { graph, id: null };
  // Una entrada no recibe flechas: colgarla de un conector sería dibujar algo que
  // el motor nunca recorre.
  if (canvasKind(type) === 'input') return { graph, id: null };

  const position = nudgeFree(
    below(source.position ?? { x: 0, y: 0 }),
    graph.nodes.map((n) => n.position),
  );
  const { graph: conNodo, id } = addNode(graph, type, position);
  const conectado = connect(conNodo, { source: sourceId, target: id, sourceHandle });
  // Si la conexión no era válida —la salida ya estaba cableada— el paso igual queda:
  // borrarlo dejaría al operador sin saber qué pasó con su clic.
  return { graph: conectado, id };
}
