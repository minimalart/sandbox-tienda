import { randomBytes } from 'node:crypto';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { MedusaContainer } from '@medusajs/framework/types';
import { getRecommendationsConfig, recommendationsEnvEnabled } from '../config';
import type { ServeResult } from '../serve/resolve';
import { resolveEventSecret, verifyRequestId } from '../serve/request-token';
import {
  classifyIncomingEvents,
  type IncomingEvent,
  type PreparedEvent,
  type Rejection,
  type ServedRow,
} from './integrity';

/**
 * Persistencia de eventos.
 *
 * Se escribe por knex y no por `MedusaService.create*` porque hace falta
 * `ON CONFLICT (idempotency_key) DO NOTHING`: el repositorio no tiene upsert y sin
 * eso un beacon reintentado (o una re-entrega de `order.placed`) duplicaría el
 * evento y contaría dos veces en las métricas.
 */

/** Id con el mismo prefijo que generaría el modelo. */
const newEventId = (): string => `recevt_${randomBytes(12).toString('base64url')}`;

const EVENT_COLUMNS = [
  'id',
  'request_id',
  'event',
  'placement',
  'strategy_key',
  'resolved_strategy_key',
  'fallback_used',
  'version_id',
  'product_id',
  'served_product_ids',
  'position',
  'source_product_id',
  'cart_id',
  'customer_id',
  'session_id',
  'sales_channel_id',
  'region_id',
  'currency_code',
  'order_id',
  'quantity',
  'revenue',
  'attribution',
  'occurred_at',
  'idempotency_key',
] as const;

type EventRow = Partial<Record<(typeof EVENT_COLUMNS)[number], unknown>>;

type KnexLike = {
  raw: (sql: string, bindings?: unknown[]) => Promise<{ rows?: unknown[]; rowCount?: number }>;
};

const knexOf = (container: MedusaContainer): KnexLike =>
  container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as unknown as KnexLike;

/**
 * Inserta filas de evento ignorando las que ya existen, y devuelve cuántas entraron.
 *
 * `ON CONFLICT DO NOTHING` sobre el índice único parcial de `idempotency_key`: el
 * conteo de insertadas vs. enviadas es lo que distingue "aceptado" de "duplicado" sin
 * una lectura previa.
 */
export async function insertEventRows(
  container: MedusaContainer,
  rows: EventRow[],
): Promise<number> {
  if (!rows.length) return 0;

  const columns = EVENT_COLUMNS.map((column) => `"${column}"`).join(', ');
  const placeholders = rows
    .map(() => `(${EVENT_COLUMNS.map(() => '?').join(', ')})`)
    .join(', ');
  const bindings = rows.flatMap((row) =>
    EVENT_COLUMNS.map((column) => {
      const value = row[column];
      if (value === undefined) return null;
      // Los json van serializados: el driver no convierte arrays/objetos a jsonb.
      if (Array.isArray(value) || (value !== null && typeof value === 'object' && !(value instanceof Date))) {
        return JSON.stringify(value);
      }
      return value;
    }),
  );

  const result = await knexOf(container).raw(
    `insert into "recommendation_event" (${columns}) values ${placeholders}
     on conflict ("idempotency_key") where "deleted_at" is null do nothing
     returning "id"`,
    bindings,
  );

  return (result?.rows?.length ?? result?.rowCount ?? 0) as number;
}

/**
 * Escribe la fila `served` de una respuesta del motor.
 *
 * UNA fila por respuesta con todo el set en `served_product_ids`, no una por
 * producto: es la escritura de mayor volumen de la extensión. Esa fila es a la vez la
 * métrica de servidos, la fuente de verdad de integridad y el ancla de atribución.
 *
 * Nunca lanza: si falla el registro, la respuesta al storefront ya salió y perder un
 * evento de telemetría no puede romper una ficha de producto. Se pierde la capacidad
 * de atribuir ese request (los eventos posteriores caerán como `unknown_request`), que
 * es exactamente el trade-off correcto.
 */
export async function recordServed(
  container: MedusaContainer,
  result: ServeResult,
): Promise<void> {
  if (!result.products.length) return;

  const context = result.served_context;
  try {
    await insertEventRows(container, [
      {
        id: newEventId(),
        request_id: result.request_id,
        event: 'recommendation_served',
        placement: result.placement,
        strategy_key: result.strategy_key,
        resolved_strategy_key: result.resolved_strategy_key,
        fallback_used: result.fallback_used,
        version_id: result.version_id,
        product_id: null,
        served_product_ids: result.products.map((product) => product.product_id),
        source_product_id: context.source_product_id,
        cart_id: context.cart_id,
        customer_id: context.customer_id,
        session_id: context.session_id,
        sales_channel_id: context.sales_channel_id,
        region_id: context.region_id,
        currency_code: context.currency_code,
        occurred_at: new Date(),
        // Una respuesta = una fila. El request_id ya es único.
        idempotency_key: `served:${result.request_id}`,
      },
    ]);
  } catch (error) {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
    logger.warn(
      `[recommendations] no se pudo registrar el evento served de ${result.request_id}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

export type IngestResult = {
  accepted: number;
  duplicates: number;
  rejected: Rejection[];
};

/**
 * Ingesta de eventos del storefront (PRD §15.2).
 *
 * Orden deliberado:
 *   1. firma del `request_id` → un id forjado se rechaza con CERO acceso a base;
 *   2. UNA lectura indexada por `(request_id, 'recommendation_served')` que trae el
 *      contexto para TODO el lote;
 *   3. validación pura y armado de filas;
 *   4. un solo INSERT con ON CONFLICT DO NOTHING.
 */
export async function ingestEvents(
  container: MedusaContainer,
  input: { request_id: string; events: IncomingEvent[] },
): Promise<IngestResult> {
  if (!recommendationsEnvEnabled() || !input.events.length) {
    return { accepted: 0, duplicates: 0, rejected: [] };
  }

  const secret = resolveEventSecret();
  // Sin secreto configurado no se puede afirmar nada sobre la firma; se sigue
  // adelante y la fila `served` hace igual toda la validación de contenido. Nunca se
  // cae de vuelta a un secreto hardcodeado, que sería no firmar aparentando firmar.
  if (secret && !verifyRequestId(input.request_id, secret)) {
    return {
      accepted: 0,
      duplicates: 0,
      rejected: input.events.map((incoming) => ({
        event: incoming.event,
        product_id: incoming.product_id ?? null,
        reason: 'unknown_request' as const,
      })),
    };
  }

  const config = await getRecommendationsConfig(container);
  const served = await loadServedRow(container, input.request_id);

  const { accepted, rejected } = classifyIncomingEvents(served, input.events, {
    now: new Date(),
    ttl_hours: config.event_ttl_hours,
  });

  const inserted = await insertEventRows(
    container,
    accepted.map((event) => toRow(event)),
  );

  return {
    accepted: inserted,
    // Lo enviado y aceptado por validación que no entró es, por definición, algo que
    // ya estaba: el índice único lo rechazó.
    duplicates: accepted.length - inserted,
    rejected,
  };
}

const toRow = (event: PreparedEvent): EventRow => ({
  id: newEventId(),
  request_id: event.request_id,
  event: event.event,
  placement: event.placement,
  strategy_key: event.strategy_key,
  resolved_strategy_key: event.resolved_strategy_key,
  fallback_used: event.fallback_used,
  version_id: event.version_id,
  product_id: event.product_id,
  served_product_ids: null,
  position: event.position,
  source_product_id: event.source_product_id,
  cart_id: event.cart_id,
  customer_id: event.customer_id,
  session_id: event.session_id,
  sales_channel_id: event.sales_channel_id,
  region_id: event.region_id,
  currency_code: event.currency_code,
  quantity: event.quantity,
  occurred_at: event.occurred_at,
  idempotency_key: event.idempotency_key,
});

/** Trae la fila `served` de un request. Una sola lectura indexada por lote. */
async function loadServedRow(
  container: MedusaContainer,
  requestId: string,
): Promise<ServedRow | null> {
  const result = await knexOf(container).raw(
    `select request_id, placement, strategy_key, resolved_strategy_key, fallback_used, version_id,
            source_product_id, cart_id, customer_id, session_id, sales_channel_id, region_id,
            currency_code, served_product_ids, occurred_at
     from "recommendation_event"
     where request_id = ? and event = 'recommendation_served' and deleted_at is null
     limit 1`,
    [requestId],
  );

  const row = (result?.rows ?? [])[0] as Record<string, unknown> | undefined;
  if (!row) return null;

  const servedIds = row.served_product_ids;
  return {
    request_id: row.request_id as string,
    placement: (row.placement as string) ?? null,
    strategy_key: (row.strategy_key as string) ?? null,
    resolved_strategy_key: (row.resolved_strategy_key as string) ?? null,
    fallback_used: Boolean(row.fallback_used),
    version_id: (row.version_id as string) ?? null,
    source_product_id: (row.source_product_id as string) ?? null,
    cart_id: (row.cart_id as string) ?? null,
    customer_id: (row.customer_id as string) ?? null,
    session_id: (row.session_id as string) ?? null,
    sales_channel_id: (row.sales_channel_id as string) ?? null,
    region_id: (row.region_id as string) ?? null,
    currency_code: (row.currency_code as string) ?? null,
    // jsonb puede volver ya parseado o como string según el driver.
    served_product_ids: Array.isArray(servedIds)
      ? (servedIds as string[])
      : typeof servedIds === 'string'
        ? (JSON.parse(servedIds) as string[])
        : null,
    occurred_at: row.occurred_at as string | Date,
  };
}
