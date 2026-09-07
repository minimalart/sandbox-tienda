import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { TYPESENSE_SYNC_LOG_MODULE } from '../../../../../../modules/typesense/sync-log';
import type TypesenseSyncLogService from '../../../../../../modules/typesense/sync-log/service';

/**
 * GET /admin/typesense/sync-logs/:id/items — detalle por producto, paginado y
 * filtrable por `status` y `entity_id` (búsqueda exacta de id). Va aparte del
 * detalle porque una corrida puede tener miles de items.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<TypesenseSyncLogService>(TYPESENSE_SYNC_LOG_MODULE);
  const limit = req.query.limit ? Math.min(Number(req.query.limit) || 50, 200) : 50;
  const offset = req.query.offset ? Number(req.query.offset) || 0 : 0;

  const filters: Record<string, unknown> = { sync_log_id: req.params.id };
  if (typeof req.query.status === 'string' && req.query.status) filters.status = req.query.status;
  if (typeof req.query.entity_id === 'string' && req.query.entity_id) {
    filters.entity_id = req.query.entity_id;
  }

  const [items, count] = await service.listAndCountTypesenseSyncLogItems(filters, {
    take: limit,
    skip: offset,
    order: { id: 'ASC' },
  });

  res.status(200).json({ items, count, limit, offset });
}
