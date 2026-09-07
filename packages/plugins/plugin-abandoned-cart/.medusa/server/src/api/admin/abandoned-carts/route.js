"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const abandoned_cart_1 = require("../../../modules/abandoned-cart");
const request_1 = require("../../../lib/multistore/request");
const scope_1 = require("../../../lib/multistore/scope");
/**
 * GET /admin/abandoned-carts — listado paginado + métricas agregadas.
 * Query: `limit`, `offset`, `status` (opcional), `sales_channel_id` (opcional).
 *
 * `sales_channel_id` acota el listado Y las métricas: con varios canales, un
 * agregado global no dice nada sobre el rendimiento de cada tienda.
 */
async function GET(req, res) {
    try {
        const service = req.scope.resolve(abandoned_cart_1.ABANDONED_CART_MODULE);
        const limit = req.query.limit ? Number(req.query.limit) : 50;
        const offset = req.query.offset ? Number(req.query.offset) : 0;
        const status = typeof req.query.status === 'string' ? req.query.status : undefined;
        const salesChannelId = typeof req.query.sales_channel_id === 'string'
            ? req.query.sales_channel_id
            : undefined;
        const filters = {};
        if (status)
            filters.status = status;
        // El param explícito gana; si no viene, los canales de la tienda activa (los DOS
        // si es B2B, que es el bug que esto arregla).
        Object.assign(filters, (0, scope_1.siteChannelFilter)(await (0, request_1.siteFromRequest)(req), salesChannelId));
        const [abandoned_carts, count] = await service.listAndCountAbandonedCarts(filters, { skip: offset, take: limit, order: { updated_at: 'DESC' } });
        // Las métricas siguen el filtro de canal, pero NO el de estado ni el paginado:
        // el desglose por estado ya viene dentro de las métricas.
        const metrics = await service.getMetrics(salesChannelId ? { sales_channel_id: salesChannelId } : undefined);
        return res.status(200).json({
            abandoned_carts,
            count,
            offset,
            limit,
            metrics,
        });
    }
    catch (error) {
        console.error('[Admin AbandonedCarts] Error listing:', error);
        return res.status(500).json({ message: 'Error fetching abandoned carts' });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2FiYW5kb25lZC1jYXJ0cy9yb3V0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQWFBLGtCQXVDQztBQW5ERCxvRUFBd0U7QUFFeEUsNkRBQWtFO0FBQ2xFLHlEQUFrRTtBQUVsRTs7Ozs7O0dBTUc7QUFDSSxLQUFLLFVBQVUsR0FBRyxDQUFDLEdBQWtCLEVBQUUsR0FBbUI7SUFDL0QsSUFBSSxDQUFDO1FBQ0gsTUFBTSxPQUFPLEdBQStCLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLHNDQUFxQixDQUFDLENBQUM7UUFDckYsTUFBTSxLQUFLLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7UUFDN0QsTUFBTSxNQUFNLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDL0QsTUFBTSxNQUFNLEdBQUcsT0FBTyxHQUFHLENBQUMsS0FBSyxDQUFDLE1BQU0sS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7UUFDbkYsTUFBTSxjQUFjLEdBQ2xCLE9BQU8sR0FBRyxDQUFDLEtBQUssQ0FBQyxnQkFBZ0IsS0FBSyxRQUFRO1lBQzVDLENBQUMsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLGdCQUFnQjtZQUM1QixDQUFDLENBQUMsU0FBUyxDQUFDO1FBRWhCLE1BQU0sT0FBTyxHQUE0QixFQUFFLENBQUM7UUFDNUMsSUFBSSxNQUFNO1lBQUUsT0FBTyxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUM7UUFDcEMsaUZBQWlGO1FBQ2pGLDhDQUE4QztRQUM5QyxNQUFNLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRSxJQUFBLHlCQUFpQixFQUFDLE1BQU0sSUFBQSx5QkFBZSxFQUFDLEdBQUcsQ0FBQyxFQUFFLGNBQWMsQ0FBQyxDQUFDLENBQUM7UUFFdEYsTUFBTSxDQUFDLGVBQWUsRUFBRSxLQUFLLENBQUMsR0FBRyxNQUFNLE9BQU8sQ0FBQywwQkFBMEIsQ0FDdkUsT0FBTyxFQUNQLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxFQUFFLFVBQVUsRUFBRSxNQUFNLEVBQUUsRUFBRSxDQUM3RCxDQUFDO1FBRUYsK0VBQStFO1FBQy9FLDBEQUEwRDtRQUMxRCxNQUFNLE9BQU8sR0FBRyxNQUFNLE9BQU8sQ0FBQyxVQUFVLENBQ3RDLGNBQWMsQ0FBQyxDQUFDLENBQUMsRUFBRSxnQkFBZ0IsRUFBRSxjQUFjLEVBQUUsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUNsRSxDQUFDO1FBRUYsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQztZQUMxQixlQUFlO1lBQ2YsS0FBSztZQUNMLE1BQU07WUFDTixLQUFLO1lBQ0wsT0FBTztTQUNSLENBQUMsQ0FBQztJQUNMLENBQUM7SUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1FBQ2YsT0FBTyxDQUFDLEtBQUssQ0FBQyx1Q0FBdUMsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUM5RCxPQUFPLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxFQUFFLGdDQUFnQyxFQUFFLENBQUMsQ0FBQztJQUM3RSxDQUFDO0FBQ0gsQ0FBQyJ9