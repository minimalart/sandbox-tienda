import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { TYPESENSE_SYNC_LOG_MODULE } from '../../../../modules/typesense/sync-log';
import type TypesenseSyncLogService from '../../../../modules/typesense/sync-log/service';

/** GET /admin/typesense/sync-logs — listado paginado con filtros `mode` y `status`. */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<TypesenseSyncLogService>(TYPESENSE_SYNC_LOG_MODULE);
  const limit = req.query.limit ? Math.min(Number(req.query.limit) || 20, 100) : 20;
  const offset = req.query.offset ? Number(req.query.offset) || 0 : 0;

  const filters: Record<string, unknown> = {};
  if (typeof req.query.mode === 'string' && req.query.mode) filters.mode = req.query.mode;
  if (typeof req.query.status === 'string' && req.query.status) filters.status = req.query.status;
  if (typeof req.query.trigger === 'string' && req.query.trigger) filters.trigger = req.query.trigger;

  const [syncLogs, count] = await service.listAndCountTypesenseSyncLogs(filters, {
    take: limit,
    skip: offset,
    order: { started_at: 'DESC' },
  });

  res.status(200).json({ sync_logs: syncLogs, count, limit, offset });
}
