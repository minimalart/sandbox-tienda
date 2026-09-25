import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import type { IOrderModuleService, Logger } from '@medusajs/framework/types';
import { ERP_MODULE } from '../modules/erp';
import type ErpModuleService from '../modules/erp/service';
import { lookupOrderBillingDeposito } from '../modules/erp/billing-deposito-for-order';

/**
 * Sella en la orden el DEPÓSITO FACTURADOR que le corresponde por la sucursal
 * que eligió el comprador para retirar (DESDEELSUR-61).
 *
 * En el mostrador factura la sucursal donde vas a retirar; acá igual. Sin esto,
 * el depósito facturador es una constante de la configuración que no se
 * corresponde con la operación real de cada pedido.
 *
 * Escribe `metadata.erp_billing_deposito`, que ya existía como override por
 * orden y le gana a la configuración (`resolveBillingDeposito`). Lo único que
 * faltaba era quién lo poblara.
 *
 * ── Qué sella esto y qué NO ──
 * La metadata sirve para el trigger `fulfillment_created` (donde la factura
 * sale mucho después), para el admin y para la auditoría: mirando la orden se
 * ve desde qué depósito se facturó.
 *
 * Lo que NO hace es gobernar la factura del camino `payment_captured` —el que
 * tiene desdeelsur—. Ahí el depósito lo deriva `enqueueSaleForOrder` en el
 * momento de encolar, porque quien encola es `erp-order-placed-reconcile.ts`,
 * que escucha ESTE MISMO evento `order.placed`: entre dos subscribers del mismo
 * evento no hay orden garantizado, y esperar a que esta metadata esté escrita
 * sería una carrera. Los dos caminos comparten `lookupOrderBillingDeposito`, así
 * que no pueden dar resultados distintos.
 *
 * ── Envío a domicilio ──
 * No hace nada, y está bien: ahí el comprador no elige sucursal. Esos pedidos
 * siguen facturando desde el depósito de la configuración.
 *
 * NUNCA lanza: un fallo acá no puede afectar la creación de la orden. El peor
 * caso es que la orden quede sin la marca y caiga a la config.
 */
export default async function erpOrderBillingDepositoHandler({
  event,
  container,
}: SubscriberArgs<{ id: string }>): Promise<void> {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const orderId = event.data.id;

  try {
    let service: ErpModuleService;
    try {
      service = container.resolve<ErpModuleService>(ERP_MODULE);
    } catch {
      return; // el módulo ERP es opcional
    }

    const config = await service.getActiveConfig();
    if (!config) return;

    const lookup = await lookupOrderBillingDeposito(container, {
      orderId,
      settings: config.settings,
    });
    if (!lookup) return;

    if (lookup.derivation.kind === 'skip') {
      // Sólo se loguea lo que puede ser un problema de configuración. Que un
      // envío a domicilio no derive depósito es lo esperado y no merece ruido.
      const { reason } = lookup.derivation;
      if (reason === 'not_mapped' || reason === 'no_location') {
        logger.warn(
          `[erp] orden ${orderId}: retiro en sucursal ${lookup.storeId ?? '?'} sin depósito facturador derivable (${reason}). Factura desde el depósito de la configuración.`
        );
      }
      return;
    }

    /*
     * `updateOrders` REEMPLAZA el objeto metadata entero, no mergea: el spread
     * es obligatorio o se pierden `store_id`, los tickets de los carriers y
     * todo lo demás que viva ahí.
     *
     * Se relee la orden en vez de usar la metadata del lookup para achicar la
     * ventana entre la lectura y la escritura: entre medio pudo correr otro
     * subscriber de `order.placed` escribiendo lo suyo.
     */
    const orderModuleService = container.resolve<IOrderModuleService>(Modules.ORDER);
    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const { data: fresh } = (await query.graph({
      entity: 'order',
      fields: ['id', 'metadata'],
      filters: { id: orderId },
    })) as { data: Array<{ metadata?: Record<string, unknown> | null }> };

    await orderModuleService.updateOrders([
      {
        id: orderId,
        metadata: {
          ...(fresh[0]?.metadata ?? {}),
          erp_billing_deposito: lookup.derivation.deposito,
        },
      },
    ]);

    logger.info(
      `[erp] orden ${orderId}: depósito facturador ${lookup.derivation.deposito} por la sucursal de retiro elegida.`
    );
  } catch (error) {
    logger.warn(
      `[erp] no se pudo sellar el depósito facturador de la orden ${orderId}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

export const config: SubscriberConfig = {
  event: 'order.placed',
};
