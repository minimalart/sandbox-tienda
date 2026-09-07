import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys, MedusaError, Modules } from '@medusajs/framework/utils';
import { ERP_MODULE } from '../../../../../../modules/erp';
import type ErpModuleService from '../../../../../../modules/erp/service';
import {
  activeDepositoMappings,
  findDepositoMapping,
} from '../../../../../../modules/erp/billing-deposito';
import type { PostErpOrderBillingDepositoInput } from '../../../validators';

/**
 * POST /admin/erp/orders/:id/billing-deposito — override del depósito
 * facturador para UNA orden.
 *
 * Existe porque el default de la config no siempre alcanza: la mercadería puede
 * terminar consolidada en otro depósito por una razón puntual, y obligar a
 * cambiar la configuración global de la tienda para despachar un pedido sería
 * absurdo (y peligroso: quedaría cambiada para todos los pedidos siguientes).
 *
 * Se guarda en `order.metadata.erp_billing_deposito`. El gate de fulfillment y
 * el subscriber lo leen con la misma precedencia (override de la orden → default
 * de la config), así que no hay forma de que validen distinto de lo que factura.
 */
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const orderId = req.params.id as string;
  const { deposito } = req.validatedBody as PostErpOrderBillingDepositoInput;

  const service = req.scope.resolve<ErpModuleService>(ERP_MODULE);
  const config = await service.getConfig();
  if (!config) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, 'El ERP no está configurado.');
  }

  // `null` = volver al default de la config. Un string tiene que estar mapeado:
  // aceptar un depósito sin location sería aceptar un fulfillment que el gate va
  // a rechazar después, con el operador ya con la mercadería en la mano.
  if (deposito !== null && !findDepositoMapping(config.settings, deposito)) {
    const mapped = activeDepositoMappings(config.settings)
      .map((row) => row.deposito)
      .join(', ');
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `El depósito "${deposito}" no está en el mapeo de depósitos${mapped ? ` (mapeados: ${mapped})` : ''}.`
    );
  }

  // Cambiar el depósito después de que la venta ya se notificó no hace nada: el
  // comprobante salió con el depósito anterior. Rechazar es más honesto que
  // guardar un valor que ya no tiene efecto.
  const saleEvent = await service.findOutboxEventByKey(`sale_created:${config.provider}:${orderId}`);
  if (saleEvent && (saleEvent.status === 'sent' || saleEvent.status === 'duplicate')) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      'Esta orden ya se notificó al ERP: el comprobante se emitió con el depósito anterior y cambiarlo acá no lo modifica.'
    );
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const { data: orders } = (await query.graph({
    entity: 'order',
    fields: ['id', 'metadata'],
    filters: { id: orderId },
  })) as { data: Array<{ id: string; metadata?: Record<string, unknown> | null }> };
  const order = orders[0];
  if (!order) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Orden ${orderId} no encontrada.`);
  }

  const metadata = { ...(order.metadata ?? {}) } as Record<string, unknown>;
  if (deposito === null) delete metadata.erp_billing_deposito;
  else metadata.erp_billing_deposito = deposito;
  // El override cambia cuál es el depósito válido, así que la confirmación
  // anterior (si había) deja de aplicar: se limpia para que el operador tenga
  // que volver a crear el fulfillment desde la location correcta.
  delete metadata.erp_billing;

  const orderService = req.scope.resolve(Modules.ORDER);
  await orderService.updateOrders([{ id: order.id, metadata }]);

  res.status(200).json({ order_id: order.id, deposito });
}
