import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { ERP_MODULE } from '../../../../../modules/erp';
import type ErpModuleService from '../../../../../modules/erp/service';
import { getErpAdapter } from '../../../../../modules/erp/adapters/registry';
import {
  activeDepositoMappings,
  readBillingConfirmation,
  readOrderBillingDeposito,
  resolveBillingDeposito,
  resolveSalesTrigger,
} from '../../../../../modules/erp/billing-deposito';
import { invoiceFetchEventKey } from '../../../../../modules/erp/outbox/invoice-fetch';

/**
 * GET /admin/erp/orders/:id — todo lo que el widget de la orden necesita saber
 * sobre facturación, en UNA llamada.
 *
 * El widget hace su propio fetch (no confía en `DetailWidgetProps.data`, que no
 * garantiza los fulfillments hidratados), así que esta ruta es su única fuente:
 * depósito facturador efectivo, opciones para el override, estado del evento de
 * venta, estado del poll del comprobante y el comprobante si ya llegó.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const orderId = req.params.id as string;
  const service = req.scope.resolve<ErpModuleService>(ERP_MODULE);
  const config = await service.getConfig();

  if (!config) {
    res.status(200).json({ enabled: false, trigger: null, billing: null, sale_event: null, invoice: null });
    return;
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const { data: orders } = (await query.graph({
    entity: 'order',
    fields: ['id', 'metadata'],
    filters: { id: orderId },
  })) as { data: Array<{ id: string; metadata?: Record<string, unknown> | null }> };
  const order = orders[0];
  if (!order) {
    res.status(404).json({ message: `Orden ${orderId} no encontrada.` });
    return;
  }

  const trigger = resolveSalesTrigger(config.settings);
  const resolution = resolveBillingDeposito(config.settings, order.metadata ?? null);
  const mappings = activeDepositoMappings(config.settings);

  // Nombres de las locations para que la UI muestre nombres y no ids.
  const locationIds = [...new Set(mappings.map((row) => row.stock_location_id))];
  const names = new Map<string, string>();
  if (locationIds.length) {
    const { data: locations } = (await query.graph({
      entity: 'stock_location',
      fields: ['id', 'name'],
      filters: { id: locationIds },
    })) as { data: Array<{ id: string; name?: string | null }> };
    for (const location of locations) if (location.name) names.set(location.id, location.name);
  }

  const saleEvent = await service.findOutboxEventByKey(`sale_created:${config.provider}:${orderId}`);
  const invoiceEvent = await service.findOutboxEventByKey(
    invoiceFetchEventKey(config.provider, orderId)
  );
  const invoice = await service.findInvoiceByOrder(config.provider, orderId);

  let capabilities: { invoice_fetch: boolean } | null = null;
  try {
    capabilities = { invoice_fetch: getErpAdapter(config.provider).getCapabilities().invoice_fetch };
  } catch {
    capabilities = null;
  }

  res.status(200).json({
    enabled: config.enabled && config.sales_notify_enabled,
    provider: config.provider,
    trigger,
    capabilities,
    billing: {
      // `ok:false` es información para la UI, no un error: el widget tiene que
      // poder decir "falta configurar el depósito facturador".
      resolved: resolution.ok,
      reason: resolution.ok ? null : resolution.reason,
      deposito: resolution.ok ? resolution.deposito : resolution.deposito,
      stock_location_id: resolution.ok ? resolution.stock_location_id : null,
      stock_location_name: resolution.ok ? (names.get(resolution.stock_location_id) ?? null) : null,
      source: resolution.ok ? resolution.source : null,
      override: readOrderBillingDeposito(order.metadata ?? null),
      confirmation: readBillingConfirmation(order.metadata ?? null),
      options: mappings.map((row) => ({
        deposito: row.deposito,
        stock_location_id: row.stock_location_id,
        stock_location_name: names.get(row.stock_location_id) ?? null,
      })),
    },
    sale_event: saleEvent
      ? {
          id: saleEvent.id,
          status: saleEvent.status,
          attempts: saleEvent.attempts,
          external_ref: saleEvent.external_ref,
          last_error: saleEvent.last_error,
          next_retry_at: saleEvent.next_retry_at,
          sent_at: saleEvent.sent_at,
        }
      : null,
    invoice_event: invoiceEvent
      ? {
          id: invoiceEvent.id,
          status: invoiceEvent.status,
          attempts: invoiceEvent.attempts,
          last_error: invoiceEvent.last_error,
          next_retry_at: invoiceEvent.next_retry_at,
        }
      : null,
    invoice: invoice
      ? {
          id: invoice.id,
          numero_comp: invoice.numero_comp,
          tipo_comp: invoice.tipo_comp,
          letra: invoice.letra,
          punto_de_venta: invoice.punto_de_venta,
          sucursal: invoice.sucursal,
          fecha: invoice.fecha,
          total: invoice.total,
          has_pdf: Boolean(invoice.file_id),
        }
      : null,
  });
}
