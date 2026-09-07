"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const commerce_dashboard_1 = require("../../../modules/commerce-dashboard");
const request_1 = require("../../../lib/multistore/request");
const defaultFrom = () => {
    const date = new Date();
    date.setDate(date.getDate() - 29);
    date.setHours(0, 0, 0, 0);
    return date.toISOString();
};
const defaultTo = () => {
    const date = new Date();
    date.setHours(23, 59, 59, 999);
    return date.toISOString();
};
async function GET(req, res) {
    const started = Date.now();
    try {
        const service = req.scope.resolve(commerce_dashboard_1.COMMERCE_DASHBOARD_MODULE);
        const filters = {
            from: String(req.query.from ?? defaultFrom()),
            to: String(req.query.to ?? defaultTo()),
            bucket: req.query.bucket === 'hourly' ? 'hourly' : 'daily',
            /**
             * El canal explícito gana; si no viene, el PRIMARIO de la tienda activa.
             *
             * Uno solo y no los dos porque el snapshot está agregado por canal y el filtro
             * es escalar. Es una limitación conocida: una tienda B2B ve acá el tablero de su
             * canal retail. Está en el registro con esa razón hasta que el agregado acepte
             * una lista.
             *
             * Aun así vale: sin esto el tablero mezclaba TODAS las tiendas, y la pantalla ya
             * tiene su propio selector de canal (page.tsx:568) que se contradecía con el
             * selector global.
             */
            sales_channel_id: req.query.sales_channel_id
                ? String(req.query.sales_channel_id)
                : ((await (0, request_1.siteFromRequest)(req)).site
                    ?.channel_ids[0] ?? null),
            country_code: req.query.country_code ? String(req.query.country_code).toLowerCase() : null,
            currency_code: req.query.currency_code ? String(req.query.currency_code).toLowerCase() : null,
        };
        const [data, lastAggregatedAt] = await Promise.all([
            service.getDashboard(filters),
            service.getLastAggregatedAt(filters),
        ]);
        res.setHeader('Cache-Control', 'private, no-store');
        return res.status(200).json({
            dashboard: data,
            meta: {
                source: 'aggregated_snapshots',
                response_time_ms: Date.now() - started,
                performance_target_ms: 200,
                last_aggregated_at: lastAggregatedAt,
            },
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Error loading commerce dashboard';
        console.error('[Admin Commerce Dashboard] GET failed:', message);
        return res.status(400).json({ message });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2NvbW1lcmNlLWRhc2hib2FyZC9yb3V0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQW1CQSxrQkFnREM7QUFsRUQsNEVBQWdGO0FBR2hGLDZEQUFrRTtBQUVsRSxNQUFNLFdBQVcsR0FBRyxHQUFHLEVBQUU7SUFDdkIsTUFBTSxJQUFJLEdBQUcsSUFBSSxJQUFJLEVBQUUsQ0FBQztJQUN4QixJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQztJQUNsQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQzFCLE9BQU8sSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO0FBQzVCLENBQUMsQ0FBQztBQUVGLE1BQU0sU0FBUyxHQUFHLEdBQUcsRUFBRTtJQUNyQixNQUFNLElBQUksR0FBRyxJQUFJLElBQUksRUFBRSxDQUFDO0lBQ3hCLElBQUksQ0FBQyxRQUFRLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsR0FBRyxDQUFDLENBQUM7SUFDL0IsT0FBTyxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7QUFDNUIsQ0FBQyxDQUFDO0FBRUssS0FBSyxVQUFVLEdBQUcsQ0FBQyxHQUFrQixFQUFFLEdBQW1CO0lBQy9ELE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztJQUUzQixJQUFJLENBQUM7UUFDSCxNQUFNLE9BQU8sR0FBbUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsOENBQXlCLENBQUMsQ0FBQztRQUM3RixNQUFNLE9BQU8sR0FBRztZQUNkLElBQUksRUFBRSxNQUFNLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLElBQUksV0FBVyxFQUFFLENBQUM7WUFDN0MsRUFBRSxFQUFFLE1BQU0sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEVBQUUsSUFBSSxTQUFTLEVBQUUsQ0FBQztZQUN2QyxNQUFNLEVBQUUsR0FBRyxDQUFDLEtBQUssQ0FBQyxNQUFNLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLE9BQU87WUFDMUQ7Ozs7Ozs7Ozs7O2VBV0c7WUFDSCxnQkFBZ0IsRUFBRSxHQUFHLENBQUMsS0FBSyxDQUFDLGdCQUFnQjtnQkFDMUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLGdCQUFnQixDQUFDO2dCQUNwQyxDQUFDLENBQUMsQ0FBRSxDQUFDLE1BQU0sSUFBQSx5QkFBZSxFQUFDLEdBQUcsQ0FBQyxDQUEwQyxDQUFDLElBQUk7b0JBQzFFLEVBQUUsV0FBVyxDQUFDLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQztZQUMvQixZQUFZLEVBQUUsR0FBRyxDQUFDLEtBQUssQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLFlBQVksQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJO1lBQzFGLGFBQWEsRUFBRSxHQUFHLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUk7U0FDckYsQ0FBQztRQUNYLE1BQU0sQ0FBQyxJQUFJLEVBQUUsZ0JBQWdCLENBQUMsR0FBRyxNQUFNLE9BQU8sQ0FBQyxHQUFHLENBQUM7WUFDakQsT0FBTyxDQUFDLFlBQVksQ0FBQyxPQUFPLENBQUM7WUFDN0IsT0FBTyxDQUFDLG1CQUFtQixDQUFDLE9BQU8sQ0FBQztTQUNyQyxDQUFDLENBQUM7UUFFSCxHQUFHLENBQUMsU0FBUyxDQUFDLGVBQWUsRUFBRSxtQkFBbUIsQ0FBQyxDQUFDO1FBQ3BELE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUM7WUFDMUIsU0FBUyxFQUFFLElBQUk7WUFDZixJQUFJLEVBQUU7Z0JBQ0osTUFBTSxFQUFFLHNCQUFzQjtnQkFDOUIsZ0JBQWdCLEVBQUUsSUFBSSxDQUFDLEdBQUcsRUFBRSxHQUFHLE9BQU87Z0JBQ3RDLHFCQUFxQixFQUFFLEdBQUc7Z0JBQzFCLGtCQUFrQixFQUFFLGdCQUFnQjthQUNyQztTQUNGLENBQUMsQ0FBQztJQUNMLENBQUM7SUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1FBQ2YsTUFBTSxPQUFPLEdBQUcsS0FBSyxZQUFZLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsa0NBQWtDLENBQUM7UUFDNUYsT0FBTyxDQUFDLEtBQUssQ0FBQyx3Q0FBd0MsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUNqRSxPQUFPLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxFQUFFLENBQUMsQ0FBQztJQUMzQyxDQUFDO0FBQ0gsQ0FBQyJ9