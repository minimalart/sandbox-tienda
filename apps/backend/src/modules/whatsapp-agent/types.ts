/**
 * Estado conversacional del bot de WhatsApp: una fila por teléfono. Guarda el
 * historial reciente (para dar continuidad multi-turno) y el BORRADOR de carrito
 * que el cliente arma por chat (items acumulados entre mensajes) antes de generar
 * el link de pago. NO es un carrito de Medusa: es solo el spec `{variant_id,
 * quantity}[]` que después alimenta `createCheckoutLinkWorkflow`.
 */
export const WHATSAPP_AGENT_MODULE = 'whatsappAgent';

export type WaDraftItem = { variant_id: string; quantity: number };
export type WaTurn = { role: 'user' | 'assistant'; content: string };

/** Máximo de turnos (mensajes) que se conservan como contexto conversacional. */
export const WA_HISTORY_LIMIT = 20;

/**
 * Sesión comercial en curso (PRD §25). Vive en la columna json `session` y es lo
 * que hace determinístico el recorrido entre turnos: `step` dice qué se está
 * esperando, así que el próximo texto libre se interpreta sin preguntarle al LLM.
 */
export type WaSessionStep =
  /** Se pidió el nombre/marca del producto: el próximo texto es la búsqueda. */
  | 'awaiting_search_query'
  /** Cliente no identificado: se pidió el número de pedido. */
  | 'awaiting_order_number'
  /** Se pidió el email para validar el pedido. */
  | 'awaiting_order_email'
  /** Una pregunta del asesor guiado (la dimensión va en `pending_dimension`). */
  | 'advisor_question';

export type WaSession = {
  /** Agrupa los eventos del embudo de ESTA compra. */
  session_id: string;
  intent?: 'buy' | 'guided' | 'order_status' | 'support' | null;
  step?: WaSessionStep | null;
  /** Respuestas del filtrado guiado: `{ surface: 'wood', base: 'water' }`. */
  answers?: Record<string, string>;
  /** Dimensión que se está preguntando (cuando `step` es `advisor_question`). */
  pending_dimension?: string | null;
  /** Variantes ya ofrecidas, para no repetir opciones. */
  shown_variant_ids?: string[];
  /** Número de pedido a validar mientras se espera el email. */
  pending_order_display_id?: number | null;
  /**
   * Cantidad que el cliente pidió por texto ("3 latas de látex") y que se aplica
   * cuando toque el producto en el carrusel. Antes esto lo deducía el LLM leyendo
   * el historial; guardarlo acá es lo que permite que el tap sea determinístico.
   */
  pending_quantity?: number | null;
  /** ISO de la última actividad: define cuándo la sesión se considera vencida. */
  updated_at?: string;
};

/** Horas de inactividad tras las cuales la sesión arranca de nuevo. */
export const WA_SESSION_IDLE_HOURS = 12;
