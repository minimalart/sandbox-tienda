import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { Logger } from '@medusajs/framework/types';
import { evaluateCustomerMembershipWorkflow } from '../workflows/evaluate-customer-membership';

/**
 * Tiempo real: ante una compra o un alta/actualización de cliente, reevalúa al
 * cliente afectado contra todos los grupos dinámicos activos y lo agrega/quita
 * de los customer_groups nativos al instante.
 */
export default async function dynamicGroupsSyncHandler({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);

  try {
    let customerId: string | undefined;

    if (event.name === 'order.placed') {
      const query = container.resolve<{
        graph: (input: unknown) => Promise<{ data: Array<{ customer_id?: string }> }>;
      }>(ContainerRegistrationKeys.QUERY);
      const { data: orders } = await query.graph({
        entity: 'order',
        fields: ['id', 'customer_id'],
        filters: { id: event.data.id },
      });
      customerId = orders[0]?.customer_id ?? undefined;
    } else {
      // customer.created | customer.updated → el id es del cliente.
      customerId = event.data.id;
    }

    if (!customerId) return;

    await evaluateCustomerMembershipWorkflow(container).run({
      input: { customer_id: customerId },
    });
  } catch (error) {
    logger.warn(
      `[DynamicGroups] No se pudo reevaluar membresía (${event.name}): ${(error as Error).message}`,
    );
  }
}

export const config: SubscriberConfig = {
  event: ['order.placed', 'customer.created', 'customer.updated'],
};
