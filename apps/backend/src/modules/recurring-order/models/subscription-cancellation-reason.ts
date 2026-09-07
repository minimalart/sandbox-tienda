import { model } from '@medusajs/framework/utils';

/** Motivos administrables del flujo de cancelacion y retencion. */
export const SubscriptionCancellationReason = model
  .define('subscription_cancellation_reason', {
    id: model.id({ prefix: 'screason' }).primaryKey(),
    sales_channel_id: model.text().nullable(),
    code: model.text(),
    label: model.text(),
    enabled: model.boolean().default(true),
    sort_order: model.number().default(0),
    metadata: model.json().nullable(),
  })
  .indexes([{ on: ['sales_channel_id'] }, { on: ['code'] }]);

export default SubscriptionCancellationReason;
