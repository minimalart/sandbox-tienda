"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const seed_commerce_dashboard_demo_orders_1 = require("../../../../scripts/seed-commerce-dashboard-demo-orders");
/**
 * Dispara la generación de órdenes seed (reales, con marca interna oculta)
 * server-side. Necesario porque la DB de prod tiene Trusted Sources y no se
 * puede correr el script desde fuera del droplet.
 *
 * Idempotente: no supera el objetivo `purchases`. Solo admin (auth de la ruta).
 */
async function POST(req, res) {
    try {
        const body = (req.body ?? {});
        const result = await (0, seed_commerce_dashboard_demo_orders_1.seedCommerceDashboardOrders)(req.scope, {
            purchases: body.purchases,
            currency: body.currency,
            country: body.country,
        });
        return res.status(201).json({ seed: result });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : JSON.stringify(error);
        console.error('[Admin Commerce Dashboard] seed-orders failed:', error);
        return res.status(500).json({
            message: `No se pudieron generar las órdenes seed: ${message}`,
        });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2NvbW1lcmNlLWRhc2hib2FyZC9zZWVkLW9yZGVycy9yb3V0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQVVBLG9CQXNCQztBQS9CRCxpSEFBc0c7QUFFdEc7Ozs7OztHQU1HO0FBQ0ksS0FBSyxVQUFVLElBQUksQ0FBQyxHQUFrQixFQUFFLEdBQW1CO0lBQ2hFLElBQUksQ0FBQztRQUNILE1BQU0sSUFBSSxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksSUFBSSxFQUFFLENBSTNCLENBQUM7UUFFRixNQUFNLE1BQU0sR0FBRyxNQUFNLElBQUEsaUVBQTJCLEVBQUMsR0FBRyxDQUFDLEtBQUssRUFBRTtZQUMxRCxTQUFTLEVBQUUsSUFBSSxDQUFDLFNBQVM7WUFDekIsUUFBUSxFQUFFLElBQUksQ0FBQyxRQUFRO1lBQ3ZCLE9BQU8sRUFBRSxJQUFJLENBQUMsT0FBTztTQUN0QixDQUFDLENBQUM7UUFFSCxPQUFPLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxDQUFDLENBQUM7SUFDaEQsQ0FBQztJQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7UUFDZixNQUFNLE9BQU8sR0FBRyxLQUFLLFlBQVksS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQy9FLE9BQU8sQ0FBQyxLQUFLLENBQUMsZ0RBQWdELEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDdkUsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQztZQUMxQixPQUFPLEVBQUUsNENBQTRDLE9BQU8sRUFBRTtTQUMvRCxDQUFDLENBQUM7SUFDTCxDQUFDO0FBQ0gsQ0FBQyJ9