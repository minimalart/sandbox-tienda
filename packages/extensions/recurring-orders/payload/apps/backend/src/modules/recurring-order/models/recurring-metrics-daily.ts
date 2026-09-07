import { model } from '@medusajs/framework/utils';

/**
 * Snapshot diario de métricas de compras recurrentes, por sales channel
 * (`sales_channel_id` null = agregado de toda la plataforma). Lo escribe el
 * job `compute-recurring-metrics` recomputando SIEMPRE desde las tablas fuente
 * (suscripciones + ciclos): upsert idempotente por (date, sales_channel_id),
 * re-ejecutable para backfill/rebuild sin doble conteo.
 */
export const RecurringMetricsDaily = model
  .define('recurring_metrics_daily', {
    id: model.id({ prefix: 'rmet' }).primaryKey(),
    // Día calendario (UTC) del snapshot, formato YYYY-MM-DD.
    date: model.text(),
    sales_channel_id: model.text().nullable(),
    // Foto del estado de las suscripciones al cierre del día.
    active_count: model.number().default(0),
    paused_count: model.number().default(0),
    pending_payment_count: model.number().default(0),
    failed_count: model.number().default(0),
    cancelled_count: model.number().default(0),
    // Eventos DEL día.
    new_count: model.number().default(0),
    cancelled_today: model.number().default(0),
    renewals_success: model.number().default(0),
    renewals_failed: model.number().default(0),
    renewals_skipped: model.number().default(0),
    // Valor pendiente de pago (ciclos pending_payment vivos al cierre del día).
    pending_value: model.bigNumber().default(0),
    // MRR estimado (ver offers/analytics.ts: total normalizado a mensual).
    mrr_estimate: model.bigNumber().default(0),
    currency_code: model.text().nullable(),
    // [{product_id, title, subscriptions}] — top productos suscriptos activos.
    top_products: model.json().nullable(),
    metadata: model.json().nullable(),
  })
  .indexes([{ on: ['date', 'sales_channel_id'] }, { on: ['date'] }]);

export default RecurringMetricsDaily;
