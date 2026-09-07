/**
 * Store API — Andreani branch (Sucursal / PuntoDeTercero) lookup.
 *
 * GET /store/andreani/branches?postal_code=&service_type=
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

  const { postal_code, service_type = 'PuntoDeTercero' } = req.query as {
    postal_code?: string;
    service_type?: string;
  };

  if (!postal_code) {
    sendError(res, 400, {
      code: 'MISSING_POSTAL_CODE',
      message: 'Postal code is required',
    });
    return;
  }

  if (!/^\d{4}$/.test(postal_code)) {
    sendError(res, 400, {
      code: 'INVALID_POSTAL_CODE',
      message: 'Invalid postal code format (expected 4 digits)',
    });
    return;
  }

  if (service_type !== 'Sucursal' && service_type !== 'PuntoDeTercero') {
    sendError(res, 400, {
      code: 'INVALID_SERVICE_TYPE',
      message: 'Service type must be "Sucursal" or "PuntoDeTercero"',
    });
    return;
  }

  try {
    // Build the client/transformer straight from env instead of resolving the
    // fulfillment provider from req.scope — provider container resolution is
    // unreliable in custom routes (same approach as the tracking job).
    const client = getAndreaniClient(logger);
    const rawBranches =
      service_type === 'Sucursal'
        ? await client.getSucursales(postal_code)
        : await client.getPuntosDeTercero(postal_code);

    const branches = getAndreaniTransformer().transformPickupLocations(rawBranches);

    res.status(200).json({
      branches,
      search_criteria: { postal_code, service_type },
      total_found: branches.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Store API: Andreani branch search failed: ${message}`);
    sendError(res, 503, {
      code: 'SERVICE_UNAVAILABLE',
      message: 'Andreani branch lookup is currently unavailable',
    });
  }
}
