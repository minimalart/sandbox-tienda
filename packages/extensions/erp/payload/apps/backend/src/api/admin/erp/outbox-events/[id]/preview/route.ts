import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys, MedusaError } from '@medusajs/framework/utils';
import type { Logger } from '@medusajs/framework/types';
import { ERP_MODULE } from '../../../../../../modules/erp';
import type ErpModuleService from '../../../../../../modules/erp/service';
import { getErpAdapter } from '../../../../../../modules/erp/adapters/registry';
import type { ErpSalePayload } from '../../../../../../modules/erp/types';

/**
 * GET /admin/erp/outbox-events/:id/preview — el documento que se le mandó (o se
 * le mandaría) al ERP por esta venta.
 *
 * Responde con `source`, y esa distinción es el punto de la ruta:
 *
 * - `stored`: el body TAL CUAL viajó, guardado al enviarlo. Es evidencia.
 * - `reconstructed`: la venta es anterior a que se guardara el documento (o
 *   nunca se envió). Se rearma con la config VIGENTE, que puede no ser la que
 *   se usó — por eso viene con `warnings` y por eso no se devuelve como si
 *   fuera el original.
 *
 * Nunca envía nada al ERP ni crea datos en él: la reconstrucción es de sólo
 * lectura (ver `previewSale` en el adapter).
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<ErpModuleService>(ERP_MODULE);
  const logger = req.scope.resolve<Logger>(ContainerRegistrationKeys.LOGGER);

  const event = await service.retrieveErpOutboxEvent(req.params.id!);

  if (event.event_type !== 'sale_created') {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `El evento ${event.id} es de tipo "${event.event_type}": sólo las ventas (sale_created) tienen un documento que mostrar.`
    );
  }

  if (event.request_payload) {
    res.status(200).json({
      source: 'stored',
      request: event.request_payload,
      warnings: [],
      sent_at: event.sent_at ?? null,
      external_ref: event.external_ref ?? null,
    });
    return;
  }

  /**
   * `getConfig` y no `getActiveConfig`: auditar una venta vieja tiene que
   * funcionar aunque hoy la integración esté apagada. La ruta no envía nada, así
   * que el master switch no viene al caso.
   */
  const config = await service.getConfig();
  if (!config) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      'No hay una integración ERP activa: sin su configuración no se puede reconstruir el documento.'
    );
  }

  const adapter = getErpAdapter(config.provider);
  if (!adapter.previewSale) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `El proveedor "${config.provider}" no sabe reconstruir el documento de venta.`
    );
  }

  const credentials = service.getDecryptedCredentials(config);
  if (!credentials) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      'No hay credenciales guardadas para el ERP: no se puede reconstruir el documento.'
    );
  }

  /**
   * El código de cliente REAL de esta venta quedó en el acuse del ERP. Usarlo
   * es más fiel que volver a buscarlo, y de paso evita salir a la red.
   */
  const clientCode =
    typeof (event.response_payload as Record<string, unknown> | null)?.codigo_cliente === 'string'
      ? ((event.response_payload as Record<string, unknown>).codigo_cliente as string)
      : null;

  const preview = await adapter.previewSale(
    event.payload as ErpSalePayload,
    {
      credentials,
      settings: (config.settings ?? {}) as Record<string, unknown>,
      countryCode: config.country_code,
      logger,
    },
    { clientCode }
  );

  res.status(200).json({
    source: 'reconstructed',
    request: preview.request,
    warnings: [
      'Este documento se rearmó con la configuración del ERP VIGENTE HOY, no se guardó al enviarse. Si la sucursal, el depósito, el punto de venta o la condición de venta cambiaron después de esta venta, lo que ves acá no es lo que recibió el ERP.',
      ...preview.warnings,
    ],
    sent_at: event.sent_at ?? null,
    external_ref: event.external_ref ?? null,
  });
}
