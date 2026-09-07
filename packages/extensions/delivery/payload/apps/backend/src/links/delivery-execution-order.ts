import OrderModule from '@medusajs/medusa/order';
import { defineLink } from '@medusajs/framework/utils';
import DeliveryModule from '../modules/delivery';

/**
 * DeliveryExecution ↔ Order.
 *
 * Una Order puede tener varias ejecuciones (fulfillments parciales → una
 * DeliveryExecution por fulfillment), por eso el lado execution es `isList: true`
 * y el lado order `isList: false`. La Order NO se copia: sus items, direcciones y
 * montos se leen en vivo con query.graph a través de este link.
 *
 * Query traversal:
 *  - `order.delivery_executions` → las ejecuciones operativas de la orden.
 *  - `delivery_execution.order` → la orden dueña (para leer dirección/items).
 */
export default defineLink(
  {
    linkable: DeliveryModule.linkable.deliveryExecution,
    isList: true,
  },
  {
    linkable: OrderModule.linkable.order,
    isList: false,
  },
  {
    database: {
      table: 'delivery_execution_order',
      idPrefix: 'dexecord',
    },
  },
);
