import { model } from '@medusajs/framework/utils';
import { Brand } from './brand';

export const ProductBrandLink = model
  .define('product_product_brand_brand', {
    id: model
      .id({
        prefix: 'pbrnd',
      })
      .primaryKey(),
    product_id: model.text(),
    brand: model.belongsTo(() => Brand, {
      mappedBy: 'product_links',
    }),
  })
  .indexes([
    {
      on: ['product_id'],
      where: 'deleted_at IS NULL',
    },
    {
      on: ['brand_id'],
      where: 'deleted_at IS NULL',
    },
    {
      on: ['product_id', 'brand_id'],
      unique: true,
      where: 'deleted_at IS NULL',
    },
  ]);
