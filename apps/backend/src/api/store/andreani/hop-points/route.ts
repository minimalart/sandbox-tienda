/**
 * Store API — Andreani HOP points (Puntos de Tercero) lookup.
 *
 * GET /store/andreani/hop-points?postal_code=
 *
 * Uses env credentials via the configured Andreani fulfillment provider.
 */

import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import {
  getAndreaniClient,
  getAndreaniTransformer,
} from '../../../../modules/andreani-fulfillment/get-client';

const sendError = (
  res: MedusaResponse,
  status: number,
  payload: { code: string; message: string }
) => res.status(status).json({ error: payload, timestamp: new Date().toISOString() });

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);

  const { postal_code } = req.query as { postal_code?: string };

  if (!postal_code) {
    sendError(res, 400, {
      code: 'MISSING_POSTAL_CODE',
      message: 'Postal code is required',
    });
    return;
  }

  if (!/^\d{4,}$/.test(postal_code)) {
    sendError(res, 400, {
      code: 'INVALID_POSTAL_CODE',
      message: 'Invalid postal code format (expected at least 4 digits)',
    });
    return;
  }

  try {
    // Build straight from env instead of resolving the provider from req.scope
    // (unreliable in custom routes — same approach as the tracking job).
    const rawPoints = await getAndreaniClient(logger).getPuntosDeTercero(postal_code);
    const hop_points = getAndreaniTransformer().transformPickupLocations(rawPoints);

    res.status(200).json({
      hop_points,
      search_criteria: { postal_code },
      total_found: hop_points.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Store API: Andreani HOP point search failed: ${message}`);
    sendError(res, 503, {
      code: 'SERVICE_UNAVAILABLE',
      message: 'Andreani HOP point lookup is currently unavailable',
    });
  }
}
