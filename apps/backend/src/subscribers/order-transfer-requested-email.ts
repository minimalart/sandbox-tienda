import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import type {
  INotificationModuleService,
  IOrderModuleService,
  Logger,
} from '@medusajs/framework/types';

import { defaultStorefrontUrl } from '../lib/reset-link';
import {
  type OrderChangeActionForTransfer,
  buildTransferAcceptLink,
  pickTransferDetails,
} from '../lib/order-transfer-link';

type OrderRow = {
  id: string;
  display_id?: number | null;
  sales_channel_id?: string | null;
  created_at?: string | Date | null;
};

/**
 * Manda el link con el que se confirma la vinculación de un pedido hecho como
 * invitado. Escucha `order.transfer_requested` (`OrderWorkflowEvents.TRANSFER_REQUESTED`).
 *
 * ── EL AGUJERO QUE CIERRA (DESDEELSUR-61) ────────────────────────────────────
 *
 * El botón "Vincular a mi cuenta" de `/account/orders` ya existía y ya funcionaba:
 * llamaba a `requestOrderTransfer`, el core creaba el order change con el token y
 * emitía este evento. La página que lo acepta también existía
 * (`order/[id]/transfer/[token]/accept`). Lo único que no existía era ESTO — nadie
 * escuchaba el evento, así que el mail con el link no salía nunca.
 *
 * Y el storefront igual mostraba "Te mandamos un mail: confirmá el enlace y el
 * pedido aparece acá". El flujo entero quedaba trabado en un cartel verde que
 * afirmaba algo que no había pasado.
 *
 * ── EL TOKEN NO VIENE EN EL EVENTO ───────────────────────────────────────────
 *
 * El payload es `{ id, order_change_id }` y nada más. El token vive en la acción
 * `TRANSFER_CUSTOMER` del order change, en `details.token`, junto con
 * `details.original_email`. La lectura está en `lib/order-transfer-link.ts`,
 * testeada aparte: es la parte que se rompe sin hacer ruido.
 *
 * ── A QUIÉN SE LE MANDA, Y POR QUÉ NO AL QUE RECLAMA ─────────────────────────
 *
 * A `original_email`, el email de LA ORDEN. Quien pide la vinculación puede ser
 * cualquiera que haya registrado una cuenta con ese mail; la confirmación le
 * llega a la dueña del pedido, y sin ese click no pasa nada. Mandarlo al que
 * reclama convertiría el flujo en apropiación con un solo click, y volvería
 * inútiles los tres candados de `lib/shared/claimable-orders.ts`.
 *
 * Best-effort, como todos los emisores de mail de este repo: cualquier fallo se
 * loguea y nunca se propaga al event bus.
 */
export default async function handleOrderTransferRequestedEmail({
  event,
  container,
}: SubscriberArgs<{ id?: string; order_change_id?: string }>) {
  const orderId = event.data?.id;
  const orderChangeId = event.data?.order_change_id;
  if (!orderId || !orderChangeId) return;

  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);

  try {
    const orderService = container.resolve<IOrderModuleService>(Modules.ORDER);
    const actions = (await orderService.listOrderChangeActions({
      order_change_id: orderChangeId,
    })) as OrderChangeActionForTransfer[];

    const transfer = pickTransferDetails(actions);
    if (!transfer) {
      // No es un caso esperado: el core acaba de crear la acción con el token.
      // Si pasa, el mail no se puede armar y el cliente queda esperando un link
      // que no existe — que es exactamente el bug original. Se loguea fuerte.
      logger.warn(
        `[Order Transfer] el order change ${orderChangeId} de la orden ${orderId} no tiene una acción ` +
          'TRANSFER_CUSTOMER con token y email: no se puede mandar el link de confirmación.',
      );
      return;
    }

    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const { data: orders } = (await query.graph({
      entity: 'order',
      // `sales_channel_id` es el eje de tienda del mail: sin él, el provider cae
      // en las plantillas y el branding GLOBALES. Ver `email/db-template-pick.ts`.
      fields: ['id', 'display_id', 'sales_channel_id', 'created_at'],
      filters: { id: orderId },
    })) as { data: OrderRow[] };
    const order = orders?.[0];

    const link = buildTransferAcceptLink(defaultStorefrontUrl(), orderId, transfer.token);

    const notificationService = container.resolve<INotificationModuleService>(Modules.NOTIFICATION);
    await notificationService.createNotifications({
      to: transfer.original_email,
      channel: 'email',
      template: 'order-transfer-request',
      data: {
        link_vinculacion: link,
        display_id: order?.display_id ?? undefined,
        order_date: order?.created_at ? new Date(order.created_at).toISOString() : undefined,
        // El mail dice a qué cuenta se vincularía sólo cuando la solicitud pidió
        // cambiar el email; si no, no hay nada verificado que mostrar.
        claiming_email: transfer.new_email ?? undefined,
        sales_channel_id: order?.sales_channel_id ?? undefined,
      },
    });
  } catch (error) {
    logger.warn(
      `[Order Transfer] no se pudo mandar el link de vinculación de la orden ${orderId}: ${
        (error as Error).message
      }`,
    );
  }
}

export const config: SubscriberConfig = {
  event: 'order.transfer_requested',
};
