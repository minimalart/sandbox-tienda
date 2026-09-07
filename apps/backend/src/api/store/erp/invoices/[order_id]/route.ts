import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { ERP_MODULE } from '../../../../../modules/erp';
import type ErpModuleService from '../../../../../modules/erp/service';

/**
 * GET /store/erp/invoices/:order_id — ¿hay comprobante para MI pedido?
 *
 * Existe para que el storefront no tenga que pedir el PDF sólo para averiguar
 * si existe: sin esto, la única forma de saberlo sería descargarlo y ver si da
 * 404, o mostrar siempre un botón que a veces falla.
 *
 * Devuelve METADATOS, nunca el archivo. Mismo scoping que la descarga: la orden
 * tiene que ser del customer autenticado, y si no lo es responde `available:
 * false` en lugar de 403 — confirmar que la orden existe ya sería filtrar
 * información.
 */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const orderId = req.params.order_id as string;
  const customerId = req.auth_context?.actor_id ?? null;
  const unavailable = { available: false, label: null, fecha: null };

  if (!customerId) {
    res.status(200).json(unavailable);
    return;
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const { data: orders } = (await query.graph({
    entity: 'order',
    fields: ['id', 'customer_id'],
    filters: { id: orderId },
  })) as { data: Array<{ id: string; customer_id?: string | null }> };
  if (orders[0]?.customer_id !== customerId) {
    res.status(200).json(unavailable);
    return;
  }

  const service = req.scope.resolve<ErpModuleService>(ERP_MODULE);
  const config = await service.getConfig();
  const invoice = config ? await service.findInvoiceByOrder(config.provider, orderId) : null;

  if (!invoice?.file_id) {
    res.status(200).json(unavailable);
    return;
  }

  res.status(200).json({
    available: true,
    label:
      [invoice.tipo_comp, invoice.letra, invoice.numero_comp]
        .filter((part) => part !== null && part !== undefined && part !== '')
        .join(' ') || null,
    fecha: invoice.fecha,
  });
}
