import { model } from '@medusajs/framework/utils';

/** Granularidad del rollup (PRD §11.6). */
export const METRIC_BUCKETS = ['hourly', 'daily'] as const;

export type MetricBucket = (typeof METRIC_BUCKETS)[number];

/**
 * RecommendationMetric — métricas agregadas (PRD §11.6).
 *
 * Una sola tabla con columna `bucket` en lugar de una horaria y otra diaria
 * (precedente: `product_metrics_daily` de commerce-dashboard). La retención
 * diferencial del PRD §13.5 sale de un `WHERE bucket = 'hourly'`, no de dos
 * esquemas paralelos.
 *
 * Los RATIOS (CTR, conversión, ticket promedio) NO se guardan: se calculan en el
 * service al leer, igual que en commerce-dashboard. Guardar un promedio de
 * promedios es la forma clásica de reportar números que no cierran al filtrar.
 *
 * `attributed_revenue` y `assisted_revenue` son columnas SEPARADAS y se reportan
 * separadas (PRD §14.4): nunca se suman entre sí.
 */
export const RecommendationMetric = model
  .define('recommendation_metric', {
    id: model.id({ prefix: 'recmet' }).primaryKey(),

    bucket: model.enum([...METRIC_BUCKETS]).default('daily'),
    period_start: model.dateTime(),
    period_end: model.dateTime(),

    // Dimensiones.
    placement: model.text().nullable(),
    strategy_key: model.text().nullable(),
    resolved_strategy_key: model.text().nullable(),
    sales_channel_id: model.text().nullable(),
    currency_code: model.text().nullable(),

    // Embudo.
    served: model.number().default(0), // respuestas servidas
    served_items: model.number().default(0), // productos servidos (suma del set)
    viewed: model.number().default(0),
    clicked: model.number().default(0),
    added_to_cart: model.number().default(0),
    purchased: model.number().default(0),
    units_purchased: model.number().default(0),

    // Dinero.
    attributed_revenue: model.number().default(0), // clic → carrito → compra
    assisted_revenue: model.number().default(0), // visto → compra
    influenced_orders: model.number().default(0),
    influenced_order_revenue: model.number().default(0), // total de esas órdenes (para el AOV)

    aggregated_at: model.dateTime(),
    metadata: model.json().nullable(),
  })
  .indexes([
    { on: ['bucket', 'period_start'] },
    { on: ['placement', 'period_start'] },
    { on: ['strategy_key', 'period_start'] },
    { on: ['sales_channel_id', 'period_start'] },
  ]);

export default RecommendationMetric;
