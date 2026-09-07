import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import type { IFileModuleService } from '@medusajs/framework/types';
import { ERP_MODULE } from '../../../../../../modules/erp';
import type ErpModuleService from '../../../../../../modules/erp/service';

/**
 * GET /store/erp/invoices/:order_id/download — el comprobante de MI orden.
 *
 * Dos barreras, a propósito:
 * 1. `authenticate('customer')` en el middleware.
 * 2. La orden tiene que pertenecer al customer autenticado. Sin este chequeo, un
 *    `order_id` adivinado bajaría la factura de otra persona: nombre, CUIT y
 *    detalle de compra. El middleware solo prueba que HAY un cliente, no CUÁL.
 *
 * Se responde 404 (y no 403) cuando la orden es de otro: confirmar que existe ya
 * sería filtrar información.
 *
 * El PDF va siempre por proxy: el endpoint del ERP que lo emite acepta el JWT
 * como query param y ese token crea pedidos, así que jamás puede aparecer en una
 * URL de storefront.
 */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const orderId = req.params.order_id as string;
  const customerId = req.auth_context?.actor_id ?? null;
  if (!customerId) {
    res.status(401).json({ message: 'Iniciá sesión para descargar el comprobante.' });
    return;
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const { data: orders } = (await query.graph({
    entity: 'order',
    fields: ['id', 'customer_id'],
    filters: { id: orderId },
  })) as { data: Array<{ id: string; customer_id?: string | null }> };
  const order = orders[0];
  if (!order || order.customer_id !== customerId) {
    res.status(404).json({ message: 'No encontramos el comprobante de este pedido.' });
    return;
  }

  const service = req.scope.resolve<ErpModuleService>(ERP_MODULE);
  const config = await service.getConfig();
  const invoice = config ? await service.findInvoiceByOrder(config.provider, orderId) : null;
  if (!invoice?.file_id) {
    res.status(404).json({ message: 'El comprobante de este pedido todavía no está disponible.' });
    return;
  }

  const fileModule = req.scope.resolve<IFileModuleService>(Modules.FILE);
  const stream = await fileModule.getDownloadStream(invoice.file_id);

  const label = [invoice.tipo_comp, invoice.letra, invoice.numero_comp]
    .filter((part) => part !== null && part !== undefined && part !== '')
    .join('-')
    .replace(/[^a-zA-Z0-9._-]/g, '_');

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.setHeader('Content-Disposition', `inline; filename="comprobante-${label || orderId}.pdf"`);
  stream.on('error', () => {
    if (!res.headersSent) res.status(404);
    res.end();
  });
  stream.pipe(res);
}
