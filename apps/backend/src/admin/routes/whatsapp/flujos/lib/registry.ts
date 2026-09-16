/**
 * QUÉ ES CADA PASO: su grupo en la biblioteca, su forma, lo que resume en la
 * tarjeta y —lo más importante— cuáles son sus SALIDAS.
 *
 * Existe para que agregar un tipo de paso sea tocar este archivo y no toda la
 * pantalla. Antes, el tipo se decidía con un `if (node.type === …)` repetido en el
 * canvas, en la paleta, en el inspector y en la proyección; sumar un tipo era
 * encontrar los cuatro, y olvidarse de uno no rompía el build: simplemente ese paso
 * se dibujaba mal.
 *
 * `outputsOf` es el corazón. Es UNA sola respuesta a "¿qué conectores tiene este
 * nodo?", y la usan tres lugares que TIENEN que coincidir: la tarjeta que los
 * dibuja, la proyección que engancha cada flecha a su conector (`handleOf`) y la
 * operación que ata el `on` al conectar (`declaredOutputValues` en `_editor.ts`).
 * Cuando no coinciden, React Flow descarta la arista EN SILENCIO —el error 008— y
 * el operador ve desaparecer una flecha que había dibujado bien.
 */

import {
  actionLabel,
  branchesOf,
  optionsOf,
  TYPE_LABEL,
  type GraphEdge,
  type GraphNode,
  type NodeType,
} from '../_editor';
import { FLOW_TIMEOUT_ON, type FlowCondition } from './graph-contract';

// ─── Forma y grupo ────────────────────────────────────────────────────────────

export type LibraryGroupKey = 'inicio' | 'mensajes' | 'logica' | 'acciones';

export const GROUP_LABEL: Record<LibraryGroupKey, string> = {
  inicio: 'Inicio',
  mensajes: 'Mensajes',
  logica: 'Lógica',
  acciones: 'Acciones',
};

export type NodeMeta = {
  group: LibraryGroupKey;
  /** Una línea en la biblioteca, para elegir sin tener que probar. */
  hint: string;
};

export const NODE_META: Record<NodeType, NodeMeta> = {
  start: {
    group: 'inicio',
    hint: 'Por dónde entra una conversación',
  },
  message: {
    group: 'mensajes',
    hint: 'Envía un texto y sigue',
  },
  ask_buttons: {
    group: 'mensajes',
    hint: 'Hasta 3 botones, y espera la respuesta',
  },
  ask_list: {
    group: 'mensajes',
    hint: 'Hasta 10 filas en una lista desplegable',
  },
  ask_text: {
    group: 'mensajes',
    hint: 'El cliente escribe la respuesta',
  },
  condition: {
    group: 'logica',
    hint: 'Separa el recorrido según lo que ya se sabe',
  },
  action: {
    group: 'acciones',
    hint: 'Busca, agrega al carrito, cobra…',
  },
  agent: {
    group: 'acciones',
    hint: 'Le pasa el turno a un agente del asistente',
  },
  handoff: {
    group: 'acciones',
    hint: 'Lo sigue atendiendo una persona',
  },
  end: {
    group: 'acciones',
    hint: 'Termina el recorrido',
  },
};

export type LibraryGroup = { key: LibraryGroupKey; label: string; types: NodeType[] };

/** El orden en que se ofrecen los pasos. Es el orden en que se arma un recorrido. */
export const LIBRARY_GROUPS: LibraryGroup[] = (
  ['inicio', 'mensajes', 'logica', 'acciones'] as LibraryGroupKey[]
).map((key) => ({
  key,
  label: GROUP_LABEL[key],
  types: (Object.keys(NODE_META) as NodeType[]).filter((t) => NODE_META[t].group === key),
}));

/** Minúsculas y sin tildes: nadie escribe "lógica" con tilde en un buscador. */
function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Los grupos que matchean la búsqueda. Un grupo que se queda sin pasos NO se
 * muestra vacío: un encabezado suelto se lee como "acá no hay nada que buscar".
 */
export function filterLibrary(query: string): LibraryGroup[] {
  const q = fold(query);
  if (!q) return LIBRARY_GROUPS;
  return LIBRARY_GROUPS.map((group) => ({
    ...group,
    types: group.types.filter(
      (t) =>
        fold(TYPE_LABEL[t]).includes(q) ||
        fold(NODE_META[t].hint).includes(q) ||
        fold(GROUP_LABEL[group.key]).includes(q),
    ),
  })).filter((group) => group.types.length > 0);
}

// ─── Salidas ──────────────────────────────────────────────────────────────────

/**
 * El id del conector que NO corresponde a una salida declarada.
 *
 * Tiene que ser un id explícito y no `undefined`: si una arista lleva
 * `sourceHandle: undefined` conviviendo con handles que sí tienen id, React Flow la
 * engancha al PRIMER conector del nodo — que es el de otra rama— y el dibujo miente.
 */
export const DEFAULT_HANDLE = 'out';

export type OutputKind = 'single' | 'option' | 'branch' | 'fallback' | 'legacy' | 'timeout';

export type NodeOutput = {
  id: string;
  label: string;
  kind: OutputKind;
  /** Ya tiene una flecha. Lo que NO la tiene es lo que el canvas ofrece cablear. */
  wired: boolean;
  /** Sólo en ramas: sin condición es la salida por default. */
  isDefaultBranch?: boolean;
};

/**
 * Los conectores de un nodo, en el orden en que se dibujan.
 *
 * `end` y `handoff` no tienen ninguno: los dos cortan el recorrido, y lo que se
 * dibuje después no lo recorre nadie.
 */
export function outputsOf(node: GraphNode, outgoing: readonly GraphEdge[]): NodeOutput[] {
  const wired = (value: string | undefined): boolean =>
    outgoing.some((e) => (e.on ?? undefined) === value);

  if (node.type === 'end' || node.type === 'handoff') return [];

  /**
   * ¿Este paso dibuja la salida "Si no contesta"?
   *
   * Alcanza con que TENGA la flecha aunque le hayan sacado el plazo: un conector
   * que desaparece deja a su flecha sin dónde engancharse y React Flow la borra del
   * dibujo sin decir nada. Dibujarla igual es lo que hace que el problema se vea —y
   * el validador ya lo nombra— en vez de que se pierda trabajo en silencio.
   */
  const conPlazo =
    Boolean(node.timeout_seconds) || outgoing.some((e) => e.on === FLOW_TIMEOUT_ON);

  /**
   * Las flechas que NO son la del plazo. Todo lo que cuenta "¿esta salida ya está
   * conectada?" las tiene que excluir: si no, cablear el vencimiento haría ver como
   * resuelta la salida normal, que es justo la que falta.
   */
  const normales = outgoing.filter((e) => e.on !== FLOW_TIMEOUT_ON);

  /** El vencimiento va SIEMPRE último: es la salida excepcional, no una respuesta. */
  const masPlazo = (outputs: NodeOutput[]): NodeOutput[] =>
    conPlazo
      ? [
          ...outputs,
          {
            id: FLOW_TIMEOUT_ON,
            label: 'Si no contesta',
            kind: 'timeout' as const,
            wired: wired(FLOW_TIMEOUT_ON),
          },
        ]
      : outputs;

  if (node.type === 'condition') {
    const branches = branchesOf(node);
    // Sin ramas declaradas es una bifurcación del formato VIEJO: las condiciones
    // viven en las aristas, así que tiene un conector solo y varias flechas.
    if (branches.length === 0) return [single(wired(undefined) || normales.length > 0)];
    return branches.map((b) => ({
      id: b.value,
      label: b.label || b.value,
      kind: 'branch' as const,
      wired: wired(b.value),
      isDefaultBranch: !b.when,
    }));
  }

  if (node.type === 'ask_buttons' || node.type === 'ask_list') {
    const options = optionsOf(node);
    const values = new Set(options.map((o) => o.value));
    const outputs: NodeOutput[] = options
      .filter((o) => o.value.trim() !== '')
      .map((o) => ({
        id: o.value,
        label: o.label || 'Opción sin texto',
        kind: 'option' as const,
        wired: wired(o.value),
      }));

    // Las flechas que NO salen de una opción: la de las opciones que llegan en vivo,
    // o una que quedó atada a una opción borrada. Las dos necesitan un conector
    // donde engancharse, o la flecha desaparece del canvas sin avisar.
    const sueltas = normales.filter((e) => !e.on || !values.has(e.on));

    if (node.optionsFrom) {
      outputs.push({
        id: DEFAULT_HANDLE,
        label: 'Otras respuestas (en vivo)',
        kind: 'fallback',
        wired: sueltas.length > 0,
      });
    } else if (sueltas.length > 0) {
      outputs.push({
        id: DEFAULT_HANDLE,
        label: 'Salida sin opción',
        kind: 'legacy',
        wired: true,
      });
    }

    return masPlazo(outputs);
  }

  // start, message, ask_text, action: una sola salida.
  return masPlazo([single(normales.length > 0)]);
}

const single = (wired: boolean): NodeOutput => ({
  id: DEFAULT_HANDLE,
  label: '',
  kind: 'single',
  wired,
});

/**
 * A qué conector se engancha una flecha.
 *
 * Nunca devuelve `undefined`: una arista con un `sourceHandle` que el nodo no
 * dibuja es una arista que React Flow descarta en silencio, y el operador ve
 * desaparecer una conexión que estaba bien guardada.
 */
export function handleOf(edge: GraphEdge, outputs: readonly NodeOutput[]): string {
  if (edge.on && outputs.some((o) => o.id === edge.on)) return edge.on;
  return DEFAULT_HANDLE;
}

// ─── Lo que dice la tarjeta ───────────────────────────────────────────────────

const OPERATOR_LABEL: Record<FlowCondition['op'], string> = {
  exists: 'tiene valor',
  empty: 'está vacío',
  eq: 'es igual a',
  ne: 'es distinto de',
};

/** Una condición en castellano, para el chip de la flecha y la fila de la rama. */
export function conditionLabel(when: FlowCondition | undefined): string {
  if (!when) return '';
  const op = OPERATOR_LABEL[when.op] ?? when.op;
  if (when.op === 'exists' || when.op === 'empty') return `${when.path} ${op}`;
  return `${when.path} ${op} ${when.value === undefined ? '' : String(when.value)}`.trim();
}

/**
 * El renglón que resume el paso dentro de la tarjeta.
 *
 * Es LO QUE HACÍA FALTA para poder leer el recorrido sin abrir bloque por bloque.
 * Antes la tarjeta decía "Mensaje" y el nombre interno, así que para saber qué le
 * llega al cliente había que seleccionar el nodo y mirar el inspector — con quince
 * pasos, quince clics.
 */
export function summaryOf(node: GraphNode): string {
  switch (node.type) {
    case 'message':
    case 'ask_buttons':
    case 'ask_list':
    case 'ask_text':
    case 'end':
      return (node.body ?? '').trim();

    case 'action': {
      const nombre = actionLabel(node.tool);
      if (!nombre) return '';
      // Los argumentos son la mitad de la información: "Buscar productos" no dice
      // nada, "Buscar productos · {{text}}" dice que busca lo que el cliente escribió.
      const args = Object.entries(node.args ?? {})
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .slice(0, 2)
        .map(([k, v]) => `${k}: ${resumirValor(v)}`);
      return args.length ? `${nombre} · ${args.join(' · ')}` : nombre;
    }

    case 'agent': {
      // Qué agente y de qué se ocupa: sin el recorte, la tarjeta no distingue dos
      // pasos de agente y hay que abrir cada uno para saber cuál es cuál.
      const quien = (node.agent_key ?? '').trim();
      const acota = (node.body ?? '').trim();
      if (!quien) return acota;
      return acota ? `${quien} · ${acota}` : quien;
    }

    case 'handoff':
      return (node.reason ?? '').trim();

    case 'start': {
      const partes: string[] = [];
      if (node.match?.exact?.length) partes.push(`Dice exactamente: ${node.match.exact.join(', ')}`);
      if (node.match?.keywords?.length) partes.push(`Menciona: ${node.match.keywords.join(', ')}`);
      if (node.match?.fallback) partes.push('Atiende lo que no matchea ningún otro inicio');
      return partes.join(' · ');
    }

    case 'condition': {
      const branches = branchesOf(node);
      if (branches.length === 0) return 'Las condiciones están en las flechas';
      return `${branches.length} salida${branches.length === 1 ? '' : 's'}`;
    }

    default:
      return '';
  }
}

function resumirValor(value: unknown): string {
  if (Array.isArray(value)) return `${value.length} elemento${value.length === 1 ? '' : 's'}`;
  if (typeof value === 'object' && value !== null) return '…';
  return String(value);
}
