import { model } from '@medusajs/framework/utils';
export const SpaceDesign = model
  .define('space_design', {
    id: model.id({ prefix: 'spdes' }).primaryKey(),
    configurator_id: model.text(),
    customer_id: model.text(),
    sales_channel_id: model.text().nullable(),
    name: model.text(),
    template_id: model.text().nullable(),
    snapshot: model.json(),
    configuration_snapshot: model.json(),
  })
  .indexes([
    { on: ['customer_id'], where: 'deleted_at IS NULL' },
    { on: ['configurator_id'], where: 'deleted_at IS NULL' },
    { on: ['sales_channel_id'], where: 'deleted_at IS NULL' },
  ]);
