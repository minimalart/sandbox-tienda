import { model } from '@medusajs/framework/utils';

/**
 * Configuración de elegibilidad de compras recurrentes por sales channel.
 * Una fila por canal; `sales_channel_id` null = default global (fallback de
 * todos los canales sin fila propia). La unicidad por canal la garantiza el
 * upsert del service (Postgres permite múltiples null en índices únicos).
 *
 * `scope`:
 * - `all`      → todos los productos del canal pueden suscribirse (default).
 * - `selected` → solo los que matcheen categorías / etiquetas / ids elegidos
 *                (unión de los tres criterios).
 */
export const RecurringSetting = model
  .define('recurring_setting', {
    id: model.id({ prefix: 'rset' }).primaryKey(),
    sales_channel_id: model.text().nullable(),
    scope: model.text().default('all'),
    // Ids de categorías de producto elegibles (jsonb array de strings).
    category_ids: model.json().nullable(),
    // Valores de tags de producto elegibles (jsonb array de strings).
    tag_values: model.json().nullable(),
    // Ids de productos puntuales elegibles (jsonb array de strings).
    product_ids: model.json().nullable(),
    // Descuento % por frecuencia del canal (ofertas de suscripción):
    // [{interval:'week'|'month'|'day', count:number, percentage:number}].
    // Los overrides por producto viven en `recurring_offer`.
    frequency_discounts: model.json().nullable(),
    // Oferta de retención al cancelar: {percentage, cycles}. Null = no ofrecer.
    retention_discount: model.json().nullable(),
    // ── Políticas runtime (null = heredar del fallback canal→global→env) ────
    // Horas en pending_payment antes del recordatorio único.
    reminder_hours: model.number().nullable(),
    // Vida del link de pago en horas.
    expiration_hours: model.number().nullable(),
    // Reintentos de ejecución por ciclo antes de fallo terminal.
    max_attempts: model.number().nullable(),
    // Horas entre reintentos de ejecución.
    retry_hours: model.number().nullable(),
    // Ciclos fallidos consecutivos antes de degradar la suscripción.
    max_consecutive_failures: model.number().nullable(),
    // skip_unavailable (default) | fail_cycle: qué hacer con líneas sin stock.
    stock_policy: model.text().nullable(),
    // always_current (default) | warn_over_threshold (modo C del PRD).
    price_change_policy: model.text().nullable(),
    // Umbral % del aviso de suba (solo con warn_over_threshold).
    price_change_threshold_pct: model.number().nullable(),
    metadata: model.json().nullable(),
  })
  .indexes([{ on: ['sales_channel_id'] }]);

export default RecurringSetting;
