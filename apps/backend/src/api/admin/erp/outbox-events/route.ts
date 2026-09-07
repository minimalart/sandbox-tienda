import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ERP_MODULE } from '../../../../modules/erp';
import type ErpModuleService from '../../../../modules/erp/service';

/**
 * GET /admin/erp/outbox-events — listado paginado con filtro `status` +
 * agregado `counts` por estado (alimenta el dashboard sin endpoint extra).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<ErpModuleService>(ERP_MODULE);
  const limit = req.query.limit ? Math.min(Number(req.query.limit) || 20, 100) : 20;
  const offset = req.query.offset ? Number(req.query.offset) || 0 : 0;

  const filters: Record<string, unknown> = {};
  if (typeof req.query.status === 'string' && req.query.status) filters.status = req.query.status;
  if (typeof req.query.aggregate_id === 'string' && req.query.aggregate_id) {
    filters.aggregate_id = req.query.aggregate_id;
  }

  const [[events, count], counts] = await Promise.all([
    service.listAndCountErpOutboxEvents(filters, {
      take: limit,
      skip: offset,
      order: { created_at: 'DESC' },
    }),
    service.countOutboxByStatus(),
  ]);

  res.status(200).json({ outbox_events: events, count, counts, limit, offset });
}
