import { model } from '@medusajs/framework/utils';
import { VimeoVideo } from './vimeo-video';

export const ProductVideoLink = model
  .define('product_video_link', {
    id: model.id().primaryKey(),
    product_id: model.text(),
    vimeo_video: model.belongsTo(() => VimeoVideo, {
      mappedBy: 'vimeo_video_id',
    }),
  })
  .indexes([
    {
      on: ['product_id', 'vimeo_video_id'],
      unique: true,
    },
  ]);
