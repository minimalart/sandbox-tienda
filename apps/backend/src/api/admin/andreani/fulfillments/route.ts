/**
 * Admin API — Lista global de fulfillments Andreani.
 *
 * GET /admin/andreani/fulfillments
 *
 * Query params:
 *   - search?: string      (match por order display_id o tracking_number)
 *   - status?: string      (igualdad exacta case-insensitive; vacío = todos)
 *   - date_from?: string   (ISO YYYY-MM-DD; filtra created_at >= inicio del día)
 *   - date_to?: string     (ISO YYYY-MM-DD; filtra created_at <= fin del día)
 *   - limit?: number       (default 20, máx 100)
 *   - offset?: number      (default 0)
 *
 * Filtra fulfillments nativos de Medusa cuyo provider_id sea 'andreani'
 * o cuyo campo `data` contenga `tracking_number` (identificador robusto
 * ya que el provider_id real en el container es 'fp_andreani_andreani').
 *
 * IMPORTANTE: No hay tabla custom. Todo se lee del fulfillment nativo.
 * La normalización/filtrado vive en `listAndreaniFulfillments` (helper
 * compartido con el endpoint de descarga masiva) para evitar drift.
 */

import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { siteFromRequest } from '../../../../lib/multistore/request';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { listAndreaniFulfillments } from '../../../../modules/andreani-fulfillment/utils/list-fulfillments';

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
  const dateFrom =
    typeof req.query.date_from === 'string' ? req.query.date_from.trim() : '';
  const dateTo =
    typeof req.query.date_to === 'string' ? req.query.date_to.trim() : '';
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const offset = Number(req.query.offset) || 0;

  try {
    const normalized = await listAndreaniFulfillments(query, {
      search,
      status,
      date_from: dateFrom,
      date_to: dateTo,
      // Los DOS canales de una tienda B2B: un envío mayorista es igual de suyo.
      site_channel_ids: ((await siteFromRequest(req)) as { site?: { channel_ids: string[] } }).site
        ?.channel_ids,
    });

    const total = normalized.length;
    const paginated = normalized.slice(offset, offset + limit);

    res.status(200).json({
      fulfillments: paginated,
      count: paginated.length,
      total,
      limit,
      offset,
    });
  } catch (error) {
    const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Admin API: Andreani fulfillments query failed: ${message}`);
    res.status(500).json({ error: { code: 'QUERY_FAILED', message } });
  }
}
