import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { Logger } from '@medusajs/framework/types';
import {
  markOrderReadyForPickup,
  readyForPickupAt,
} from '../../../../../workflows/mark-order-ready-for-pickup';
import { buildPickupContext } from '../../../../../modules/email/pickup-context';
import { orderIdsInSite } from '../../../_order-site-scope';

/**
 * La orden pertenece a la tienda activa (o no hay tienda activa, que es el
 * comportamiento mono-tienda de siempre).
 *
 * `siteFromRequest` NO deriva la tienda del `orderId` a propósito: si lo hiciera,
 * la pantalla de detalle "estaría de acuerdo" con la fila que muestra y taparía
 * justo el caso que hay que ver — una orden de otra tienda. Por eso el eje sale
 * de lo que eligió el operador y acá se COMPARA contra el canal de la orden.
 *
 * Devuelve 404 y no 403: decir "es de otra tienda" confirma que la orden existe.
 * Misma política que `assertIdInSite` y que `ORDER_NOT_IN_SITE`.
 */
async function orderIsInActiveSite(
  req: AuthenticatedMedusaRequest,
  orderId: string,
): Promise<boolean> {
  const own = await orderIdsInSite(req, [orderId]);
  return own === null || own.has(orderId);
}

/**
 * Estado y acción de "listo para retirar" de una orden.
 *
 * GET  → qué mostrar en el widget: si la orden es de retiro, en qué sucursal y
 *        si ya se avisó. El widget no puede deducirlo de la orden sola porque la
 *        sucursal vive en `metadata.store_id` y el nombre en otro módulo.
 * POST → marca y avisa. Idempotente: la segunda llamada devuelve 409 con la
 *        fecha del aviso original en vez de mandar un segundo mail.
 *
 * El 409 es deliberado y NO es un error del operador: es la respuesta correcta a
 * "esto ya pasó". El widget lo muestra como estado, no como falla.
 */

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  const query = req.scope.resolve<{
    graph: (input: unknown) => Promise<{ data: unknown[] }>;
  }>(ContainerRegistrationKeys.QUERY);

  const orderId = req.params.id;
  if (!orderId) return res.status(400).json({ message: 'Falta el id del pedido.' });
  if (!(await orderIsInActiveSite(req, orderId))) {
    return res.status(404).json({ message: 'Pedido no encontrado.' });
  }

  const { data } = await query.graph({
    entity: 'order',
    fields: ['id', 'metadata', 'shipping_methods.name', 'shipping_methods.data'],
    filters: { id: orderId },
  });
  const order = data[0] as
    | { id: string; metadata?: Record<string, unknown> | null }
    | undefined;
  if (!order) return res.status(404).json({ message: 'Pedido no encontrado.' });

  const pickup = await buildPickupContext(req.scope, order, { withStock: false });
  const markedAt = readyForPickupAt(order.metadata);

  return res.json({
    is_store_pickup: Boolean(pickup),
    store_name: pickup?.pickup_store?.name ?? null,
    store_address: pickup?.pickup_store?.address ?? null,
    ready_for_pickup_at: markedAt,
  });
}

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve<Logger>(ContainerRegistrationKeys.LOGGER);

  const orderId = req.params.id;
  if (!orderId) return res.status(400).json({ message: 'Falta el id del pedido.' });
  // El POST manda un mail REAL a un comprador. Gatear sólo el GET dejaría abierta
  // justo la puerta que tiene efecto afuera.
  if (!(await orderIsInActiveSite(req, orderId))) {
    return res.status(404).json({ message: 'Pedido no encontrado.' });
  }

  let result: Awaited<ReturnType<typeof markOrderReadyForPickup>>;
  try {
    result = await markOrderReadyForPickup(req.scope, {
      orderId,
      source: 'admin-widget',
    });
  } catch (error) {
    logger.error(
      `[ready-for-pickup] Falló al marcar la orden ${orderId}: ${(error as Error).message}`,
    );
    return res.status(500).json({ message: 'No se pudo marcar el pedido como listo para retirar.' });
  }

  switch (result.status) {
    case 'not_found':
      return res.status(404).json({ message: 'Pedido no encontrado.' });
    case 'not_pickup':
      return res.status(422).json({
        message: 'Este pedido no es de retiro en tienda.',
      });
    case 'already_sent':
      return res.status(409).json({
        message: 'Este pedido ya fue marcado como listo para retirar.',
        ready_for_pickup_at: result.ready_for_pickup_at,
      });
    case 'no_email':
      // 200 y no un error: la orden QUEDÓ marcada, que es lo que pidió el
      // operador. Lo que falta es un dato del comprador, y decirlo es más útil
      // que devolver un 500 que sugiere que la acción no se aplicó.
      return res.status(200).json({
        message: 'Pedido marcado, pero no tiene email de cliente: no se envió el aviso.',
        ready_for_pickup_at: result.ready_for_pickup_at,
        email_sent: false,
      });
    default:
      return res.status(200).json({
        message: `Pedido marcado como listo para retirar${result.store_name ? ` en ${result.store_name}` : ''}.`,
        ready_for_pickup_at: result.ready_for_pickup_at,
        email_sent: true,
      });
  }
}
