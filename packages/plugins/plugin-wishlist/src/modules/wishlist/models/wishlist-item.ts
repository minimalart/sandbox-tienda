import { model } from '@medusajs/framework/utils';
import { Wishlist } from './wishlist';

// A single favorited variant within a customer's wishlist. Tracked at the
// variant level (product_variant_id) to match the storefront contract, with
// product_id kept for convenience. Unique per (wishlist, product, variant).
export const WishlistItem = model
  .define('wishlist_item', {
    id: model
      .id({
        prefix: 'wishitem',
      })
      .primaryKey(),
    product_id: model.text(),
    product_variant_id: model.text(),
    quantity: model.number().default(1),
    wishlist: model.belongsTo(() => Wishlist, {
      mappedBy: 'items',
    }),
  })
  .indexes([
    {
      on: ['wishlist_id', 'product_id', 'product_variant_id'],
      unique: true,
    },
  ]);
