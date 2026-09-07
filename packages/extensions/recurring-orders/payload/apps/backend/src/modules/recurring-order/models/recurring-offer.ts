import { model } from '@medusajs/framework/utils';

/**
 * Override de descuento de suscripción POR PRODUCTO. La base del descuento es
 * `recurring_setting.frequency_discounts` (% por frecuencia a nivel canal);
 * esta entidad lo pisa para un producto puntual. Resolución completa en
 * offers.ts: offer del canal → offer global → setting del canal → setting
 * global → sin descuento.
 */
export const RecurringOffer = model
  .define('recurring_offer', {
    id: model.id({ prefix: 'roff' }).primaryKey(),
    // null = override global (aplica en todos los canales sin offer propia).
    sales_channel_id: model.text().nullable(),
    product_id: model.text(),
    // [{interval:'week'|'month'|'day', count:number, percentage:number}]
    discounts: model.json(),
    enabled: model.boolean().default(true),
    metadata: model.json().nullable(),
  })
  .indexes([{ on: ['product_id'] }, { on: ['sales_channel_id'] }]);

export default RecurringOffer;
