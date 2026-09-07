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
  /** Arrancó el asesor guiado. */
  'guided_started',
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
] as const;

export type WaEventType = (typeof WA_EVENT_TYPES)[number];
