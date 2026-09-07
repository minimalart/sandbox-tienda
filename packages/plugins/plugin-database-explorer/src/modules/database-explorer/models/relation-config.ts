import { model } from '@medusajs/framework/utils';

export const DatabaseExplorerRelationConfig = model
  .define('database_explorer_relation_config', {
    id: model.id({ prefix: 'dbxrel' }).primaryKey(),
    source_table: model.text(),
    source_column: model.text(),
    target_table: model.text(),
    target_column: model.text(),
    relation_type: model.text().default('many_to_one'),
    display_name: model.text().nullable(),
    enabled: model.boolean().default(true),
  })
  .indexes([
    { on: ['source_table', 'source_column'] },
    { on: ['target_table', 'target_column'] },
    { on: ['enabled'] },
  ]);

export default DatabaseExplorerRelationConfig;
