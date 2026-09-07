import { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { siteFromRequest } from '../../../../../lib/multistore/request';
import TypeSenseService from '../../../../../modules/typesense/service';

/**
 * El eje es la COLECCIÓN de analítica, no una fila: con
 * `TYPESENSE_SITE_ANALYTICS_COLLECTIONS` cada tienda tiene la suya. Sin resolver la
 * tienda, este botón creaba siempre la global — así que la tienda que apretaba
 * "Inicializar" seguía sin colección propia y su pantalla de analítica, que SÍ
 * resuelve la tienda, seguía vacía. El operador aprieta, no pasa nada visible, y
 * concluye que la analítica no anda.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const typeSenseService = new TypeSenseService();
    const resolution = await siteFromRequest(req);
    await typeSenseService.ensureAnalyticsSetup(
      resolution.status === 'site' ? resolution.site.id : null,
    );
    return res.json({
      success: true,
      message: 'Analytics collection and rule initialized',
    });
  } catch (error) {
    console.error('[ADMIN][typesense/analytics/init] POST failed', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to initialize analytics',
    });
  }
}
