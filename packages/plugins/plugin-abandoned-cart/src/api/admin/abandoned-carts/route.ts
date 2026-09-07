import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { ABANDONED_CART_MODULE } from '../../../modules/abandoned-cart';
import type AbandonedCartModuleService from '../../../modules/abandoned-cart/service';
import { siteFromRequest } from '../../../lib/multistore/request';
import { siteChannelFilter } from '../../../lib/multistore/scope';

/**
 * GET /admin/abandoned-carts — listado paginado + métricas agregadas.
 * Query: `limit`, `offset`, `status` (opcional), `sales_channel_id` (opcional).
 *
 * `sales_channel_id` acota el listado Y las métricas: con varios canales, un
 * agregado global no dice nada sobre el rendimiento de cada tienda.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const service: AbandonedCartModuleService = req.scope.resolve(ABANDONED_CART_MODULE);
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const offset = req.query.offset ? Number(req.query.offset) : 0;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const salesChannelId =
      typeof req.query.sales_channel_id === 'string'
        ? req.query.sales_channel_id
        : undefined;

    const filters: Record<string, unknown> = {};
    if (status) filters.status = status;
    // El param explícito gana; si no viene, los canales de la tienda activa (los DOS
    // si es B2B, que es el bug que esto arregla).
    Object.assign(filters, siteChannelFilter(await siteFromRequest(req), salesChannelId));

    const [abandoned_carts, count] = await service.listAndCountAbandonedCarts(
      filters,
      { skip: offset, take: limit, order: { updated_at: 'DESC' } },
    );

    // Las métricas siguen el filtro de canal, pero NO el de estado ni el paginado:
    // el desglose por estado ya viene dentro de las métricas.
    const metrics = await service.getMetrics(
      salesChannelId ? { sales_channel_id: salesChannelId } : undefined,
    );

    return res.status(200).json({
      abandoned_carts,
      count,
      offset,
      limit,
      metrics,
    });
  } catch (error) {
    console.error('[Admin AbandonedCarts] Error listing:', error);
    return res.status(500).json({ message: 'Error fetching abandoned carts' });
  }
}
