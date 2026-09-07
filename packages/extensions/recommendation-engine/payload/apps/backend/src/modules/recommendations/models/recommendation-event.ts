import { model } from '@medusajs/framework/utils';

/** Embudo de eventos del PRD §14.2. */
export const RECOMMENDATION_EVENTS = [
  'recommendation_served', // el motor devolvió la respuesta (lo escribe el backend)
  'recommendation_viewed', // el widget entró realmente al viewport
  'recommendation_clicked',
  'recommendation_added_to_cart',
  'recommendation_purchased', // SÓLO server-side (subscriber de order.placed)
] as const;

export type RecommendationEventType = (typeof RECOMMENDATION_EVENTS)[number];

/** Clasificación de atribución (PRD §14.3/§14.4). */
export const ATTRIBUTION_KINDS = ['direct', 'assisted', 'none'] as const;

export type AttributionKind = (typeof ATTRIBUTION_KINDS)[number];

/**
 * RecommendationEvent — eventos crudos de exposición e interacción (PRD §11.5).
 *
 * Dos decisiones que conviene entender antes de tocar esta tabla:
 *
 * 1. `served_product_ids` guarda TODO el set servido en UNA fila `served`, en
 *    lugar de una fila por ítem: 1 INSERT por respuesta en vez de 8, en lo que
 *    es la escritura de mayor volumen de la extensión. Esa misma fila es
 *    simultáneamente la métrica de servidos, la fuente de verdad para validar
 *    integridad (`product_id ∈ served_product_ids`) y el ancla de atribución.
 *
 * 2. Todas las dimensiones de reporte (`placement`, `strategy_key`,
 *    `resolved_strategy_key`, `fallback_used`, `version_id`, canal) se COPIAN de
 *    la fila `served` al ingerir, nunca se leen del body del cliente. Es lo que
 *    impide que un cliente atribuya un clic a un placement o estrategia bajo los
 *    que nunca fue servido (PRD §19).
 *
 * `revenue` es `number` y no `bigNumber` a propósito: estas filas se agregan por
 * SQL crudo y `bigNumber` obliga a mantener a mano la columna espejo `raw_*`.
 * Mismo criterio que `commerce_metrics_daily` en commerce-dashboard.
 */
export const RecommendationEvent = model
  .define('recommendation_event', {
    id: model.id({ prefix: 'recevt' }).primaryKey(),

    request_id: model.text(),
    event: model.enum([...RECOMMENDATION_EVENTS]),

    // Dimensiones, copiadas de la fila `served`.
    placement: model.text().nullable(),
    strategy_key: model.text().nullable(), // la pedida
    resolved_strategy_key: model.text().nullable(), // la que efectivamente respondió
    fallback_used: model.boolean().default(false),
    version_id: model.text().nullable(),

    product_id: model.text().nullable(), // null en `served` (ver served_product_ids)
    served_product_ids: model.json().nullable(), // sólo en `served`
    position: model.number().nullable(),
    source_product_id: model.text().nullable(),

    cart_id: model.text().nullable(),
    customer_id: model.text().nullable(),
    session_id: model.text().nullable(),
    sales_channel_id: model.text().nullable(),
    region_id: model.text().nullable(),
    currency_code: model.text().nullable(),

    // Sólo en `purchased`.
    order_id: model.text().nullable(),
    quantity: model.number().nullable(),
    revenue: model.number().nullable(),
    attribution: model.enum([...ATTRIBUTION_KINDS]).nullable(),
    // Se sella al cancelarse la orden. La agregación filtra `voided_at IS NULL`,
    // así una cancelación deja de contar sin borrar el rastro.
    voided_at: model.dateTime().nullable(),

    occurred_at: model.dateTime(),
    // Clave de idempotencia: `{request_id}:{event}:{product_id}` para los
    // eventos del storefront y `purchased:{order_id}:{product_id}:{placement}`
    // para las compras, de modo que una re-entrega de `order.placed` sea no-op.
    idempotency_key: model.text(),
    // Marca de agregación: la puso el rollup horario. Se conserva por
    // trazabilidad; la agregación es delete-then-insert, no depende de esto.
    aggregated_at: model.dateTime().nullable(),
    metadata: model.json().nullable(),
  })
  .indexes([
    { on: ['request_id', 'event'], where: 'deleted_at IS NULL' },
    { on: ['idempotency_key'], unique: true, where: 'deleted_at IS NULL' },
    { on: ['event', 'occurred_at'] },
    { on: ['cart_id', 'event'], where: 'cart_id IS NOT NULL' }, // timeline de atribución
    { on: ['session_id', 'event'], where: 'session_id IS NOT NULL' },
    { on: ['order_id'], where: 'order_id IS NOT NULL' },
    { on: ['occurred_at'] }, // purga por retención
  ]);

export default RecommendationEvent;
