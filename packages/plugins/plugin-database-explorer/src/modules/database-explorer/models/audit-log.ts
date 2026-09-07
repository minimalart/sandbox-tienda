import { model } from '@medusajs/framework/utils';

export const DatabaseExplorerAuditLog = model
  .define('database_explorer_audit_log', {
    id: model.id({ prefix: 'dbxaud' }).primaryKey(),
    user_id: model.text().nullable(),
    action: model.text(),
    table_name: model.text().nullable(),
    record_id: model.text().nullable(),
    view_id: model.text().nullable(),
    filters_json: model.json().nullable(),
    duration_ms: model.number().nullable(),
    success: model.boolean().default(true),
    error_message: model.text().nullable(),
  })
  .indexes([
    { on: ['user_id'] },
    { on: ['table_name'] },
    { on: ['action'] },
    { on: ['created_at'] },
  ]);

export default DatabaseExplorerAuditLog;
