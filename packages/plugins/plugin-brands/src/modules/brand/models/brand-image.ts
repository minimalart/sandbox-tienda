import { model } from '@medusajs/framework/utils';

const BrandImage = model
  .define('brand_image', {
    id: model.id().primaryKey(),
    url: model.text(),
    file_id: model.text(),
    type: model.enum(['thumbnail', 'image']),
    brand_id: model.text(),
  })
  .indexes([
    {
      on: ['brand_id', 'type'],
      where: "type = 'thumbnail'",
      unique: true,
      name: 'unique_thumbnail_per_brand',
    },
  ]);

export default BrandImage;
