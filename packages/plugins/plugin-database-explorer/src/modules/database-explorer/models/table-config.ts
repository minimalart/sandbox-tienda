import { model } from '@medusajs/framework/utils';

export const DatabaseExplorerTableConfig = model
  .define('database_explorer_table_config', {
    id: model.id({ prefix: 'dbxtbl' }).primaryKey(),
    table_name: model.text(),
    display_name: model.text().nullable(),
    description: model.text().nullable(),
    enabled: model.boolean().default(false),
    show_in_visual: model.boolean().default(true),
    primary_label_column: model.text().nullable(),
    default_sort_column: model.text().nullable(),
    default_sort_direction: model.text().default('desc'),
  })
  .indexes([{ on: ['table_name'], unique: true }, { on: ['enabled'] }]);

export default DatabaseExplorerTableConfig;
