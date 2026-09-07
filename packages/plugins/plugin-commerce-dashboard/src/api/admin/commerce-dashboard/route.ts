import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { COMMERCE_DASHBOARD_MODULE } from '../../../modules/commerce-dashboard';
import type CommerceDashboardModuleService from '../../../modules/commerce-dashboard/service';

import { siteFromRequest } from '../../../lib/multistore/request';

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

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const started = Date.now();

  try {
    const service: CommerceDashboardModuleService = req.scope.resolve(COMMERCE_DASHBOARD_MODULE);
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
        : (((await siteFromRequest(req)) as { site?: { channel_ids: string[] } }).site
            ?.channel_ids[0] ?? null),
      country_code: req.query.country_code ? String(req.query.country_code).toLowerCase() : null,
      currency_code: req.query.currency_code ? String(req.query.currency_code).toLowerCase() : null,
    } as const;
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
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error loading commerce dashboard';
    console.error('[Admin Commerce Dashboard] GET failed:', message);
    return res.status(400).json({ message });
  }
}
