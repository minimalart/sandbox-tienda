import { model } from '@medusajs/framework/utils';

export const GiftCardDeliveryAttempt = model
  .define('gift_card_delivery_attempt', {
    id: model.id({ prefix: 'gcattempt' }).primaryKey(),
    delivery_id: model.text(),
    attempt_no: model.number(),
    channel: model.enum(['email', 'audit']).default('email'),
    trigger: model.enum(['initial', 'automatic_retry', 'manual_resend', 'fallback_buyer', 'secure_link']),
    status: model.enum(['processing', 'sent', 'delivered', 'failed']),
    recipient: model.text(),
    notification_id: model.text().nullable(),
    provider_message_id: model.text().nullable(),
    error: model.text().nullable(),
    attempted_at: model.dateTime(),
    completed_at: model.dateTime().nullable(),
    metadata: model.json().nullable(),
  })
  .indexes([
    { on: ['delivery_id', 'attempt_no'], unique: true, where: 'deleted_at IS NULL' },
    { on: ['provider_message_id'] },
  ]);
