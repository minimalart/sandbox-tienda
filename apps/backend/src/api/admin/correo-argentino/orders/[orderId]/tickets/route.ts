/**
 * Admin API — generar el envío de Correo Argentino para una orden.
 *
 * POST /admin/correo-argentino/orders/:orderId/tickets
 * Body (opcional): { force?: boolean }
 *
 * Corre `correoGenerateTicketsWorkflow`, que es el ÚNICO camino que crea un
 * envío real en Correo (`POST /orders`). El provider no lo hace: su
 * `createFulfillment()` es un stub, justamente para que no haya dos caminos y
 * una orden termine con doble envío y doble flete.
 *
 * Idempotente por default: si la orden ya tiene ticket, el workflow devuelve el
 * existente con `created: false` sin tocar la API. `force: true` rompe esa
 * idempotencia A PROPÓSITO (regenerar un ticket ya existente) — es un envío más
 * y facturable, así que va explícito en el body y nunca por default.
 */

import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { correoGenerateTicketsWorkflow } from '../../../../../../workflows/correo-generate-tickets';
import { extractErrorMessage } from '../../../../../../modules/correo-argentino-fulfillment/utils/errors';
import { statusForCorreoTicketError } from '../../../_status-for-error';
import { parseOptionalBoolean } from '../../../_input';

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);
  const orderId = req.params.orderId;

  if (!orderId) {
    res.status(400).json({
      error: { code: 'MISSING_ORDER_ID', message: 'orderId es requerido' },
    });
    return;
  }

  const body = (req.body ?? {}) as { force?: unknown };
  // Solo un `true` explícito fuerza: un `force: "quizás"` es `undefined`, no
  // `true`. Nada ambiguo puede terminar creando un envío de más.
  const force = parseOptionalBoolean(body.force) === true;

  try {
    const { result } = await correoGenerateTicketsWorkflow(req.scope).run({
      input: { order_id: orderId, ...(force ? { force: true } : {}) },
    });

    res.status(200).json(result);
  } catch (error) {
    const message = extractErrorMessage(error);
    const { status, code } = statusForCorreoTicketError(message);
    logger.error(
      `[correo-tickets] Generación falló para ${orderId} (${code}): ${message}`
    );
    res.status(status).json({ error: { code, message } });
  }
}
