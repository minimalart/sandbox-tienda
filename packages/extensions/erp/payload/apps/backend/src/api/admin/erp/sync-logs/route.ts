import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ERP_MODULE } from '../../../../modules/erp';
import type ErpModuleService from '../../../../modules/erp/service';

/** GET /admin/erp/sync-logs — listado paginado con filtros `type` y `status`. */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<ErpModuleService>(ERP_MODULE);
  const limit = req.query.limit ? Math.min(Number(req.query.limit) || 20, 100) : 20;
  const offset = req.query.offset ? Number(req.query.offset) || 0 : 0;

  const filters: Record<string, unknown> = {};
  if (typeof req.query.type === 'string' && req.query.type) filters.type = req.query.type;
  if (typeof req.query.status === 'string' && req.query.status) filters.status = req.query.status;

  const [syncLogs, count] = await service.listAndCountErpSyncLogs(filters, {
    take: limit,
    skip: offset,
    order: { started_at: 'DESC' },
  });

  res.status(200).json({ sync_logs: syncLogs, count, limit, offset });
}
