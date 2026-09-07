/**
 * Admin API — Generar etiqueta Andreani on-demand para una orden.
 *
 * POST /admin/andreani/orders/:orderId/tickets
 *
 * Crea un envío NUEVO en Andreani y guarda el ticket en
 * `order.metadata.andreani_tickets[]`. Devuelve el ticket generado.
 */

import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { andreaniGenerateTicketsWorkflow } from '../../../../../../workflows/andreani-generate-tickets';
import { extractErrorMessage } from '../../../../../../modules/andreani-fulfillment/utils/errors';

// Mapea los prefijos de error del workflow a códigos HTTP.
function statusForError(message: string): { status: number; code: string } {
  const code = message.split(':')[0]?.trim() || 'ANDREANI_ERROR';
  switch (code) {
    case 'ORDER_NOT_FOUND':
      return { status: 404, code };
    case 'ORDER_NOT_PAID':
    case 'ORDER_NOT_FULFILLED':
    case 'ORDER_NOT_ANDREANI':
    case 'PICKUP_LOCATION_NOT_FOUND':
    case 'INVALID_CONTRACT':
      return { status: 400, code };
    case 'PICKUP_LOOKUP_FAILED':
      // Transient Andreani outage/timeout — retryable, not a client error.
      return { status: 503, code };
    default:
      return { status: 500, code };
  }
}

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);
  const orderId = req.params.orderId;

  if (!orderId) {
    res
      .status(400)
      .json({ error: { code: 'MISSING_ORDER_ID', message: 'orderId is required' } });
    return;
  }

  try {
    const { result } = await andreaniGenerateTicketsWorkflow(req.scope).run({
      input: { order_id: orderId },
    });

    res.status(200).json(result);
  } catch (error) {
    const message = extractErrorMessage(error);
    const { status, code } = statusForError(message);
    logger.error(`[andreani-tickets] Generación falló para ${orderId}: ${message}`);
    res.status(status).json({ error: { code, message } });
  }
}
