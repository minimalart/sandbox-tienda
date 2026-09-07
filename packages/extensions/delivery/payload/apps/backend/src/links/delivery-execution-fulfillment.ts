import FulfillmentModule from '@medusajs/medusa/fulfillment';
import { defineLink } from '@medusajs/framework/utils';
import DeliveryModule from '../modules/delivery';

/**
 * DeliveryExecution ↔ Fulfillment (1:1). KEYSTONE de la capa de ejecución.
 *
 * Cada DeliveryExecution es el sidecar operativo de exactamente un Fulfillment
 * de Medusa, y cada Fulfillment tiene a lo sumo una ejecución. Por eso ambos
 * lados llevan `isList: false`.
 *
 * Query traversal:
 *  - `delivery_execution.fulfillment` → el Fulfillment (verdad comercial:
 *    shipped_at / delivered_at / items / labels).
 *  - `fulfillment.delivery_execution` → su ejecución operativa.
 */
export default defineLink(
  {
    linkable: DeliveryModule.linkable.deliveryExecution,
    isList: false,
  },
  {
    linkable: FulfillmentModule.linkable.fulfillment,
    isList: false,
  },
  {
    database: {
      table: 'delivery_execution_fulfillment',
      idPrefix: 'dexecful',
    },
  },
);
