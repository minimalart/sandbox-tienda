import { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { siteFromRequest } from '../../../../../lib/multistore/request';
import TypeSenseService from '../../../../../modules/typesense/service';

/**
 * La versión DESTRUCTIVA del hueco de `init`, y por eso la que más importa: sin
 * resolver la tienda, el reset borraba la colección de analítica GLOBAL desde
 * cualquier tienda. Una secundaria apretaba "Resetear" para limpiar SUS contadores
 * y se llevaba puestos los de la principal, mientras los propios quedaban enteros —
 * el peor par posible: destruye lo que no era suyo y no arregla lo que quería.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const typeSenseService = new TypeSenseService();
    const resolution = await siteFromRequest(req);
    await typeSenseService.resetAnalyticsCollection(
      resolution.status === 'site' ? resolution.site.id : null,
    );
    return res.json({
      success: true,
      message: 'Analytics collection reset',
    });
  } catch (error) {
    console.error('[ADMIN][typesense/analytics/reset] POST failed', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to reset analytics',
    });
  }
}
