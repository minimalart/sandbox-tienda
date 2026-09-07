import { model } from '@medusajs/framework/utils';

export const DatabaseExplorerColumnConfig = model
  .define('database_explorer_column_config', {
    id: model.id({ prefix: 'dbxcol' }).primaryKey(),
    table_name: model.text(),
    column_name: model.text(),
    display_name: model.text().nullable(),
    data_type: model.text().nullable(),
    visible: model.boolean().default(false),
    masked: model.boolean().default(false),
    searchable: model.boolean().default(false),
    filterable: model.boolean().default(false),
    sortable: model.boolean().default(false),
    sensitive: model.boolean().default(false),
  })
  .indexes([
    { on: ['table_name', 'column_name'], unique: true },
    { on: ['table_name'] },
  ]);

export default DatabaseExplorerColumnConfig;
