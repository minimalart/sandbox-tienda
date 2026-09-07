/**
 * Admin API — Tracking en tiempo real de un envío Andreani.
 *
 * GET /admin/andreani/tracking/:tracking_number
 *
 * Resuelve el provider Andreani del container (mismo patrón que el endpoint store)
 * y delega a client.getTracking(). Devuelve eventos normalizados.
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

  // El store usa regex estricto — mantenemos misma validación
  if (!/^[A-Z0-9]{8,20}$/.test(tracking_number)) {
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
      // Devolvemos 200 con array vacío para que la UI pueda mostrar "sin eventos"
      res.status(200).json({
        tracking_number,
        current_status: 'pending',
        current_status_description: 'Sin movimientos registrados',
        events: [],
        last_updated: new Date().toISOString(),
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
        origin: trackingInfo.origen ?? '',
        destination: trackingInfo.destino ?? '',
        service_type: trackingInfo.tipoServicio ?? '',
      },
      last_updated: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Admin API: Andreani tracking lookup failed: ${message}`);
    sendError(res, 503, {
      code: 'SERVICE_UNAVAILABLE',
      message: 'Andreani tracking service is currently unavailable',
    });
  }
}
