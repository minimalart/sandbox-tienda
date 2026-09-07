/**
 * Admin API — listado global de fulfillments de Correo Argentino.
 *
 * GET /admin/correo-argentino/fulfillments
 *
 * Query params:
 *   - search?        match por tracking_number, agency_id, order id o display_id
 *   - status?        igualdad exacta case-insensitive; vacío = todos
 *   - date_from?     YYYY-MM-DD, created_at >= inicio del día
 *   - date_to?       YYYY-MM-DD, created_at <= fin del día
 *   - ticketed_only? "true" → solo los que ya tienen envío creado en Correo
 *   - limit?         default 20, máx 100
 *   - offset?        default 0
 *
 * No hay tabla custom: todo sale del fulfillment nativo de Medusa. La
 * normalización y el filtrado viven en `listCorreoFulfillments`, compartido con
 * la descarga masiva de rótulos para que no haya drift entre lo que se lista y
 * lo que se descarga.
 */

import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { siteFromRequest } from '../../../../lib/multistore/request';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { listCorreoFulfillments } from '../../../../modules/correo-argentino-fulfillment/utils/list-fulfillments';
import { extractErrorMessage } from '../../../../modules/correo-argentino-fulfillment/utils/errors';
import { parseFulfillmentQuery, parsePagination } from '../_input';

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);

  // El parseo vive en `_input.ts` y NO acá: un `limit=abc` daba `NaN`, y un
  // `slice(NaN, NaN)` devuelve array vacío SIN error — o sea, el admin veía una
  // tabla vacía y concluía que no hay envíos. Es la clase de bug que solo se
  // caza con un test unitario.
  const { limit, offset } = parsePagination(req.query);

  try {
    const normalized = await listCorreoFulfillments(query, {
      ...parseFulfillmentQuery(req.query),
      // Los DOS canales de una tienda B2B: un envío mayorista es igual de suyo.
      // Importa para `pending_ticket`: es el número del día a día del operador, y
      // contar los rótulos pendientes de otra tienda lo manda a generar envíos ajenos.
      site_channel_ids: ((await siteFromRequest(req)) as { site?: { channel_ids: string[] } }).site
        ?.channel_ids,
    });

    const paginated = normalized.slice(offset, offset + limit);

    res.status(200).json({
      fulfillments: paginated,
      count: paginated.length,
      total: normalized.length,
      // Cuántos esperan que el operador genere el rótulo. Es el número que
      // importa en el día a día del admin, y calcularlo del lado del cliente
      // sobre una página paginada daría mal.
      pending_ticket: normalized.filter((f) => !f.tracking_number).length,
      limit,
      offset,
    });
  } catch (error) {
    const message = extractErrorMessage(error);
    logger.error(`[correo-fulfillments] Query falló: ${message}`);
    res.status(500).json({ error: { code: 'QUERY_FAILED', message } });
  }
}
