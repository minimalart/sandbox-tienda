import type { WaEvent } from '../../../hooks/api/whatsapp-sessions';

/**
 * De la lista plana de eventos al diagrama vertical: quién produjo cada evento y
 * dónde corta una etapa.
 *
 * Vive aparte de la vista porque es la única parte con decisiones: el resto son
 * cajas y flechas. Y porque el corte tiene una trampa que no se ve mirando la
 * pantalla — `node_entered` lo emite SÓLO el motor de flujos visual
 * (`lib/whatsapp/flow/runtime.ts`). Las conversaciones que resuelve el asesor o el
 * router llegan con cero nodos, y el diagrama tiene que leerse igual.
 */

/** Quién produjo el evento. Es lo que le da color y dirección a la fila. */
export type FlowKind = 'cliente' | 'bot' | 'sistema' | 'alerta' | 'fallo';

const KIND: Record<string, FlowKind> = {
  // El cliente hizo algo.
  inbound: 'cliente',
  guided_answered: 'cliente',
  product_selected: 'cliente',
  added_to_cart: 'cliente',
  // El bot contestó.
  menu_shown: 'bot',
  products_shown: 'bot',
  checkout_generated: 'bot',
  guided_started: 'bot',
  guided_asked: 'bot',
  cart_reviewed: 'bot',
  order_status: 'bot',
  store_locations: 'bot',
  // Pasó por dentro, sin que ninguno de los dos lo vea.
  search: 'sistema',
  guided_relaxed: 'sistema',
  // No es un error, pero es donde se frenan los recorridos.
  no_results: 'alerta',
  handoff: 'alerta',
  paused_drop: 'alerta',
  // Se rompió.
  error: 'fallo',
  send_failed: 'fallo',
};

/**
 * Toma el evento entero y no sólo el tipo por las filas viejas mal tipadas: hasta
 * el fix de correlación, el bot PREGUNTANDO se guardaba como `guided_answered` con
 * `payload.asked` y sin `step`. `describeEvent` ya las lee como la pregunta que
 * eran; si acá miráramos sólo el tipo, la flecha diría "cliente" arriba de una
 * línea que dice "Preguntó surface". El event log no se migra.
 */
export function eventKind(event: WaEvent): FlowKind {
  if (event.type === 'guided_answered' && !event.step && event.payload?.asked) return 'bot';
  return KIND[event.type] ?? 'sistema';
}

/** Una caja del diagrama: el nodo del flujo y todo lo que pasó adentro. */
export type FlowStage = {
  /** `null` en el tramo anterior al primer nodo, o en las sesiones sin nodos. */
  node: string | null;
  /**
   * Qué número de paso mostrar. Cuenta SÓLO los nodos: el tramo previo no es "el
   * paso 1", y si se numerara por posición el primer nodo real saldría como 2.
   */
  step: number | null;
  /** Cuándo se entró al nodo. `null` cuando no hay nodo. */
  at: string | null;
  events: WaEvent[];
};

/**
 * Parte el recorrido en etapas. `node_entered` no es una fila: ES el encabezado de
 * la caja que abre. Una etapa sin eventos adentro se conserva — un nodo por el que
 * se pasó sin decir nada sigue siendo un paso del flujo, y esconderlo rompería la
 * cadena que hay que leer.
 */
export function buildStages(events: WaEvent[]): FlowStage[] {
  if (events.length === 0) return [];

  const stages: FlowStage[] = [{ node: null, step: null, at: null, events: [] }];
  let step = 0;
  for (const event of events) {
    if (event.type === 'node_entered') {
      stages.push({
        node: event.step ?? String(event.payload?.node_id ?? '—'),
        step: ++step,
        at: event.created_at,
        events: [],
      });
      continue;
    }
    stages[stages.length - 1].events.push(event);
  }

  // El tramo sin nodo sólo se dibuja si algo pasó antes del primer `node_entered`.
  return stages[0].events.length === 0 && stages.length > 1 ? stages.slice(1) : stages;
}

/** Cómo terminó el recorrido. Lo comparten el badge de la lista y el cierre del diagrama. */
export const OUTCOME: Record<
  string,
  { label: string; color: 'green' | 'orange' | 'red' | 'blue' | 'grey' }
> = {
  checkout: { label: 'Llegó al pago', color: 'green' },
  carrito: { label: 'Agregó al carrito', color: 'blue' },
  productos: { label: 'Vio productos', color: 'blue' },
  handoff: { label: 'Derivado a una persona', color: 'orange' },
  sin_resultados: { label: 'Sin resultados', color: 'orange' },
  error: { label: 'Con error', color: 'red' },
  abierta: { label: 'Sin avanzar', color: 'grey' },
};

export const time = (iso: string): string =>
  new Date(iso).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

export const hhmm = (iso: string): string =>
  new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
