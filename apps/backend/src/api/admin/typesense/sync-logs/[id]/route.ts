import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { TYPESENSE_SYNC_LOG_MODULE } from '../../../../../modules/typesense/sync-log';
import type TypesenseSyncLogService from '../../../../../modules/typesense/sync-log/service';

/** GET /admin/typesense/sync-logs/:id — detalle (el retrieve tira 404 si no existe). */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<TypesenseSyncLogService>(TYPESENSE_SYNC_LOG_MODULE);
  const syncLog = await service.retrieveTypesenseSyncLog(req.params.id!);
  res.status(200).json({ sync_log: syncLog });
}
