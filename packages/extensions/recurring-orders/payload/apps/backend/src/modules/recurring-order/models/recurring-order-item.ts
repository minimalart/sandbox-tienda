import { model } from '@medusajs/framework/utils';
import { RecurringOrder } from './recurring-order';

/**
 * Un item de la suscripción. Los snapshots son informativos (mostrar "precio al
 * suscribirse" y detectar cambios); el cobro real usa siempre el precio vigente
 * del canal al armar el carrito de renovación.
 */
export const RecurringOrderItem = model
  .define('recurring_order_item', {
    id: model.id({ prefix: 'rori' }).primaryKey(),
    recurring_order: model.belongsTo(() => RecurringOrder, { mappedBy: 'items' }),
    product_id: model.text(),
    variant_id: model.text(),
    quantity: model.number(),
    // { title, variant_title, thumbnail, sku, handle }
    product_snapshot: model.json().nullable(),
    // { unit_price, currency_code, captured_at }
    pricing_snapshot: model.json().nullable(),
    metadata: model.json().nullable(),
  })
  .indexes([{ on: ['variant_id'] }]);

export default RecurringOrderItem;
