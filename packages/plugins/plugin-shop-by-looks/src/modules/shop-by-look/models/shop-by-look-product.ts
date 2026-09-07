import { model } from '@medusajs/framework/utils';
import { ShopByLook } from './shop-by-look';

/**
 * ShopByLookProduct — un producto asociado a un look + su hotspot.
 *
 * `product_id` se guarda como texto (no hay defineLink): el storefront resuelve
 * el producto por la store API, así si el producto se borra el look no se rompe.
 * `variant_id` es opcional: si falta, el usuario elige la variante en storefront.
 * `pos_x` / `pos_y` son porcentajes enteros (0–100) sobre la imagen.
 */
export const ShopByLookProduct = model
  .define('shop_by_look_product', {
    id: model
      .id({
        prefix: 'sblp',
      })
      .primaryKey(),
    product_id: model.text(),
    variant_id: model.text().nullable(),
    pos_x: model.number().default(50),
    pos_y: model.number().default(50),
    sort_order: model.number().default(0),
    look: model.belongsTo(() => ShopByLook, {
      mappedBy: 'products',
    }),
  })
  .indexes([
    {
      on: ['look_id'],
      where: 'deleted_at IS NULL',
    },
    {
      on: ['product_id'],
      where: 'deleted_at IS NULL',
    },
  ]);
