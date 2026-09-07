/**
 * Andreani — auto-fulfillment al pagar (OPCIONAL).
 *
 * Gateado por "Fulfillment automático al pagar" (`ANDREANI_AUTO_FULFILL`), que es
 * `scope: 'site'`: dos tiendas del mismo backend pueden tener flujos operativos
 * distintos, y una que despacha a mano no puede quedar atada a la decisión de la
 * otra.
 *
 * Por eso el gate ya NO es lo primero que corre. Antes era un `process.env` y podía
 * ir arriba de todo; ahora hay que saber DE QUÉ TIENDA es la orden para leerlo, y
 * eso pide tener la orden. El orden es: resolver la orden → ¿es de Andreani? →
 * recién ahí leer el interruptor de esa tienda. El costo es una query por evento en
 * instalaciones que no usan Andreani; la alternativa —cortar por la config de la
 * instancia— dejaría a una tienda secundaria sin auto-fulfill aunque lo tenga
 * prendido, que es justo el fail-open que la decisión 3 evita.
 *
 * Cuando una orden con envío Andreani
 * se coloca / se captura el pago, crea el fulfillment nativo de Medusa vía
 * `createOrderFulfillmentWorkflow`. Eso dispara el provider Andreani
 * (`createFulfillment`), que genera el envío real y la etiqueta, persistida en
 * `fulfillment.data`.
 *
 * Escucha `order.placed` (payload = order id) y `payment.captured` (payload =
 * payment id → se resuelve a la orden con resolveOrderIdFromPayment). La pata
 * de captura es la segunda oportunidad para flujos de captura asíncrona (el
 * webhook de MercadoPago captura después de `order.placed`); la idempotencia
 * evita duplicar. Ojo: `order.payment_captured` era el nombre v1 — en Medusa
 * 2.x no lo emite nadie.
 *
 * Idempotente: si la orden ya tiene un fulfillment, no hace nada.
 */

import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { Logger } from '@medusajs/framework/types';
import { createOrderFulfillmentWorkflow } from '@medusajs/core-flows';
import { resolveOrderIdFromPayment } from '../utils/order-from-payment';
import { resolveSite } from '../lib/multistore/resolve-site';
import { loadAndreaniSettingsViaPg } from '../modules/andreani-fulfillment/settings';

type UnknownRecord = Record<string, unknown>;

const isRecord = (v: unknown): v is UnknownRecord =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const getString = (source: unknown, key: string): string | undefined => {
  if (!isRecord(source)) return undefined;
  const value = source[key];
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
};

const hasAndreaniHint = (value: string | undefined): boolean => {
  if (!value) return false;
  const n = value.trim().toLowerCase();
  return (
    n.includes('andreani') ||
    n.includes('domicilio') ||
    n.includes('sucursal') ||
    n.includes('punto') ||
    n.includes('hop')
  );
};

export default async function handleAndreaniAutoFulfill({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  if (!event.data.id) return;

  // `payment.captured` trae el id del payment, no de la orden.
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
      // Pista de la tienda: sin esto el interruptor se lee de la instancia.
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

  // Ya fulfilled → idempotente.
  if (order.fulfillments?.length) return;

  // ¿Tiene envío Andreani?
  //
  // ⚠️ Un `carrier` explícito y ajeno descalifica ANTES que cualquier hint. Sin
  // esa guarda, dos de los tres criterios de abajo se llevan puestos los envíos
  // de Correo Argentino: `hasAndreaniHint` matchea "sucursal" y "domicilio"
  // (y la opción de Correo se llama "Retiro en sucursal de Correo Argentino"),
  // y el tercero acepta CUALQUIER `data.service_type` — que Correo también
  // tiene (`CP`/`EP`). El síntoma sería un auto-fulfill de Andreani sobre una
  // orden de Correo.
  const isAndreani = (order.shipping_methods ?? []).some(
    (m: { name?: string; data?: unknown }) => {
      const carrier = getString(m?.data, 'carrier');
      if (carrier && carrier !== 'andreani') return false;

      return (
        hasAndreaniHint(typeof m?.name === 'string' ? m.name : undefined) ||
        hasAndreaniHint(getString(m?.data, 'provider')) ||
        Boolean(getString(m?.data, 'service_type'))
      );
    }
  );
  if (!isAndreani) return;

  // El interruptor de ESTA tienda. Un fallo de lectura NO puede disparar un
  // fulfillment que nadie pidió, así que se degrada a "apagado": el operador
  // despacha a mano, que es reversible; un auto-fulfill de más no lo es.
  let autoFulfill = false;
  try {
    const resolution = await resolveSite(container, {
      salesChannelId: getString(order, 'sales_channel_id') ?? null,
      orderId: order.id,
    });
    const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as unknown as
      | { raw: (sql: string, bindings?: unknown[]) => Promise<{ rows?: unknown[] }> }
      | undefined;
    autoFulfill = (await loadAndreaniSettingsViaPg(pg, resolution)).autoFulfill;
  } catch (error) {
    logger.warn(
      `[andreani-auto] No se pudo leer el interruptor de auto-fulfill de la orden ${order.id}: ${
        (error as Error).message
      }. Se asume apagado.`,
    );
    return;
  }
  if (!autoFulfill) return;

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
      `[andreani-auto] Fulfillment creado automáticamente para orden ${order.id}`
    );
  } catch (error) {
    logger.error(
      `[andreani-auto] Falló el auto-fulfillment de la orden ${order.id}: ${
        (error as Error).message
      }`
    );
  }
}

export const config: SubscriberConfig = {
  event: ['order.placed', 'payment.captured'],
};
