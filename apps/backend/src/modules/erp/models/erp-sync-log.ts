import { model } from '@medusajs/framework/utils';

/**
 * ErpSyncLog — una ejecución de sincronización (hoy: `stock_sync`).
 * `summary` guarda los totales por estado (`updated`, `not_found`, ...) más
 * duración y location; el detalle por SKU vive en `erp_sync_log_item`.
 */
export const ErpSyncLog = model
  .define('erp_sync_log', {
    id: model.id({ prefix: 'erpsl' }).primaryKey(),
    type: model.text(),
    provider: model.text(),
    trigger: model.enum(['cron', 'manual']).default('cron'),
    status: model
      .enum(['running', 'completed', 'completed_with_errors', 'failed'])
      .default('running'),
    started_at: model.dateTime(),
    finished_at: model.dateTime().nullable(),
    summary: model.json().nullable(),
    error: model.json().nullable(),
    created_by: model.text().nullable(),
  })
  .indexes([{ on: ['type', 'status'] }, { on: ['started_at'] }]);
