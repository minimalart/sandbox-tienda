import { model } from '@medusajs/framework/utils';
export const SpaceConfigurator = model
  .define('space_configurator', {
    id: model.id({ prefix: 'spcfg' }).primaryKey(),
    slug: model.text(),
    title: model.text(),
    status: model.enum(['draft', 'published']).default('draft'),
    sales_channel_id: model.text().nullable(),
    config: model.json(),
  })
  .indexes([
    { on: ['slug'], unique: true, where: 'deleted_at IS NULL' },
    { on: ['sales_channel_id', 'status'], where: 'deleted_at IS NULL' },
  ]);
