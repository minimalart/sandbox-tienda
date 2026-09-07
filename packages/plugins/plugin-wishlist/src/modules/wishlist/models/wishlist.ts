import { model } from '@medusajs/framework/utils';
import { WishlistItem } from './wishlist-item';

// One wishlist per customer. customer_id is the customer module's id, kept as a
// scalar (no module link) — a favorite is simply "this customer marked these
// products". Product data is enriched on read via the product module.
export const Wishlist = model.define('wishlist', {
  id: model
    .id({
      prefix: 'wish',
    })
    .primaryKey(),
  customer_id: model.text().unique(),
  items: model.hasMany(() => WishlistItem, {
    mappedBy: 'wishlist',
  }),
});
