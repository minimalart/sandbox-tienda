import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ERP_MODULE } from '../../../../../../modules/erp';
import type ErpModuleService from '../../../../../../modules/erp/service';

/**
 * GET /admin/erp/sync-logs/:id/items — detalle por SKU, paginado y filtrable
 * por `status` y `entity_id` (búsqueda exacta de SKU). Va aparte del detalle
 * porque una ejecución puede tener miles de items.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<ErpModuleService>(ERP_MODULE);
  const limit = req.query.limit ? Math.min(Number(req.query.limit) || 50, 200) : 50;
  const offset = req.query.offset ? Number(req.query.offset) || 0 : 0;

  const filters: Record<string, unknown> = { sync_log_id: req.params.id };
  if (typeof req.query.status === 'string' && req.query.status) filters.status = req.query.status;
  if (typeof req.query.entity_id === 'string' && req.query.entity_id) {
    filters.entity_id = req.query.entity_id;
  }

  const [items, count] = await service.listAndCountErpSyncLogItems(filters, {
    take: limit,
    skip: offset,
    order: { id: 'ASC' },
  });

  res.status(200).json({ items, count, limit, offset });
}
