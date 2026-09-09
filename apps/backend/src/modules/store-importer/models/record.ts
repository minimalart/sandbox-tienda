import { model } from '@medusajs/framework/utils';
/** Durable link survives local handle/SKU edits; source identity is never a label. */
export const CatalogRecord = model.define('catalog_record', {
  id: model.id({ prefix: 'catrec' }).primaryKey(),
  identity: model.text().unique(),
  connection_id: model.text(),
  destination_id: model.text(),
  external_product_id: model.text(),
  product_id: model.text(),
});
