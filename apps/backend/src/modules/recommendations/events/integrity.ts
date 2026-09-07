import type { RecommendationEventType } from '../models';

/**
 * Integridad de los eventos que manda el storefront (PRD §14/§19). Función PURA.
 *
 * La regla que sostiene todo el reporte de Rendimiento: un `request_id` NO puede
 * usarse para atribuir productos que no formaron parte de esa respuesta, ni para
 * atribuir a un placement o estrategia bajo los que nunca fue servido.
 *
 * De ahí las dos decisiones acá:
 *
 * 1. `product_id` se valida contra `served_product_ids` de la fila `served`.
 * 2. TODAS las dimensiones de reporte se copian de esa fila y se IGNORA lo que
 *    venga en el body. El cliente informa qué pasó (vio, clickeó, agregó) y sobre
 *    cuál producto; el contexto lo pone el servidor.
 */

/** Eventos que el cliente PUEDE reportar. */
export const CLIENT_EVENTS = [
  'recommendation_viewed',
  'recommendation_clicked',
  'recommendation_added_to_cart',
] as const;

export type ClientEventType = (typeof CLIENT_EVENTS)[number];

export const REJECTION_REASONS = [
  'unknown_request', // no existe la fila `served` (o el request_id es forjado)
  'expired', // la respuesta original es más vieja que el TTL
  'product_not_served', // el producto no estaba en esa respuesta
  'server_owned', // `served`/`purchased` los escribe sólo el backend
  'duplicate_in_batch', // repetido dentro del mismo lote
] as const;

export type RejectionReason = (typeof REJECTION_REASONS)[number];

export type IncomingEvent = {
  event: string;
  product_id?: string | null;
  position?: number | null;
  quantity?: number | null;
  occurred_at?: string | null;
};

/** Fila `served`: el contexto autoritativo de la respuesta original. */
export type ServedRow = {
  request_id: string;
  placement: string | null;
  strategy_key: string | null;
  resolved_strategy_key: string | null;
  fallback_used: boolean;
  version_id: string | null;
  source_product_id: string | null;
  cart_id: string | null;
  customer_id: string | null;
  session_id: string | null;
  sales_channel_id: string | null;
  region_id: string | null;
  currency_code: string | null;
  served_product_ids: string[] | null;
  occurred_at: string | Date;
};

/** Fila lista para insertar en `recommendation_event`. */
export type PreparedEvent = {
  request_id: string;
  event: RecommendationEventType;
  placement: string | null;
  strategy_key: string | null;
  resolved_strategy_key: string | null;
  fallback_used: boolean;
  version_id: string | null;
  product_id: string;
  position: number | null;
  source_product_id: string | null;
  cart_id: string | null;
  customer_id: string | null;
  session_id: string | null;
  sales_channel_id: string | null;
  region_id: string | null;
  currency_code: string | null;
  quantity: number | null;
  occurred_at: Date;
  idempotency_key: string;
};

export type Rejection = {
  event: string;
  product_id: string | null;
  reason: RejectionReason;
};

export type ClassifyOptions = {
  /** Ahora, inyectable para poder testear el TTL. */
  now: Date;
  ttl_hours: number;
};

/**
 * Clave de idempotencia de un evento del cliente.
 *
 * Un `viewed` del mismo producto en el mismo request es el MISMO hecho, sin importar
 * cuántas veces el beacon lo reintente o cuántas veces el componente se remonte. No
 * incluye timestamp a propósito: si lo incluyera, cada reintento contaría como una
 * vista nueva e infllaría el CTR.
 */
export const eventIdempotencyKey = (
  requestId: string,
  event: string,
  productId: string,
): string => `${requestId}:${event}:${productId}`;

const isClientEvent = (event: string): event is ClientEventType =>
  (CLIENT_EVENTS as readonly string[]).includes(event);

const parseOccurredAt = (value: string | null | undefined, fallback: Date): Date => {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  // No se acepta un futuro reportado por el cliente (reloj desfasado o manipulado):
  // arruinaría el bucketing horario de las métricas.
  return parsed > fallback ? fallback : parsed;
};

/**
 * Valida un lote de eventos contra la fila `served` y devuelve las filas listas para
 * insertar más el detalle de lo rechazado.
 *
 * `served === null` significa que no existe la fila: se rechaza TODO el lote como
 * `unknown_request`, sin distinguir entre "request_id inventado" y "expiró y se
 * purgó" — para el cliente son lo mismo y distinguirlos filtraría información.
 */
export function classifyIncomingEvents(
  served: ServedRow | null,
  events: IncomingEvent[],
  options: ClassifyOptions,
): { accepted: PreparedEvent[]; rejected: Rejection[] } {
  if (!served) {
    return {
      accepted: [],
      rejected: events.map((incoming) => ({
        event: incoming.event,
        product_id: incoming.product_id ?? null,
        reason: 'unknown_request' as const,
      })),
    };
  }

  const servedAt = new Date(served.occurred_at);
  const ageMs = options.now.getTime() - servedAt.getTime();
  if (Number.isFinite(ageMs) && ageMs > options.ttl_hours * 3_600_000) {
    return {
      accepted: [],
      rejected: events.map((incoming) => ({
        event: incoming.event,
        product_id: incoming.product_id ?? null,
        reason: 'expired' as const,
      })),
    };
  }

  const servedProducts = new Set(served.served_product_ids ?? []);
  const accepted: PreparedEvent[] = [];
  const rejected: Rejection[] = [];
  const seen = new Set<string>();

  for (const incoming of events) {
    const productId = incoming.product_id ?? null;

    if (!isClientEvent(incoming.event)) {
      // `served` y `purchased` los escribe sólo el backend: aceptarlos del cliente
      // permitiría inventar compras.
      rejected.push({ event: incoming.event, product_id: productId, reason: 'server_owned' });
      continue;
    }
    if (!productId || !servedProducts.has(productId)) {
      rejected.push({ event: incoming.event, product_id: productId, reason: 'product_not_served' });
      continue;
    }

    const key = eventIdempotencyKey(served.request_id, incoming.event, productId);
    if (seen.has(key)) {
      rejected.push({ event: incoming.event, product_id: productId, reason: 'duplicate_in_batch' });
      continue;
    }
    seen.add(key);

    accepted.push({
      request_id: served.request_id,
      event: incoming.event,
      // Dimensiones: SIEMPRE de la fila served, nunca del body.
      placement: served.placement,
      strategy_key: served.strategy_key,
      resolved_strategy_key: served.resolved_strategy_key,
      fallback_used: served.fallback_used,
      version_id: served.version_id,
      product_id: productId,
      position: typeof incoming.position === 'number' ? incoming.position : null,
      source_product_id: served.source_product_id,
      cart_id: served.cart_id,
      customer_id: served.customer_id,
      session_id: served.session_id,
      sales_channel_id: served.sales_channel_id,
      region_id: served.region_id,
      currency_code: served.currency_code,
      quantity: typeof incoming.quantity === 'number' ? incoming.quantity : null,
      occurred_at: parseOccurredAt(incoming.occurred_at, options.now),
      idempotency_key: key,
    });
  }

  return { accepted, rejected };
}
