import { model } from '@medusajs/framework/utils';

export const DatabaseExplorerSavedView = model
  .define('database_explorer_saved_view', {
    id: model.id({ prefix: 'dbxview' }).primaryKey(),
    name: model.text(),
    description: model.text().nullable(),
    table_name: model.text(),
    filters_json: model.json().nullable(),
    columns_json: model.json().nullable(),
    sort_json: model.json().nullable(),
    role_ids_json: model.json().nullable(),
    enabled: model.boolean().default(true),
  })
  .indexes([{ on: ['table_name'] }, { on: ['enabled'] }]);

export default DatabaseExplorerSavedView;
