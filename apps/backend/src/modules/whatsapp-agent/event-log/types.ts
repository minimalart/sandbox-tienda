export const WHATSAPP_EVENT_LOG_MODULE = 'whatsappEventLog';

/**
 * Eventos del embudo comercial de WhatsApp. Cubren el recorrido del PRD §27:
 *
 *   conversación → búsqueda → productos mostrados → producto agregado
 *   → carrito revisado → checkout generado → pedido
 *
 * Se guardan como TEXT (no enum de Postgres) para que sumar un evento sea sólo un
 * cambio de TypeScript, sin migrar el tipo — mismo criterio que `erp_sync_log` y
 * `typesense_sync_log`.
 */
export const WA_EVENT_TYPES = [
  /** Mensaje entrante del cliente (texto o selección). */
  'inbound',
  /** Se mostró el menú inicial. */
  'menu_shown',
  /** Búsqueda ejecutada; `payload.query`. */
  'search',
  /** La búsqueda o el filtrado no devolvió nada; `payload.query` / `payload.filters`. */
  'no_results',
  /** Se ofrecieron productos; `payload.count`, `payload.variant_ids`. */
  'products_shown',
  /** El cliente tocó una variante de la lista/carrusel; `payload.variant_id`. */
  'product_selected',
  /** Se agregó al borrador; `payload.variant_id`, `payload.quantity`. */
  'added_to_cart',
  'quantity_changed',
  'removed_from_cart',
  'cart_cleared',
  /** Se mostró el detalle del pedido antes de pagar; `payload.items`, `payload.subtotal`. */
  'cart_reviewed',
  /** Se generó el link de pago; `payload.token`. */
  'checkout_generated',
  /**
   * El link de pago NO se generó a propósito; `payload.reason` dice por qué
   * (`minimum_purchase`), más `subtotal`, `minimum` y `missing`.
   *
   * No es un `error`: el bot hizo lo correcto. Pero tampoco puede quedar como un
   * embudo que muere en `cart_reviewed` sin explicación — ese hueco es justo el
   * que hay que poder medir, porque dice cuántas ventas se pierden contra el
   * mínimo y por cuánta plata.
   */
  'checkout_blocked',
  /** Arrancó el asesor guiado. */
  'guided_started',
  /**
   * El bot PREGUNTÓ la dimensión siguiente; `step` = dimensión,
   * `payload.remaining` = cuántos productos quedaban al preguntar.
   *
   * Existe porque preguntar se emitía como `guided_answered`, que es el turno del
   * CLIENTE: el recorrido mostraba dos "Respondió" por cada respuesta real, y el
   * segundo salía vacío porque ese emisor no manda ni `step` ni `payload.value`.
   */
  'guided_asked',
  /** El cliente respondió una dimensión; `step` = dimensión, `payload.value`. */
  'guided_answered',
  /** Se relajó un filtro por falta de resultados; `payload.dropped`. */
  'guided_relaxed',
  /** Consulta de estado de pedido. */
  'order_status',
  /** Consulta de sucursales / horarios. */
  'store_locations',
  /** Derivación a una persona; `payload.reason`. */
  'handoff',
  /**
   * El turno NO se atendió porque la conversación está en atención manual. El bot
   * calla a propósito (§22), pero sin este evento la pausa es el único camino que no
   * deja rastro alguno: el cliente escribe, el webhook devuelve 200 y el embudo
   * queda igual que si el bot estuviera roto. Distinguirlos costó una hora el
   * 2026-08-04.
   */
  'paused_drop',
  /** Falla del turno; `payload.message`. */
  'error',
  /**
   * El grafo CEDIÓ el turno a propósito; `payload.reason` dice por qué: ningún
   * `start` matcheó (`no_match`) o el recorrido llegó a un final que no tenía nada
   * que decir (`ended`).
   *
   * Existe porque antes esto se registraba como `error`, y un grafo que hace de
   * PUERTA DE ENTRADA —atiende el saludo y el menú, y suelta el resto al router y
   * al modelo— ensuciaba el embudo con un error rojo por turno en conversaciones
   * perfectamente sanas. Un grafo ROTO (`broken_graph`) sigue siendo `error`: ahí
   * sí hay una arista mal dibujada que alguien tiene que arreglar.
   */
  'flow_passthrough',
  /**
   * El recorrido entró a un nodo del grafo configurable; `step` = id del nodo,
   * `payload.version_id` = versión del grafo que lo dibujó.
   *
   * Es la unidad de la traza: con la secuencia de estos eventos se reconstruye por
   * dónde pasó una conversación y se pinta sobre el mismo canvas del editor.
   */
  'node_entered',
  /**
   * No se pudo entregar un mensaje; `payload.node_id`, `payload.kind`.
   *
   * Antes esto no existía: `send()` y `sendMainMenu` se tragaban el error, así que
   * un interactivo rechazado por Meta dejaba al cliente sin respuesta y al operador
   * sin nada que mirar.
   */
  'send_failed',
] as const;

export type WaEventType = (typeof WA_EVENT_TYPES)[number];
