/**
 * (M0) Reconcilia el estado operativo con la verdad comercial de Medusa.
 *
 * El Fulfillment de Medusa es la fuente de verdad del estado comercial. Cuando
 * Medusa marca un fulfillment como entregado o cancelado (vía sus propios
 * workflows / admin / job de tracking), forzamos la DeliveryExecution linkeada
 * al estado terminal correspondiente. Así la capa operativa nunca queda
 * desincronizada de lo comercial.
 *
 * Eventos escuchados (verificados contra core-flows / @medusajs/utils):
 *  - `delivery.created`            → entregado. Payload { id, no_notification }
 *                                     donde `id` es el FULFILLMENT id
 *                                     (FulfillmentWorkflowEvents.DELIVERY_CREATED,
 *                                     emitido por markOrderFulfillmentAsDeliveredWorkflow).
 *  - `order.fulfillment_canceled`  → cancelado. Payload { order_id,
 *                                     fulfillment_id, no_notification }
 *                                     (OrderWorkflowEvents.FULFILLMENT_CANCELED,
 *                                     emitido por cancelOrderFulfillmentWorkflow).
 *
 * Idempotente: si la ejecución ya está en el terminal pedido, no hace nada
 * (service.transition es no-op cuando from === to).
 */

import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { Logger } from '@medusajs/framework/types';
import { DELIVERY_MODULE } from '../modules/delivery';
import type DeliveryModuleService from '../modules/delivery/service';

type ReconcileEventData = {
  /** delivery.created → fulfillment id. */
  id?: string;
  /** order.fulfillment_canceled → fulfillment id. */
  fulfillment_id?: string;
};

const TERMINAL_BY_EVENT: Record<string, 'delivered' | 'canceled'> = {
  'delivery.created': 'delivered',
  'order.fulfillment_canceled': 'canceled',
};

export default async function handleDeliveryExecutionReconcile({
  event,
  container,
}: SubscriberArgs<ReconcileEventData>) {
  const targetStatus = TERMINAL_BY_EVENT[event.name];
  if (!targetStatus) return;

  const fulfillmentId = event.data?.fulfillment_id ?? event.data?.id;
  if (!fulfillmentId) return;

  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  // Resolver la ejecución linkeada al fulfillment vía query.graph.
  const { data: fulfillments } = await query.graph({
    entity: 'fulfillment',
    fields: ['id', 'delivery_execution.id', 'delivery_execution.status'],
    filters: { id: fulfillmentId },
  });

  const execution = fulfillments?.[0]?.delivery_execution as
    | { id?: string; status?: string }
    | undefined;
  const executionId = execution?.id;
  if (!executionId) return; // No hay sidecar para este fulfillment.

  // Ya en el terminal pedido → nada que hacer.
  if (execution?.status === targetStatus) return;

  const service = container.resolve<DeliveryModuleService>(DELIVERY_MODULE);

  try {
    await service.transition(executionId, targetStatus, { event: event.data });
    logger.info(
      `[delivery] DeliveryExecution ${executionId} reconciliada a '${targetStatus}' por evento '${event.name}' (fulfillment ${fulfillmentId}).`,
    );
  } catch (error) {
    logger.error(
      `[delivery] No se pudo reconciliar DeliveryExecution ${executionId} a '${targetStatus}': ${
        (error as Error).message
      }`,
    );
  }
}

export const config: SubscriberConfig = {
  event: ['delivery.created', 'order.fulfillment_canceled'],
};
