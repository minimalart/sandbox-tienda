import { model } from '@medusajs/framework/utils';
export const CatalogConnection = model.define('catalog_connection', {
  id: model.id({ prefix: 'catconn' }).primaryKey(),
  destination_id: model.text(),
  sales_channel_id: model.text(),
  name: model.text(),
  enabled: model.boolean().default(false),
  config: model.json(),
});
