import { model } from '@medusajs/framework/utils';
export const CatalogImport = model.define('catalog_import', {
  id: model.id({ prefix: 'catimp' }).primaryKey(),
  connection_id: model.text(),
  destination_id: model.text(),
  sales_channel_id: model.text(),
  config: model.json(),
  status: model
    .enum(['pending', 'running', 'completed', 'partial', 'failed', 'cancelled'])
    .default('pending'),
  cancel_requested: model.boolean().default(false),
  cursor: model.number().default(0),
  products: model.json().nullable(),
  report: model.json().nullable(),
  result: model.json().nullable(),
});
