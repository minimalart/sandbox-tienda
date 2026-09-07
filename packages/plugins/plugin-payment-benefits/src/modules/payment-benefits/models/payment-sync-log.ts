import { model } from '@medusajs/framework/utils';

/**
 * Historial de sincronizaciones por proveedor. Alimenta el dashboard del
 * backoffice ("última sincronización", "errores de sincronización").
 */
export const PaymentSyncLog = model
  .define('payment_sync_log', {
    id: model.id({ prefix: 'psl' }).primaryKey(),
    provider_code: model.text(),
    // 'ok' | 'error'
    status: model.text().default('ok'),
    items_synced: model.number().default(0),
    message: model.text().nullable(),
    started_at: model.dateTime().nullable(),
    finished_at: model.dateTime().nullable(),
  })
  .indexes([{ on: ['provider_code'] }, { on: ['status'] }]);

export default PaymentSyncLog;
