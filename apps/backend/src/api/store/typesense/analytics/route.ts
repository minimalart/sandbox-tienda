import { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import TypeSenseService from '../../../../modules/typesense/service';
import { siteIdFromPublishableKey } from '../../../../lib/multistore/publishable-key';

export interface TrackSearchPayload {
  query?: string;
  hasResults?: boolean;
}

export async function POST(
  req: MedusaRequest<TrackSearchPayload>,
  res: MedusaResponse
): Promise<void> {
  try {
    const { query, hasResults } = req.body ?? {};

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      res.status(400).json({ success: false, message: 'query is required' });
      return;
    }

    /**
     * La tienda se resuelve ANTES del fire-and-forget, no dentro.
     *
     * `siteIdFromPublishableKey` hace I/O —resuelve el registro— y meterlo adentro del
     * `void` significaría contestar 202 con la resolución todavía en el aire: si falla,
     * la búsqueda se suma igual, y se suma a la colección global. Ese es exactamente el
     * modo de falla que esto viene a cerrar, pero silencioso y sólo bajo carga.
     *
     * El gemelo del admin (`admin/typesense/analytics/init`) ya resolvía la tienda; el
     * del storefront —el que ESCRIBE cada búsqueda real— era el que faltaba.
     */
    const siteId = await siteIdFromPublishableKey(req);

    const typeSenseService = new TypeSenseService();
    // Fire-and-forget — never block the storefront on tracking failures.
    void typeSenseService.storeSearchAnalytics(query, hasResults !== false, siteId);

    res.status(202).json({ success: true });
  } catch (error) {
    console.error('[STORE][typesense/analytics] POST failed', error);
    res.status(500).json({ success: false });
  }
}
