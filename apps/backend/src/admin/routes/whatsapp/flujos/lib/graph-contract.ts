/**
 * La ÚNICA puerta del editor hacia el modelo del servidor.
 *
 * `src/lib/whatsapp/flow/graph.ts` no importa NADA —ni Medusa, ni node, ni un
 * paquete— y es el mismo archivo que corre en `POST /admin/whatsapp-flows`. Que el
 * canvas valide con esa función y no con una copia es lo que hace que lo que el
 * header marca como bloqueante sea exactamente lo que va a rechazar Publicar; una
 * copia driftea y el editor termina mintiendo en la dirección más cara (dejar
 * publicar algo roto, o bloquear algo sano). Ver `issues.ts` para la otra mitad:
 * los avisos que el editor ve y el servidor no puede ver.
 *
 * El cruce pasa por ACÁ y por ningún otro archivo: `boundary.test.ts` falla si
 * `graph.ts` gana un import o si otro archivo de `flujos/` se salta esta puerta.
 * El admin se empaqueta aparte del backend, así que un import descuidado hacia
 * `src/lib` puede arrastrar Medusa entero al bundle.
 */

export {
  FLOW_NODE_TYPES,
  BLOCKING_NODE_TYPES,
  WAITING_NODE_TYPES,
  FLOW_TIMEOUT_ON,
  FLOW_TIMEOUT_MIN_SECONDS,
  FLOW_TIMEOUT_MAX_SECONDS,
  WA_LIMITS,
  EMPTY_GRAPH,
  validateGraph,
  normalizeGraph,
} from '../../../../../lib/whatsapp/flow/graph';

export type {
  FlowNodeType,
  FlowOption,
  FlowBranch,
  FlowNode,
  FlowMatch,
  FlowCondition,
  FlowEdge,
  FlowGraph,
  GraphIssue,
} from '../../../../../lib/whatsapp/flow/graph';

/**
 * EL MOTOR, para el simulador.
 *
 * `engine.ts` es puro —sólo importa `./graph`— y es LITERALMENTE el que decide cada
 * turno en producción. El simulador lo corre en el navegador contra el grafo que hay
 * en el canvas: cada tap responde al instante, se prueba lo que se ve aunque todavía
 * no esté guardado, y no hay forma de que el simulador y el bot difieran, porque son
 * el mismo código.
 *
 * Lo que el simulador NO hace es ejecutar las tools: un `action` manda mensajes de
 * verdad, toca el carrito y puede escalar a una persona. Ahí el recorrido muestra
 * una tarjeta con lo que la acción habría hecho y sigue.
 */
export {
  advance,
  emptyState,
  readState,
  resolveNodeOptions,
  findEntry,
  flowTapId,
  parseFlowTapId,
  renderText,
  FLOW_TAP_PREFIX,
} from '../../../../../lib/whatsapp/flow/engine';

export type {
  FlowState,
  FlowInput,
  FlowStep,
  FlowPlan,
} from '../../../../../lib/whatsapp/flow/engine';

/**
 * EL RECORRIDO DE EJEMPLO.
 *
 * Es el que el bot atiende hoy, dibujado como grafo: una constante, sin una línea de
 * lógica. Del lado del cliente, "empezar desde el ejemplo" pasa a ser una operación
 * del canvas —entra en el historial y se deshace con Ctrl+Z— en vez de una llamada
 * que escribía en la base un recorrido que todavía nadie había mirado.
 */
export { SEED_GRAPH } from '../../../../../lib/whatsapp/flow/seed';
