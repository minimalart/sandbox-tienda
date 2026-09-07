import { model } from '@medusajs/framework/utils';

/**
 * Contrato comercial versionado de una suscripcion. Los planes publicados no
 * se editan in-place: una modificacion economica crea una version nueva y las
 * suscripciones existentes conservan su plan_snapshot.
 */
export const SubscriptionPlan = model
  .define('subscription_plan', {
    id: model.id({ prefix: 'splan' }).primaryKey(),
    sales_channel_id: model.text().nullable(),
    name: model.text(),
    handle: model.text(),
    status: model.text().default('draft'),
    version: model.number().default(1),
    purchase_mode: model.text().default('one_time_and_subscription'),
    price_policy: model.text().default('dynamic'),
    promotion_policy: model.text().default('best_benefit'),
    allow_stacking: model.boolean().default(false),
    currency_code: model.text().nullable(),
    preflight_hours: model.number().default(72),
    reservation_hours: model.number().default(24),
    stock_retry_hours: model.number().default(72),
    stock_retry_interval_hours: model.number().default(6),
    payment_retry_hours: model.number().default(72),
    payment_retry_interval_hours: model.number().default(6),
    forecast_windows: model.json().nullable(),
    trial_days: model.number().default(0),
    minimum_cycles: model.number().default(0),
    cancellation_policy: model.text().default('immediate'),
    legacy: model.boolean().default(false),
    published_at: model.dateTime().nullable(),
    archived_at: model.dateTime().nullable(),
    metadata: model.json().nullable(),
  })
  .indexes([
    { on: ['sales_channel_id'] },
    { on: ['status'] },
    { on: ['handle'] },
  ]);

export default SubscriptionPlan;
