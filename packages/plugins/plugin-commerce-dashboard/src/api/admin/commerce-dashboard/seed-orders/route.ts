import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { seedCommerceDashboardOrders } from '../../../../scripts/seed-commerce-dashboard-demo-orders';

/**
 * Dispara la generación de órdenes seed (reales, con marca interna oculta)
 * server-side. Necesario porque la DB de prod tiene Trusted Sources y no se
 * puede correr el script desde fuera del droplet.
 *
 * Idempotente: no supera el objetivo `purchases`. Solo admin (auth de la ruta).
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const body = (req.body ?? {}) as {
      purchases?: number;
      currency?: string;
      country?: string;
    };

    const result = await seedCommerceDashboardOrders(req.scope, {
      purchases: body.purchases,
      currency: body.currency,
      country: body.country,
    });

    return res.status(201).json({ seed: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : JSON.stringify(error);
    console.error('[Admin Commerce Dashboard] seed-orders failed:', error);
    return res.status(500).json({
      message: `No se pudieron generar las órdenes seed: ${message}`,
    });
  }
}
