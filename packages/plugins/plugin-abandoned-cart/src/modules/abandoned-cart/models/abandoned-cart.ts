import { model } from '@medusajs/framework/utils';

/**
 * Seguimiento de un carrito abandonado. Una fila por `cart_id`. Guarda solo lo
 * necesario para orquestar la secuencia y mostrar métricas (valor snapshot,
 * contacto, estado); el detalle del carrito se relee en vivo desde el módulo core.
 */
export const AbandonedCart = model
  .define('abandoned_cart', {
    id: model.id({ prefix: 'abc' }).primaryKey(),
    cart_id: model.text(),
    email: model.text().nullable(),
    phone: model.text().nullable(),
    customer_id: model.text().nullable(),
    sales_channel_id: model.text().nullable(),
    // Snapshot del total (en la unidad del carrito) para métricas de valor recuperable.
    cart_total: model.number().nullable(),
    currency_code: model.text().nullable(),
    status: model.text().default('pending'),
    // Último paso de la secuencia efectivamente enviado (0 = ninguno).
    last_step_sent: model.number().default(0),
    // Cuándo vuelve a ser elegible para el próximo paso (null si no hay más).
    next_eligible_at: model.dateTime().nullable(),
    // Última actividad conocida del carrito (updated_at del core), para calcular idle.
    last_activity_at: model.dateTime().nullable(),
    recovered_order_id: model.text().nullable(),
    metadata: model.json().nullable(),
  })
  .indexes([
    { on: ['cart_id'], unique: true },
    { on: ['status'] },
    { on: ['next_eligible_at'] },
  ]);

export default AbandonedCart;
