import { model } from '@medusajs/framework/utils';
import { ShopByLookProduct } from './shop-by-look-product';

/**
 * ShopByLook — un "look" editorial comprable del home: una imagen protagonista
 * con productos marcados (hotspots) y una lista editable debajo.
 *
 * Segmentación: `sales_channel_ids` / `region_ids` son arrays opcionales; null o
 * vacío significa "todos" (el storefront filtra por el canal/región activos).
 * `placement` es el slot del home donde aparece el bloque.
 */
export const ShopByLook = model.define('shop_by_look', {
  id: model
    .id({
      prefix: 'sbl',
    })
    .primaryKey(),
  title: model.text(),
  subtitle: model.text().nullable(),
  cta_label: model.text().nullable(),
  image_url: model.text(),
  image_alt: model.text().nullable(),
  is_active: model.boolean().default(true),
  sort_order: model.number().default(0),
  placement: model.text().default('after_featured'),
  sales_channel_ids: model.json().nullable(),
  region_ids: model.json().nullable(),
  metadata: model.json().nullable(),
  products: model.hasMany(() => ShopByLookProduct, {
    mappedBy: 'look',
  }),
});
