import { model } from '@medusajs/framework/utils';

/** Incidente operativo deduplicado: stock, cobro, webhook u orden. */
export const SubscriptionAlert = model
  .define('subscription_alert', {
    id: model.id({ prefix: 'salt' }).primaryKey(),
    sales_channel_id: model.text().nullable(),
    recurring_order_id: model.text().nullable(),
    renewal_cycle_id: model.text().nullable(),
    variant_id: model.text().nullable(),
    type: model.text(),
    severity: model.text().default('warning'),
    status: model.text().default('open'),
    dedupe_key: model.text(),
    title: model.text(),
    message: model.text().nullable(),
    data: model.json().nullable(),
    detected_at: model.dateTime(),
    notified_at: model.dateTime().nullable(),
    resolved_at: model.dateTime().nullable(),
  })
  .indexes([
    { on: ['sales_channel_id'] },
    { on: ['status', 'type'] },
    { on: ['dedupe_key'] },
  ]);

export default SubscriptionAlert;
