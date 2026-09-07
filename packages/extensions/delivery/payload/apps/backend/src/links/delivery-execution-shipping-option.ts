import FulfillmentModule from '@medusajs/medusa/fulfillment';
import { defineLink } from '@medusajs/framework/utils';
import DeliveryModule from '../modules/delivery';

/**
 * DeliveryExecution ↔ ShippingOption (enriquecimiento operativo).
 *
 * Vincula la ejecución con la ShippingOption elegida para resolver datos del
 * servicio (provider, reglas de zona, tipo) sin duplicarlos. Una ShippingOption
 * puede usarse en muchas ejecuciones, por eso el lado execution es
 * `isList: true`; cada ejecución apunta a una sola opción (`isList: false`).
 *
 * Query traversal:
 *  - `delivery_execution.shipping_option` → la opción de envío usada.
 *  - `shipping_option.delivery_executions` → las ejecuciones que la usaron.
 */
export default defineLink(
  {
    linkable: DeliveryModule.linkable.deliveryExecution,
    isList: true,
  },
  {
    linkable: FulfillmentModule.linkable.shippingOption,
    isList: false,
  },
  {
    database: {
      table: 'delivery_execution_shipping_option',
      idPrefix: 'dexecso',
    },
  },
);
