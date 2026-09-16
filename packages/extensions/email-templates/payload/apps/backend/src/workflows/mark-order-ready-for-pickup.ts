import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import type {
  INotificationModuleService,
  IOrderModuleService,
  Logger,
  MedusaContainer,
} from '@medusajs/framework/types';
import { buildPickupContext } from '../modules/email/pickup-context';
import { sendWhatsappOrderNotification } from '../lib/whatsapp/send-order-notification';
import { getEmailTemplateSettings } from '../modules/email/settings';

/**
 * mark-order-ready-for-pickup — marca una orden de retiro como lista y avisa al
 * cliente UNA sola vez, por mail y por WhatsApp.
 *
 * Los dos canales salen de ACÁ y no de un subscriber propio, justamente para que
 * compartan el gate: `order.fulfillment_created` —el candidato obvio— no sirve,
 * porque los carriers crean fulfillments solos (ver `own-fleet-order.ts` y el
 * flag `autoFulfill`) y el aviso saldría a los segundos del checkout, con la
 * mercadería todavía sin llegar al local. Un WhatsApp con su propio disparador
 * además se desincroniza del mail: llega uno y no el otro.
 *
 * Hay DOS puertas para esta acción y las dos entran por acá:
 *  1. El botón "Marcar listo para retirar" del widget de la orden
 *     (`POST /admin/orders/:id/ready-for-pickup`). Es el camino principal: una
 *     pantalla, un click, y no depende de que exista un fulfillment.
 *  2. La transición de la ejecución de entrega a `at_pickup_point` desde la
 *     pantalla de delivery, que emite `delivery.store_pickup_ready` y despierta
 *     al subscriber `store-pickup-ready-email`.
 *
 * El criterio de aceptación es "se envía una sola vez", y eso NO lo puede
 * garantizar ninguna de las dos puertas por separado: alguien que marque desde
 * el widget y después mueva el estado en delivery pasaría por las dos. El gate
 * es un dato de la ORDEN —`metadata.ready_for_pickup_at`— justamente porque es
 * el único lugar que las dos ven.
 *
 * Por qué se SELLA ANTES de mandar: si se mandara primero y el sellado fallara,
 * el reintento manda un segundo mail. Al revés, el peor caso es una orden
 * marcada cuyo mail no salió — visible en el widget, y recuperable a mano. Un
 * mail de menos se arregla; uno de más ya llegó.
 */

export type MarkReadyForPickupSource = 'admin-widget' | 'delivery-transition';

export type MarkReadyForPickupResult = {
  status: 'sent' | 'already_sent' | 'not_pickup' | 'no_email' | 'not_found';
  ready_for_pickup_at?: string;
  /** Sucursal resuelta, para que el llamador pueda mostrarla. */
  store_name?: string;
};

type UnknownRecord = Record<string, unknown>;

type OrderRow = {
  id: string;
  display_id?: number | null;
  email?: string | null;
  sales_channel_id?: string | null;
  metadata?: UnknownRecord | null;
  customer?: { first_name?: string | null; last_name?: string | null } | null;
  shipping_methods?: UnknownRecord[];
  items?: Array<{ title?: string | null; variant_id?: string | null }>;
};

const ORDER_FIELDS = [
  'id',
  'display_id',
  'email',
  // Sin el canal, el provider resuelve el branding de la fila GLOBAL y el mail
  // sale con el logo de otra tienda. Mismo motivo que en order-placed-email.
  'sales_channel_id',
  'metadata',
  'customer.first_name',
  'customer.last_name',
  'shipping_methods.name',
  'shipping_methods.data',
];

/** La marca de tiempo del sellado, o `null` si la orden todavía no se marcó. */
export function readyForPickupAt(metadata: unknown): string | null {
  if (typeof metadata !== 'object' || metadata === null) return null;
  const value = (metadata as UnknownRecord).ready_for_pickup_at;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export async function markOrderReadyForPickup(
  container: MedusaContainer,
  input: { orderId: string; source: MarkReadyForPickupSource },
): Promise<MarkReadyForPickupResult> {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve<{
    graph: (input: unknown) => Promise<{ data: unknown[] }>;
  }>(ContainerRegistrationKeys.QUERY);

  const { data: orders } = (await query.graph({
    entity: 'order',
    fields: ORDER_FIELDS,
    filters: { id: input.orderId },
  })) as { data: OrderRow[] };

  const order = orders?.[0];
  if (!order) return { status: 'not_found' };

  const already = readyForPickupAt(order.metadata);
  if (already) {
    logger.info(
      `[ready-for-pickup] Orden ${order.id} ya estaba marcada el ${already} — no se reenvía (entrada: ${input.source}).`,
    );
    return { status: 'already_sent', ready_for_pickup_at: already };
  }

  // Sin stock: el mail al cliente no lleva inventario, y pedirlo sería una
  // consulta por orden para un dato que nadie mira.
  const pickup = await buildPickupContext(container, order, { withStock: false });
  if (!pickup) {
    logger.warn(
      `[ready-for-pickup] Orden ${order.id} no es de retiro en tienda — no se marca (entrada: ${input.source}).`,
    );
    return { status: 'not_pickup' };
  }

  const nowIso = new Date().toISOString();
  const orderModuleService = container.resolve<IOrderModuleService>(Modules.ORDER);
  await orderModuleService.updateOrders([
    {
      id: order.id,
      // El spread conserva TODO lo demás de la metadata: ahí viven `store_id`
      // (la sucursal elegida) y los tickets de los carriers. `updateOrders`
      // REEMPLAZA el objeto entero, no mergea.
      metadata: {
        ...(order.metadata ?? {}),
        ready_for_pickup_at: nowIso,
        ready_for_pickup_source: input.source,
      },
    },
  ]);

  // El WhatsApp va ACÁ, después del sellado y ANTES del guard de email: no
  // cuelga de que la orden tenga mail. Una orden de invitado con teléfono y sin
  // mail tiene que recibir el aviso igual. El helper resuelve el teléfono solo y
  // nunca propaga; si no hay plantilla configurada ni binding publicado en el
  // admin, el provider loguea el skip y el aviso sale sólo por mail.
  await sendWhatsappOrderNotification(container, {
    orderId: order.id,
    template: 'order-ready-for-pickup',
    extraData: {
      store_name: pickup.pickup_store?.name,
      store_address: pickup.pickup_store?.address,
    },
  });

  if (!order.email) {
    logger.warn(
      `[ready-for-pickup] Orden ${order.id} marcada pero SIN email de cliente — no se envía el aviso por mail.`,
    );
    return {
      status: 'no_email',
      ready_for_pickup_at: nowIso,
      store_name: pickup.pickup_store?.name,
    };
  }

  const customerName = [order.customer?.first_name, order.customer?.last_name]
    .filter(Boolean)
    .join(' ')
    .trim();

  const notificationService = container.resolve<INotificationModuleService>(Modules.NOTIFICATION);
  try {
    await notificationService.createNotifications({
      to: order.email,
      channel: 'email',
      template: 'order-ready-for-pickup',
      data: {
        order_id: order.id,
        display_id: order.display_id ?? undefined,
        sales_channel_id: order.sales_channel_id ?? undefined,
        customer_name: customerName || undefined,
        pickup_store: pickup.pickup_store,
        // Se duplican fuera de `pickup_store` para que una fila de la base pueda
        // escribir `{{#each pickup_hours}}` sin bajar un nivel.
        pickup_hours: pickup.pickup_store?.hours ?? [],
        pickup_instructions: getEmailTemplateSettings().pickupInstructions || undefined,
        recipient_type: 'customer',
      },
    });
  } catch (error) {
    // La orden YA quedó marcada. Se loguea y no se revierte el sellado: revertirlo
    // reabriría la puerta a un segundo mail, que es justo lo que el gate evita.
    logger.warn(
      `[ready-for-pickup] Orden ${order.id} marcada, pero el aviso a ${order.email} falló: ${(error as Error).message}`,
    );
  }

  logger.info(
    `[ready-for-pickup] Orden ${order.id} marcada como lista para retirar en ${pickup.pickup_store?.name ?? 'sucursal desconocida'} (entrada: ${input.source}).`,
  );

  return {
    status: 'sent',
    ready_for_pickup_at: nowIso,
    store_name: pickup.pickup_store?.name,
  };
}

export default markOrderReadyForPickup;
