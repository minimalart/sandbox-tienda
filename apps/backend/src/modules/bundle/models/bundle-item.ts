import { model } from '@medusajs/framework/utils';
import { Bundle } from './bundle';

/**
 * BundleItem — one Product slot within a Bundle. Holds the product reference
 * and the quantity that will be added to the cart. Deliberately does NOT
 * store:
 *   - a default variant (variants are resolved at wizard time via Medusa
 *     Product Options / Variants);
 *   - a price (pricing is always resolved via Medusa in the active Store
 *     context, see PRD §9);
 *   - product options (they live in Medusa).
 *
 * `product_id` is a soft reference to a Medusa Product id; validity is checked
 * server-side on publish and on confirm (a deleted product invalidates the
 * bundle, PRD §14).
 */
export const BundleItem = model
  .define('bundle_item', {
    id: model.id({ prefix: 'bitem' }).primaryKey(),
    product_id: model.text(),
    quantity: model.number().default(1),
    position: model.number().default(0),
    metadata: model.json().nullable(),
    bundle: model.belongsTo(() => Bundle, { mappedBy: 'items' }),
  })
  .indexes([
    { on: ['product_id'] },
  ]);
