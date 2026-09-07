import { model } from '@medusajs/framework/utils';

/**
 * Una fila por intento de envío (paso + canal). Da idempotencia (constraint único
 * `abandoned_cart_id + step + channel`, ver migración) y trazabilidad de la
 * secuencia: qué se envió, cuándo y con qué resultado.
 */
export const AbandonedCartNotification = model
  .define('abandoned_cart_notification', {
    id: model.id({ prefix: 'abcn' }).primaryKey(),
    abandoned_cart_id: model.text(),
    step: model.number(),
    channel: model.text(),
    // Key lógica del template usado (ej. `cart-abandoned-1`).
    template: model.text().nullable(),
    // Destinatario efectivo (email o teléfono).
    recipient: model.text().nullable(),
    status: model.text().default('sent'),
    error: model.text().nullable(),
    sent_at: model.dateTime().nullable(),
  })
  .indexes([
    { on: ['abandoned_cart_id'] },
    { on: ['abandoned_cart_id', 'step', 'channel'], unique: true },
  ]);

export default AbandonedCartNotification;
