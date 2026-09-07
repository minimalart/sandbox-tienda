/**
 * Admin API — seguimiento crudo + normalizado de un envío de Correo.
 *
 * GET /admin/correo-argentino/tracking/:tracking_number
 *
 * A diferencia de la ruta de store, devuelve TAMBIÉN el payload crudo de Correo
 * y los eventos que el normalizador no supo mapear. Es la herramienta con la
 * que se cosecha la tabla real de `statusId`, que Correo no publica: cuando
 * aparece un `bucket: "unknown"`, ahí está el par `statusId` + `status` textual
 * que hay que agregar a `CORREO_KNOWN_STATUS_CODES`.
 */

import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { getCorreoPaqarClient } from '../../../../../modules/correo-argentino-fulfillment/get-client';
import { normalizeCorreoTrackingItem } from '../../../../../modules/correo-argentino-fulfillment/normalizers/tracking-status';
import { extractErrorMessage } from '../../../../../modules/correo-argentino-fulfillment/utils/errors';

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);
  const trackingNumber = String(req.params.tracking_number ?? '').trim();

  if (!trackingNumber) {
    res.status(400).json({
      error: {
        code: 'MISSING_TRACKING_NUMBER',
        message: 'El tracking number es requerido',
      },
    });
    return;
  }

  try {
    const items = await getCorreoPaqarClient(logger).getTracking([
      trackingNumber,
    ]);
    const raw = items[0];

    if (!raw) {
      res.status(404).json({
        error: {
          code: 'TRACKING_NOT_FOUND',
          message: 'Correo no devolvió ningún ítem para este tracking number',
        },
      });
      return;
    }

    const tracking = normalizeCorreoTrackingItem(raw, logger);
    const unmapped = tracking.events.filter(
      (event) => event.bucket === 'unknown'
    );

    res.status(200).json({
      tracking_number: tracking.tracking_number ?? trackingNumber,
      // `has_history: false` NO es 404 acá: para el operador, "el envío existe
      // pero Correo todavía no registró movimientos" es información útil, no un
      // error. En la ruta de store sí es 404, porque para el comprador un
      // timeline vacío es indistinguible de un TN inventado.
      has_history: tracking.has_history,
      status: tracking.status,
      product_type: tracking.product_type,
      latest: tracking.latest,
      events: tracking.events,
      // Lo que el normalizador no supo mapear. Si esto no está vacío, hay
      // códigos nuevos que agregar al normalizador.
      unmapped_events: unmapped.map((event) => ({
        raw_status_id: event.raw_status_id,
        raw_status: event.raw_status,
        occurred_at: event.occurred_at,
      })),
      raw,
      last_updated: new Date().toISOString(),
    });
  } catch (error) {
    const message = extractErrorMessage(error);
    logger.error(
      `[correo-tracking-admin] Lookup de ${trackingNumber} falló: ${message}`
    );
    res.status(503).json({ error: { code: 'SERVICE_UNAVAILABLE', message } });
  }
}
