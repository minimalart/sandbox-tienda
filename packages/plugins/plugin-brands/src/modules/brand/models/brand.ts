import { model } from '@medusajs/framework/utils';
import { ProductBrandLink } from './product-brand-link';

export const Brand = model.define('brand', {
  id: model
    .id({
      prefix: 'brand',
    })
    .primaryKey(),
  name: model.text(),
  handle: model.text().unique(),
  description: model.text().nullable(),
  is_active: model.boolean().default(true),
  // Segmentación por sales channel: array de ids. null/[] = visible en todos
  // los canales (comportamiento global actual). En contexto demo el storefront
  // pide solo las marcas cuyo array incluye el canal de la demo.
  sales_channel_ids: model.json().nullable(),
  metadata: model.json().nullable(),
  product_links: model.hasMany(() => ProductBrandLink, {
    mappedBy: 'brand',
  }),
});
