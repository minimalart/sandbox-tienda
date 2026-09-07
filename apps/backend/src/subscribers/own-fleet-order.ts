/**
 * Flota propia (own_fleet) — auto-fulfillment al pagar/colocar la orden (OPCIONAL).
 *
 * Gateado por `OWN_FLEET_AUTO_FULFILL`. Misma semántica que el flag
 * `ANDREANI_AUTO_FULFILL` de src/subscribers/andreani-order.ts: si no está
 * prendido, el subscriber retorna temprano y no hace nada.
 *
 * El flag ya no se lee de `process.env`: sale de `modules/delivery/settings.ts`,
 * con la precedencia **DB > env > default** de `app-settings`, así que se puede
 * prender desde el admin sin redeploy.
 *
 * EL GATE ES POR TIENDA Y SE EVALÚA AL FINAL, NO EN LA PRIMERA LÍNEA
 * ---------------------------------------------------------------------------
 * Antes la lectura era SINCRÓNICA y estaba arriba de todo, para no pagar un
 * SELECT por cada `order.placed` y `payment.captured` del sitio. El problema es
 * que `resolveSettingSync` sólo ve la fila GLOBAL (está escrito en
 * `app-settings/resolve.ts`), y `OWN_FLEET_AUTO_FULFILL` está declarado
 * `defaultScope: 'site'`: la tienda que lo prendía desde SU pantalla no generaba
 * fulfillments y la que lo apagaba los seguía generando. El descriptor decía una
 * cosa y el código hacía otra, sin un solo error.
 *
 * La alternativa obvia —dejar el gate sincrónico arriba como cortocircuito
 * barato— es justamente EL bug: "la global está apagada" no implica "todas las
 * tiendas están apagadas", así que ese pre-gate se comería el caso que este
 * cambio viene a arreglar.
 *
 * Lo que sí se hace es ORDENAR: el gate va DESPUÉS de la idempotencia, de
 * `classify()` y del hint de flota propia. Todos esos filtros son sobre datos que
 * el graph ya trajo, así que la resolución de tienda + la lectura de
 * `site_setting` (memoizada por scope) sólo se pagan para las órdenes que de
 * verdad son de flota propia y todavía no tienen fulfillment. Es más barato que
 * `correo-order.ts:138-143`, que resuelve el gate apenas vuelve el graph.
 *
 * Lo que NO se puede evitar es el graph: sin leer la orden no hay canal, y sin
 * canal no hay tienda. Ese costo es el mismo que Correo ya aceptó por escrito.
 *
 * PROBLEMA QUE RESUELVE
 * ---------------------------------------------------------------------------
 * El fulfillment de una orden normal NO se crea solo en Medusa. Sin fulfillment
 * nunca se emite `order.fulfillment_created`, y por ende el subscriber
 * src/subscribers/delivery-execution-create.ts nunca crea la DeliveryExecution.
 * Resultado: las compras con envío por FLOTA PROPIA no entran al módulo Delivery.
 *
 * Este subscriber cierra ese hueco: cuando una orden de flota propia se coloca /
 * se captura el pago, crea el Fulfillment nativo de Medusa con el MISMO workflow
 * core que usa Andreani (`createOrderFulfillmentWorkflow`). Eso dispara
 * `order.fulfillment_created` → delivery-execution-create.ts reacciona → crea la
 * DeliveryExecution en 'pending', lista para asignar/rutear en Delivery.
 *
 * NO crea la DeliveryExecution acá: solo el fulfillment. El subscriber existente
 * reacciona al evento. (Mismo principio de separación que andreani-order.ts.)
 *
 * COEXISTENCIA CON ANDREANI (no se pisan)
 * ---------------------------------------------------------------------------
 * - andreani-order.ts maneja Andreani; este subscriber maneja flota propia.
 * - Ambos escuchan los MISMOS eventos y comparten la guarda de IDEMPOTENCIA
 *   ("si la orden ya tiene algún fulfillment, no hago nada"). El primero que
 *   corra crea el fulfillment; el otro ve `fulfillments.length > 0` y aborta.
 * - Además, la CLASIFICACIÓN nos separa por construcción: reusamos `classify()`
 *   de create-delivery-execution.ts, que resuelve Andreani / store_pickup ANTES
 *   que own_fleet. Si la orden es Andreani, `classify()` devuelve
 *   provider_type='andreani' y este subscriber la ignora.
 *
 * DETECCIÓN DE FLOTA PROPIA (sin duplicar heurística)
 * ---------------------------------------------------------------------------
 * Reusamos las MISMAS funciones de src/workflows/create-delivery-execution.ts:
 *   - `classify(shippingMethods, providerId)` → cascada completa
 *     (Andreani service_type/hints → store_pickup → own_fleet explícito → default).
 *   - `hasOwnFleetHint(name, code)` → señal POSITIVA y explícita de flota propia.
 *
 * Exigimos DOS condiciones para actuar:
 *   (a) `classify(...).provider_type === 'own_fleet'`  → descarta Andreani y
 *       store_pickup (retornan antes en la cascada), y
 *   (b) `hasOwnFleetHint(...)` sobre algún shipping method  → señal explícita.
 *
 * La condición (b) es deliberada: el caso 5 (default) de `classify()` también
 * devuelve own_fleet por descarte. NO queremos auto-fulfillar órdenes ambiguas
 * (un método genérico/desconocido podría ser Andreani mal etiquetado o pickup
 * sin hint). Sólo disparamos ante una shipping option dedicada a flota propia
 * ('flota' / 'own_fleet' / 'own-fleet'). Pickup queda excluido tanto por (a)
 * —store_pickup ≠ own_fleet— como por (b) —no matchea hasOwnFleetHint—.
 *
 * EVENTOS (Medusa v2)
 * ---------------------------------------------------------------------------
 * Escucha `order.placed` (payload = order id) y `payment.captured` (payload =
 * payment id → se resuelve a la orden con resolveOrderIdFromPayment, mismo
 * camino que erp-payment-captured.ts). La pata de captura es la segunda
 * oportunidad para flujos de captura asíncrona (el webhook de MercadoPago
 * captura después de `order.placed`); la idempotencia evita duplicar. Ojo:
 * `order.payment_captured` era el nombre v1 — en Medusa 2.x no lo emite nadie.
 *
 * Idempotente: si la orden ya tiene un fulfillment, no hace nada.
 *
 * ACTIVAR: Delivery → Operación → "Auto-fulfillment de flota propia", o la env
 * var `OWN_FLEET_AUTO_FULFILL=true`.
 */

import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { Logger, MedusaContainer } from '@medusajs/framework/types';
import { createOrderFulfillmentWorkflow } from '@medusajs/core-flows';
import {
  classify,
  hasOwnFleetHint,
} from '../workflows/create-delivery-execution';
import { resolveOrderIdFromPayment } from '../utils/order-from-payment';
import { resolveSiteViaSql } from '../lib/multistore/resolve-site-sql';
import {
  isOwnFleetAutoFulfillEnabledForSite,
  type PgRawConnection,
} from '../modules/delivery/settings';

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

export default async function handleOwnFleetAutoFulfill({
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

  // Misma proyección que andreani-order.ts, más los campos que necesita
  // classify() del shipping method (name, data, shipping_option_id).
  const { data: orders } = await query.graph({
    entity: 'order',
    fields: [
      'id',
      // La tienda dueña de la orden: el flag de auto-fulfillment es POR TIENDA.
      // Mismo campo y mismo motivo que `correo-order.ts:116`.
      'sales_channel_id',
      'items.id',
      'items.quantity',
      'shipping_methods.name',
      'shipping_methods.shipping_option_id',
      'shipping_methods.data',
      'fulfillments.id',
    ],
    filters: { id: orderId },
  });

  const order = orders?.[0];
  if (!order) return;

  // IDEMPOTENCIA: ya fulfilled → no hacemos nada (misma guarda que Andreani; es
  // lo que evita que ambos subscribers se pisen).
  if (order.fulfillments?.length) return;

  const shippingMethods: UnknownRecord[] = Array.isArray(order.shipping_methods)
    ? (order.shipping_methods as UnknownRecord[])
    : [];

  // (a) Clasificación reusada: own_fleet descarta Andreani/store_pickup, que la
  //     cascada de classify() resuelve antes. providerId no aplica acá (no hay
  //     fulfillment todavía), por eso va undefined.
  const classification = classify(shippingMethods, undefined);
  if (classification.provider_type !== 'own_fleet') return;

  // (b) Señal POSITIVA y explícita de flota propia. Evita disparar por el default
  //     por descarte de classify() (órdenes ambiguas) y excluye pickup.
  const isOwnFleet = shippingMethods.some((m) =>
    hasOwnFleetHint(getString(m, 'name'), getString(m?.data, 'code')) ||
    hasOwnFleetHint(getString(m?.data, 'provider'), undefined),
  );
  if (!isOwnFleet) return;

  // El interruptor de ESTA tienda, resuelto desde la ORDEN. Es el arreglo que
  // `andreani-order.ts:130-137` y `correo-order.ts:139-142` ya tienen hecho, y el
  // que `modules/delivery/settings.ts` pedía por escrito.
  //
  // Un fallo de lectura NO puede disparar un fulfillment que nadie pidió, así que
  // se degrada a "apagado": el operador despacha a mano, que es reversible; un
  // auto-fulfill de más no lo es. Misma asimetría que Andreani, y por eso el
  // `catch` corta en vez de seguir con el valor global.
  let autoFulfill = false;
  try {
    const pg = resolvePgConnection(container);
    const resolution = await resolveSiteViaSql(pg, {
      salesChannelId: getString(order, 'sales_channel_id'),
    });
    autoFulfill = await isOwnFleetAutoFulfillEnabledForSite(pg, resolution);
  } catch (error) {
    logger.warn(
      `[own-fleet] No se pudo leer el interruptor de auto-fulfill de la orden ${order.id}: ${
        (error as Error).message
      }. Se asume apagado.`,
    );
    return;
  }
  if (!autoFulfill) return;

  // Mismo shape de input que andreani-order.ts: { order_id, items[{ id, quantity }] }.
  const items = (order.items ?? [])
    .filter(Boolean)
    .map((i: { id: string; quantity: number }) => ({
      id: i.id,
      quantity: Number(i.quantity) || 1,
    }));

  if (items.length === 0) return;

  try {
    const { result } = await createOrderFulfillmentWorkflow(container).run({
      input: { order_id: order.id, items },
    });
    const fulfillmentId =
      isRecord(result) && typeof result.id === 'string' ? result.id : '?';
    logger.info(
      `[own-fleet] fulfillment ${fulfillmentId} creado para orden ${order.id}`,
    );
  } catch (error) {
    logger.error(
      `[own-fleet] Falló el auto-fulfillment de la orden ${order.id}: ${
        (error as Error).message
      }`,
    );
  }
}

export const config: SubscriberConfig = {
  event: ['order.placed', 'payment.captured'],
};
