import { model } from '@medusajs/framework/utils';

export const GiftCardEvent = model.define('gift_card_event', {
  id: model.id({ prefix: 'gcevent' }).primaryKey(),
  delivery_id: model.text().nullable(),
  event: model.enum(['view', 'purchase', 'issued', 'sent', 'delivered', 'claimed', 'first_use', 'exhausted', 'balance_reminder', 'expiring_notice']),
  design_id: model.text().nullable(),
  currency_code: model.text().nullable(),
  amount: model.bigNumber().nullable(),
  occurred_at: model.dateTime(),
  metadata: model.json().nullable(),
}).indexes([{ on: ['event', 'occurred_at'] }, { on: ['delivery_id', 'event'] }]);
