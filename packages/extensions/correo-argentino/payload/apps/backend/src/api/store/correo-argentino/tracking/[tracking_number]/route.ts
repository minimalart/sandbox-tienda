/**
 * Store API — seguimiento de un envío de Correo Argentino.
 *
 * GET /store/correo-argentino/tracking/:tracking_number
 *
 * Consulta on-demand. El avance automático del estado de la orden lo hace el
 * job `sync-correo-tracking-status`; esto es para que el comprador vea el
 * detalle.
 *
 * ⚠️ **Es el endpoint más frágil del contrato de Correo, y por una razón concreta:**
 * el manual documenta `GET /v1/tracking` con un **array como CUERPO de un GET**,
 * y el cliente del módulo hace otra cosa: manda los TNs como **query param
 * repetido** (`?trackingNumbers=A&trackingNumbers=B`), asumiendo que el gateway
 * descarta el body de un GET. Es una **INFERENCIA (sin verificar)** — nunca se
 * ejercitó contra la API real.
 *
 * **PENDIENTE DE VERIFICAR EN QA, y es lo primero de la lista**: si la
 * inferencia está mal, el sync de tracking no funciona y el síntoma es
 * silencioso (los envíos se crean bien y nunca actualizan estado). Las dos
 * formas posibles y el único lugar donde se cambia están en
 * `paqar-client.ts::buildTrackingParams()` / `getTracking()`.
 */

import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { getCorreoPaqarClient } from '../../../../../modules/correo-argentino-fulfillment/get-client';
import { normalizeCorreoTrackingItem } from '../../../../../modules/correo-argentino-fulfillment/normalizers/tracking-status';
import { extractErrorMessage } from '../../../../../modules/correo-argentino-fulfillment/utils/errors';
import { sendCorreoStoreError } from '../../_shared';

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);
  const trackingNumber = String(req.params.tracking_number ?? '').trim();

  if (!trackingNumber) {
    sendCorreoStoreError(res, 400, {
      code: 'MISSING_TRACKING_NUMBER',
      message: 'El tracking number es requerido',
    });
    return;
  }

  // Máx 30 chars y único por agreement es todo lo que el manual define; el
  // formato depende de lo que se pacte. La validación es deliberadamente laxa:
  // un regex estricto rechazaría TNs legítimos con un 400 confuso.
  if (trackingNumber.length > 30 || !/^[A-Za-z0-9._-]+$/.test(trackingNumber)) {
    sendCorreoStoreError(res, 400, {
      code: 'INVALID_TRACKING_NUMBER',
      message: 'Formato de tracking number inválido',
    });
    return;
  }

  try {
    const items = await getCorreoPaqarClient(logger).getTracking([
      trackingNumber,
    ]);

    const raw = items[0];
    if (!raw) {
      sendCorreoStoreError(res, 404, {
        code: 'TRACKING_NOT_FOUND',
        message: 'No hay información de seguimiento para este envío',
      });
      return;
    }

    const tracking = normalizeCorreoTrackingItem(raw, logger);

    // ⚠️ Un TN inexistente NO da error en Correo: devuelve 200 con
    // `{ quantity: 0, event: [] }`. Sin este chequeo, un TN inventado
    // respondería 200 con un timeline vacío como si fuera un envío válido
    // recién creado.
    if (!tracking.has_history) {
      sendCorreoStoreError(res, 404, {
        code: 'TRACKING_NOT_FOUND',
        message:
          'El envío todavía no tiene movimientos registrados en Correo Argentino',
      });
      return;
    }

    res.status(200).json({
      tracking_number: tracking.tracking_number ?? trackingNumber,
      current_status: tracking.status ?? 'unknown',
      current_status_description: tracking.latest?.raw_status ?? 'Sin estado',
      product_type: tracking.product_type,
      events: tracking.events,
      last_updated: new Date().toISOString(),
    });
  } catch (error) {
    const message = extractErrorMessage(error);
    logger.error(`[correo-tracking] Lookup de ${trackingNumber} falló: ${message}`);
    sendCorreoStoreError(res, 503, {
      code: 'SERVICE_UNAVAILABLE',
      message: 'El seguimiento de Correo Argentino no está disponible',
    });
  }
}
