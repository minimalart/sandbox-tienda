import { MedusaService } from '@medusajs/framework/utils';
import { TypesenseSyncLog, TypesenseSyncLogItem } from './models';

/**
 * Persistencia de las corridas de sync de Typesense. Sólo CRUD generado por
 * `MedusaService` (list/listAndCount/create/update/retrieve/delete para
 * `TypesenseSyncLogs` y `TypesenseSyncLogItems`); la lógica de la corrida vive
 * en `modules/typesense/run-sync.ts`.
 */
export default class TypesenseSyncLogService extends MedusaService({
  TypesenseSyncLog,
  TypesenseSyncLogItem,
}) {}
