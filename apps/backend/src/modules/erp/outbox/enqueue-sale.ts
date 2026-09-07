import type { Logger, MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { ERP_MODULE } from '../index';
import type ErpModuleService from '../service';
import type { ErpConfigRow } from '../service';
import { getErpAdapter } from '../adapters/registry';
import { getCountryLayer } from '../countries/registry';
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
 * `billingDeposito` viaja en el payload y gana sobre el depósito de la config
 * del provider. Sólo lo manda el trigger por fulfillment, donde un humano
 * confirmó desde qué depósito se despacha; con `payment_captured` va ausente y
 * el adapter cae a su config, como siempre.
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

  const country = getCountryLayer(config.country_code);
  const payload = await buildSalePayload(container, {
    orderId,
    eventKey,
    country,
    billingDeposito: billingDeposito ?? null,
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
