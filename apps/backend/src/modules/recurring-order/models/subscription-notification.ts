import { model } from '@medusajs/framework/utils';

/** Outbox transaccional para notificaciones de suscripciones. */
export const SubscriptionNotification = model
  .define('subscription_notification', {
    id: model.id({ prefix: 'snotif' }).primaryKey(),
    recurring_order_id: model.text().nullable(),
    renewal_cycle_id: model.text().nullable(),
    sales_channel_id: model.text().nullable(),
    dedupe_key: model.text(),
    channel: model.text(),
    recipient: model.text(),
    template: model.text(),
    status: model.text().default('pending'),
    attempt_count: model.number().default(0),
    data: model.json().nullable(),
    next_attempt_at: model.dateTime().nullable(),
    sent_at: model.dateTime().nullable(),
    last_error: model.text().nullable(),
  })
  .indexes([
    { on: ['status', 'next_attempt_at'] },
    { on: ['dedupe_key'] },
    { on: ['recurring_order_id'] },
  ]);

export default SubscriptionNotification;
