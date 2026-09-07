import { model } from '@medusajs/framework/utils';

/**
 * TypesenseSyncLogItem — detalle por entidad de una corrida.
 *
 * SÓLO se escribe lo que pide atención: `failed` (Typesense rechazó el
 * documento), `deleted` (huérfano sacado del índice) y `skipped`. Un item por
 * producto indexado con éxito serían ~5.000 filas × 96 corridas/día del cron:
 * inmanejable y sin valor de diagnóstico.
 *
 * `sync_log_id` es un FK plano (mismo criterio que `erp_sync_log_item`): el
 * listado se filtra por esa columna y no hace falta la relación de MikroORM.
 * `status` es TEXT en la DB, así que ampliar la lista no necesita migrar el tipo.
 */
export const TypesenseSyncLogItem = model
  .define('typesense_sync_log_item', {
    id: model.id({ prefix: 'tssli' }).primaryKey(),
    sync_log_id: model.text(),
    entity_type: model.text().default('product'),
    entity_id: model.text(),
    status: model.enum(['failed', 'deleted', 'skipped']),
    error: model.text().nullable(),
    payload: model.json().nullable(),
  })
  .indexes([{ on: ['sync_log_id', 'status'] }, { on: ['entity_id'] }]);
