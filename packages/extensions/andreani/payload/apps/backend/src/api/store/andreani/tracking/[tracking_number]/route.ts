/**
 * Store API — Andreani shipment tracking (trazas).
 *
 * GET /store/andreani/tracking/:tracking_number
 *
 * Uses env credentials via the configured Andreani fulfillment provider.
 * On-demand polling — there is no scheduled tracking-sync job in the boilerplate.
 */

import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import {
  getAndreaniClient,
  getAndreaniTransformer,
} from '../../../../../modules/andreani-fulfillment/get-client';

const sendError = (
  res: MedusaResponse,
  status: number,
  payload: { code: string; message: string }
) => res.status(status).json({ error: payload, timestamp: new Date().toISOString() });

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);

  const { tracking_number } = req.params;

  if (!tracking_number) {
    sendError(res, 400, {
      code: 'MISSING_TRACKING_NUMBER',
      message: 'Tracking number is required',
    });
    return;
  }

  if (!/^[A-Z0-9]{8,15}$/.test(tracking_number)) {
    sendError(res, 400, {
      code: 'INVALID_TRACKING_NUMBER',
      message: 'Invalid tracking number format',
    });
    return;
  }

  try {
    // Build straight from env instead of resolving the provider from req.scope
    // (unreliable in custom routes — same approach as the tracking job).
    const trackingInfo = await getAndreaniClient(logger).getTracking(tracking_number);

    if (!trackingInfo.trazas || trackingInfo.trazas.length === 0) {
      sendError(res, 404, {
        code: 'TRACKING_NOT_FOUND',
        message: 'No tracking information found for this tracking number',
      });
      return;
    }

    const events = getAndreaniTransformer().transformTrackingEvents(trackingInfo.trazas);

    const latest = events[events.length - 1];

    res.status(200).json({
      tracking_number,
      current_status: latest?.status ?? 'unknown',
      current_status_description: latest?.description ?? 'Estado desconocido',
      estimated_delivery_date: trackingInfo.fechaEstimadaEntrega,
      events,
      shipment_info: {
        origin: trackingInfo.origen ?? 'Origen desconocido',
        destination: trackingInfo.destino ?? 'Destino desconocido',
        service_type: trackingInfo.tipoServicio ?? 'unknown',
      },
      last_updated: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Store API: Andreani tracking lookup failed: ${message}`);
    sendError(res, 503, {
      code: 'SERVICE_UNAVAILABLE',
      message: 'Andreani tracking service is currently unavailable',
    });
  }
}
