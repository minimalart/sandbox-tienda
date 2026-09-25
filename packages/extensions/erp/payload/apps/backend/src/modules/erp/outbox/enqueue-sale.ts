import type { Logger, MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { ERP_MODULE } from '../index';
import type ErpModuleService from '../service';
import type { ErpConfigRow } from '../service';
import { getErpAdapter } from '../adapters/registry';
import { getCountryLayer } from '../countries/registry';
import { lookupOrderBillingDeposito } from '../billing-deposito-for-order';
import { buildSalePayload } from './build-sale-payload';

/**
 * Encola la notificación de venta de una orden (idempotente por
 * `sale_created:{provider}:{order_id}`). Compartido por el subscriber de
 * `payment.captured` y el de reconciliación en `order.placed`.
 *
 * Si la notificación está apagada por config/capability, deja una fila
 * `skipped` auditable (esa orden queda conscientemente sin notificar aunque
 * después se prenda el toggle).
 *
 * ── Depósito facturador ──
 *
 * `billingDeposito` viaja en el payload y gana sobre el depósito de la config
 * del provider. Lo manda explícito el trigger por fulfillment, donde un humano
 * confirmó desde qué depósito se despacha.
 *
 * Cuando NO viene explícito —que es el camino de `payment_captured`, el que
 * tiene desdeelsur— se DERIVA acá de la sucursal de retiro que eligió el
 * comprador (`lookupOrderBillingDeposito`). Antes de esto, ese camino mandaba
 * siempre `null` y el adapter caía a la única constante de la configuración:
 * TODAS las órdenes llegaban al ERP con el mismo depósito, eligiera la persona
 * la sucursal que eligiera (DESDEELSUR-61).
 *
 * Se deriva acá y no se lee `metadata.erp_billing_deposito` a propósito: quien
 * escribe esa metadata es un subscriber de `order.placed`, el MISMO evento que
 * dispara `erp-order-placed-reconcile.ts`, que es quien llama a esta función.
 * Dos subscribers sobre un mismo evento no tienen orden garantizado, así que
 * leer la metadata sería una carrera. La derivación no depende de quién corrió
 * primero. El override manual sí se respeta: lo lee el lookup.
 */
export async function enqueueSaleForOrder(
  container: MedusaContainer,
  opts: {
    config: ErpConfigRow;
    orderId: string;
    source: string;
    billingDeposito?: string | null;
  }
): Promise<{ created: boolean; status: string | null }> {
  const { config, orderId, source, billingDeposito } = opts;
  const service = container.resolve<ErpModuleService>(ERP_MODULE);
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);

  const eventKey = `sale_created:${config.provider}:${orderId}`;
  const existing = await service.findOutboxEventByKey(eventKey);
  if (existing) {
    logger.debug(`[erp] venta ya encolada (${eventKey}, status=${existing.status}); evento de ${source} ignorado.`);
    return { created: false, status: existing.status };
  }

  const notifyEnabled =
    config.sales_notify_enabled && getErpAdapter(config.provider).getCapabilities().sale_notify;
  if (!notifyEnabled) {
    const { event } = await service.enqueueOutboxEvent({
      event_type: 'sale_created',
      event_key: eventKey,
      aggregate_type: 'order',
      aggregate_id: orderId,
      provider: config.provider,
      payload: { order_id: orderId, reason: 'sales_notify_disabled' },
      status: 'skipped',
    });
    return { created: true, status: event.status };
  }

  /*
   * Un fallo derivando NO puede dejar la venta sin encolar: se cae al depósito
   * de la configuración, que es el comportamiento que había antes de esto.
   */
  let effectiveDeposito = billingDeposito ?? null;
  if (!effectiveDeposito) {
    try {
      const lookup = await lookupOrderBillingDeposito(container, {
        orderId,
        settings: config.settings,
      });
      if (lookup?.deposito) {
        effectiveDeposito = lookup.deposito;
        logger.info(
          `[erp] orden ${orderId}: factura desde el depósito ${lookup.deposito} (${lookup.source}).`
        );
      } else if (lookup?.derivation.kind === 'skip' && lookup.derivation.reason !== 'not_store_pickup') {
        // Un envío a domicilio no deriva depósito y eso es lo esperado: no es
        // ruido. Lo demás puede ser un mapeo de depósitos incompleto.
        logger.warn(
          `[erp] orden ${orderId}: sin depósito facturador derivable (${lookup.derivation.reason}, sucursal ${lookup.storeId ?? '?'}). Factura desde el depósito de la configuración.`
        );
      }
    } catch (error) {
      logger.warn(
        `[erp] orden ${orderId}: no se pudo derivar el depósito facturador; se usa el de la configuración. ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  const country = getCountryLayer(config.country_code);
  const payload = await buildSalePayload(container, {
    orderId,
    eventKey,
    country,
    billingDeposito: effectiveDeposito,
  });
  if (!payload) {
    logger.warn(`[erp] no se pudo armar el payload de venta: orden ${orderId} no encontrada (${source}).`);
    return { created: false, status: null };
  }

  const { created, event } = await service.enqueueOutboxEvent({
    event_type: 'sale_created',
    event_key: eventKey,
    aggregate_type: 'order',
    aggregate_id: orderId,
    provider: config.provider,
    payload,
    status: 'pending',
  });
  if (created) {
    logger.info(`[erp] venta encolada para notificar (${eventKey}, via ${source}).`);
  }
  return { created, status: event.status };
}
