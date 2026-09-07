import { model } from '@medusajs/framework/utils';

/**
 * TypesenseSyncLog — una corrida de sincronización del índice.
 *
 * Va en un módulo hermano de `typesense` y NO dentro de `TypeSenseService`: ese
 * service se instancia con `new TypeSenseService()` en 30+ call sites, y el
 * constructor de `MedusaService` resuelve `container.baseRepository`, así que
 * hacerlo extender `MedusaService` los rompería todos.
 *
 * `summary` guarda los totales de la corrida (ver `TypesenseSyncSummary` en
 * `modules/typesense/types.ts`); el detalle por producto vive en
 * `typesense_sync_log_item` y SÓLO para lo que pide atención (fallos, borrados,
 * skips) — un item por producto OK serían millones de filas por día.
 */
export const TypesenseSyncLog = model
  .define('typesense_sync_log', {
    id: model.id({ prefix: 'tssl' }).primaryKey(),
    mode: model.enum(['update', 'recreate']),
    trigger: model.enum(['manual', 'cron', 'event']).default('manual'),
    status: model
      .enum(['running', 'completed', 'completed_with_errors', 'failed'])
      .default('running'),
    /** loading | listing | recreating | upserting | deleting | done | error */
    stage: model.text().nullable(),
    collection: model.text().nullable(),
    started_at: model.dateTime(),
    finished_at: model.dateTime().nullable(),
    summary: model.json().nullable(),
    error: model.json().nullable(),
    created_by: model.text().nullable(),
  })
  .indexes([{ on: ['mode', 'status'] }, { on: ['started_at'] }]);
