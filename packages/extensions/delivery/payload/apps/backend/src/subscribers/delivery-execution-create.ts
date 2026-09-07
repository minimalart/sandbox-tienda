/**
 * Crea la DeliveryExecution (sidecar operativo) cuando Medusa crea un
 * Fulfillment.
 *
 * Escucha `order.fulfillment_created` — el evento que emite
 * createOrderFulfillmentWorkflow con payload { order_id, fulfillment_id,
 * no_notification }. Se prefiere a un hipotético `fulfillment.created` porque
 * este es el que efectivamente emiten los workflows core y trae el
 * fulfillment_id directamente.
 *
 * El workflow es idempotente (no crea una segunda ejecución si el fulfillment ya
 * tiene una linkeada), así que reintentos / reenvíos del evento son seguros.
 */

import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { Logger } from '@medusajs/framework/types';
import { createDeliveryExecutionWorkflow } from '../workflows/create-delivery-execution';

export default async function handleDeliveryExecutionCreate({
  event,
  container,
}: SubscriberArgs<{ order_id?: string; fulfillment_id?: string }>) {
  const fulfillmentId = event.data?.fulfillment_id;
  if (!fulfillmentId) return;

  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);

  try {
    const { result } = await createDeliveryExecutionWorkflow(container).run({
      input: { fulfillment_id: fulfillmentId },
    });
    if (result?.created) {
      logger.info(
        `[delivery] DeliveryExecution ${result.execution_id} creada para fulfillment ${fulfillmentId} (${result.provider_type}/${result.service_mode}).`,
      );
    }
  } catch (error) {
    logger.error(
      `[delivery] Falló la creación de DeliveryExecution para fulfillment ${fulfillmentId}: ${
        (error as Error).message
      }`,
    );
  }
}

export const config: SubscriberConfig = {
  event: 'order.fulfillment_created',
};
