import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { Logger } from '@medusajs/framework/types';
import { ERP_MODULE } from '../modules/erp';
import type ErpModuleService from '../modules/erp/service';
import { enqueueSaleForOrder } from '../modules/erp/outbox/enqueue-sale';
import {
  readBillingConfirmation,
  resolveSalesTrigger,
} from '../modules/erp/billing-deposito';

/**
 * Trigger ALTERNATIVO de notificación de ventas: el fulfillment.
 *
 * Es para la operativa donde el stock vive repartido entre depósitos y la
 * consolidación se hace a mano en el ERP: facturar al cobrar emitiría el
 * comprobante desde un depósito que todavía no tiene la mercadería. Acá el
 * fulfillment ES la confirmación humana de que la transferencia ya ocurrió.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POR QUÉ EXIGE LA MARCA `order.metadata.erp_billing`
 *
 * `order.fulfillment_created` NO implica que haya intervenido una persona.
 * `andreani-order.ts`, `correo-order.ts` y `own-fleet-order.ts` escuchan
 * `['order.placed','payment.captured']` y llaman `createOrderFulfillmentWorkflow`
 * automáticamente — y encima SIN `location_id`, así que Medusa elige el depósito
 * por su cuenta. Con el auto-fulfill de un carrier prendido, tratar cualquier
 * fulfillment como confirmación humana facturaría a los segundos del checkout
 * desde un depósito arbitrario: exactamente el problema que este trigger existe
 * para resolver.
 *
 * La marca la escribe el gate de `POST /admin/orders/:id/fulfillments`
 * (`api/admin/erp/fulfillment-gate.ts`) recién después de validar cobertura
 * total y depósito. Los subscribers de carrier no pasan por HTTP, así que nunca
 * la dejan. Sin marca válida: no se factura, y queda el log diciendo por qué.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * NUNCA lanza: un fallo acá no puede romper el despacho.
 */
export default async function erpFulfillmentCreatedHandler({
  event,
  container,
}: SubscriberArgs<{ order_id?: string; fulfillment_id?: string; id?: string }>): Promise<void> {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  try {
    const service = container.resolve<ErpModuleService>(ERP_MODULE);
    const config = await service.getActiveConfig();
    if (!config) return;
    if (resolveSalesTrigger(config.settings) !== 'fulfillment_created') return;

    const orderId = event.data.order_id ?? event.data.id ?? null;
    if (!orderId) {
      logger.warn('[erp] order.fulfillment_created sin order_id; no se puede notificar la venta.');
      return;
    }

    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const { data: orders } = (await query.graph({
      entity: 'order',
      fields: ['id', 'metadata'],
      filters: { id: orderId },
    })) as { data: Array<{ id: string; metadata?: Record<string, unknown> | null }> };
    const order = orders[0];
    if (!order) {
      logger.warn(`[erp] order.fulfillment_created: orden ${orderId} no encontrada.`);
      return;
    }

    const confirmation = readBillingConfirmation(order.metadata ?? null);
    if (!confirmation) {
      // Camino esperado del auto-fulfill de carrier. `info` y no `warn`: no es
      // un error, es la política funcionando.
      logger.info(
        `[erp] fulfillment de la orden ${orderId} sin confirmación de depósito facturador: no se factura. ` +
          'Es lo esperado cuando el fulfillment lo creó el auto-fulfill de un carrier y no un operador desde el admin.'
      );
      return;
    }

    await enqueueSaleForOrder(container, {
      config,
      orderId,
      source: 'order.fulfillment_created',
      billingDeposito: confirmation.deposito,
    });
  } catch (error) {
    logger.warn(
      `[erp] subscriber order.fulfillment_created falló (no afecta el despacho): ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

export const config: SubscriberConfig = {
  event: 'order.fulfillment_created',
};
