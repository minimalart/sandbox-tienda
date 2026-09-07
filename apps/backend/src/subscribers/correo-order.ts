/**
 * Correo Argentino — auto-fulfillment al pagar (OPCIONAL).
 *
 * Gateado por `CORREO_ARGENTINO_AUTO_FULFILL=true`. Crea el fulfillment nativo
 * de Medusa vía `createOrderFulfillmentWorkflow` cuando una orden con envío de
 * Correo se coloca o se captura su pago.
 *
 * ⚠️ Esto NO crea el envío en Correo. El `createFulfillment()` del provider es
 * un stub deliberado; el alta real la hace `correo-generate-tickets`, on-demand
 * desde el admin. O sea: este subscriber automatiza el paso administrativo, no
 * el despacho. Es una diferencia importante respecto del subscriber de
 * Andreani, donde el fulfillment nativo sí termina disparando el envío.
 *
 * Idempotente: si la orden ya tiene fulfillment, no hace nada.
 */

import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { Logger, MedusaContainer } from '@medusajs/framework/types';
import { createOrderFulfillmentWorkflow } from '@medusajs/core-flows';
import { resolveOrderIdFromPayment } from '../utils/order-from-payment';
import { resolveSiteViaSql } from '../lib/multistore/resolve-site-sql';
import { extractErrorMessage } from '../modules/correo-argentino-fulfillment/utils/errors';
import {
  loadCorreoOperationSettingsViaPg,
  type PgRawConnection,
} from '../modules/correo-argentino-fulfillment/settings';
import { hasCorreoCarrierToken } from '../modules/delivery/normalizers/correo-argentino';

type UnknownRecord = Record<string, unknown>;

/** `undefined` = sin base a mano; el resolver cae al camino sincrónico. */
function resolvePgConnection(container: MedusaContainer): PgRawConnection | undefined {
  try {
    return container.resolve(
      ContainerRegistrationKeys.PG_CONNECTION,
    ) as unknown as PgRawConnection;
  } catch {
    return undefined;
  }
}

const isRecord = (v: unknown): v is UnknownRecord =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const getString = (source: unknown, key: string): string | undefined => {
  if (!isRecord(source)) return undefined;
  const value = source[key];
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
};

/**
 * True si el auto-fulfillment de Correo está habilitado por ENV.
 *
 * Se conserva como forma PURA del flag (y por sus tests), pero el subscriber ya no
 * la usa: resuelve el flag POR TIENDA con `loadCorreoOperationSettingsViaPg`. Es un
 * flag `scope: 'site'` a propósito — automatizar el fulfillment es una decisión
 * operativa de cada comercio, y una tienda que lo prende no puede prendérselo a las
 * demás.
 */
export const isCorreoAutoFulfillEnabled = (
  env: Record<string, string | undefined> = process.env,
): boolean =>
  env.CORREO_ARGENTINO_AUTO_FULFILL?.trim().toLowerCase() === 'true';

/**
 * ¿Esta orden se despacha por Correo?
 *
 * Detección por `data.carrier` EXPLÍCITO (`CORREO_CARRIER_ID`, lo estampa
 * `validateFulfillmentData()` del provider), NO por hints sobre el nombre de la
 * opción.
 *
 * DELIBERADAMENTE más estricta que `isCorreoShippingMethod()` del workflow de
 * tickets, que además acepta la fulfillment option y el token `\bcorreo\b` del
 * nombre. Acá la asimetría de costos es al revés que allá: un falso NEGATIVO
 * cuesta que el admin cree el fulfillment a mano, mientras que un falso POSITIVO
 * dispararía `createOrderFulfillmentWorkflow` sobre una orden de OTRO carrier —
 * y en Andreani el fulfillment nativo genera el envío real y su flete. Con un
 * envío ya facturado no hay rollback.
 *
 * `hasCorreoCarrierToken` tolera el separador (`correo-argentino` /
 * `correo_argentino` / `correo`) porque el valor lo escriben el provider y el
 * storefront, que no comparten constante. Sigue siendo comparación exacta sobre
 * el valor normalizado: 'andreani' nunca matchea.
 */
export const isCorreoAutoFulfillOrder = (
  shippingMethods: ReadonlyArray<{ data?: unknown }> | undefined | null,
): boolean =>
  (shippingMethods ?? []).some((method) =>
    hasCorreoCarrierToken(getString(method?.data, 'carrier')),
  );

export default async function handleCorreoAutoFulfill({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  if (!event.data?.id) return;

  // `payment.captured` trae el id del payment, no el de la orden.
  const orderId =
    event.name === 'payment.captured'
      ? await resolveOrderIdFromPayment(container, event.data.id)
      : event.data.id;
  if (!orderId) return;

  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  const { data: orders } = await query.graph({
    entity: 'order',
    fields: [
      'id',
      // La tienda dueña de la orden: el flag de auto-fulfillment es POR TIENDA.
      'sales_channel_id',
      'items.id',
      'items.quantity',
      'shipping_methods.*',
      'fulfillments.id',
    ],
    filters: { id: orderId },
  });

  const order = orders?.[0];
  if (!order) return;

  /**
   * El gate se evalúa DESPUÉS del graph, no antes.
   *
   * Antes era un `process.env` al tope de la función, gratis. Ahora el flag es
   * `scope: 'site'` y para saber de qué tienda es la orden hay que leerla. El costo
   * es una query indexada por `order.placed` / `payment.captured` aunque el
   * automatismo esté apagado, que al lado de todo lo demás que corre en esos
   * eventos es ruido. Lo que se compra es que una tienda pueda prenderlo sin
   * prendérselo a todas — que era el modo de falla caro.
   */
  const pg = resolvePgConnection(container);
  const resolution = await resolveSiteViaSql(pg, {
    salesChannelId: order.sales_channel_id ?? undefined,
  });
  const { autoFulfill } = await loadCorreoOperationSettingsViaPg(pg, resolution);
  if (!autoFulfill) return;

  // Ya fulfilled → cortocircuito. Es DEFENSA EN PROFUNDIDAD, no la garantía de
  // idempotencia: la que impide pagar el flete dos veces vive aguas abajo, en
  // `correo-generate-tickets`, que es idempotente por
  // `order.metadata.correo_tickets[]` y devuelve `created: false` si el envío ya
  // existe. No apoyarse en este chequeo para razonar sobre duplicados.
  if (order.fulfillments?.length) return;

  if (!isCorreoAutoFulfillOrder(order.shipping_methods)) return;

  const items = (order.items ?? [])
    .filter(Boolean)
    .map((i: { id: string; quantity: number }) => ({
      id: i.id,
      quantity: Number(i.quantity) || 1,
    }));

  if (items.length === 0) return;

  try {
    await createOrderFulfillmentWorkflow(container).run({
      input: { order_id: order.id, items },
    });
    logger.info(
      `[correo-auto] Fulfillment creado automáticamente para la orden ${order.id}. ` +
        'El envío en Correo se genera aparte, desde el admin.'
    );
  } catch (error) {
    logger.error(
      `[correo-auto] Falló el auto-fulfillment de la orden ${order.id}: ${extractErrorMessage(error)}`
    );
  }
}

export const config: SubscriberConfig = {
  event: ['order.placed', 'payment.captured'],
};
