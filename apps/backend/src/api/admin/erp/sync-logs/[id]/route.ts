import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ERP_MODULE } from '../../../../../modules/erp';
import type ErpModuleService from '../../../../../modules/erp/service';

/** GET /admin/erp/sync-logs/:id — detalle de una ejecución (el retrieve tira 404 si no existe). */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<ErpModuleService>(ERP_MODULE);
  const syncLog = await service.retrieveErpSyncLog(req.params.id!);
  res.status(200).json({ sync_log: syncLog });
}
