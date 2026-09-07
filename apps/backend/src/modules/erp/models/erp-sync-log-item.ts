import { model } from '@medusajs/framework/utils';

/**
 * ErpSyncLogItem — resultado por entidad dentro de una sincronización
 * (por SKU en `stock_sync`, por código de artículo en `catalog_sync`).
 * Los payloads se guardan SANITIZADOS (ver `sanitize.ts`).
 *
 * `status` es TEXT en la DB (no un enum de Postgres): ampliar esta lista no
 * necesita migrar el tipo, solo mantener las dos en sync.
 */
export const ErpSyncLogItem = model
  .define('erp_sync_log_item', {
    id: model.id({ prefix: 'erpsli' }).primaryKey(),
    sync_log_id: model.text(),
    entity_type: model.text().default('variant_sku'),
    entity_id: model.text(),
    status: model.enum([
      'updated',
      'not_found',
      'duplicate_sku',
      'invalid_quantity',
      'skipped',
      'failed',
      'created',
      'price_unchanged',
      'no_price_set',
      'variant_not_found',
      'not_published',
    ]),
    request_payload: model.json().nullable(),
    response_payload: model.json().nullable(),
    error: model.text().nullable(),
  })
  .indexes([{ on: ['sync_log_id', 'status'] }, { on: ['entity_id'] }]);
