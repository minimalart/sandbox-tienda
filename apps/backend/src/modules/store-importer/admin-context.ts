import type { AuthenticatedMedusaRequest } from '@medusajs/framework/http';
import { MedusaError, Modules } from '@medusajs/framework/utils';
import { siteFromRequest } from '../../lib/multistore/request';
import { CATALOG_IMPORT_MODULE } from './index';

export async function catalogAdminContext(req: AuthenticatedMedusaRequest) {
  if (!req.auth_context?.actor_id || req.auth_context.actor_type !== 'user')
    throw new MedusaError(
      MedusaError.Types.UNAUTHORIZED,
      'Necesitás una sesión de administración.'
    );
  // Admin users have instance-wide access in the existing authorization model.
  // The site hint selects a destination, never grants permission on its own.
  await (req.scope.resolve(Modules.USER) as any).retrieveUser(req.auth_context.actor_id);
  const site = await siteFromRequest(req);
  let destinationId: string;
  let salesChannelId: string;
  if (site.status === 'site' || site.status === 'singleSite') {
    destinationId = site.site.id;
    salesChannelId = site.site.channel_ids[0]!;
  } else if (site.status === 'registryAbsent') {
    const [store] = await (req.scope.resolve(Modules.STORE) as any).listStores({}, { take: 1 });
    destinationId = store?.id;
    salesChannelId = store?.default_sales_channel_id;
  } else
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      'Seleccioná una tienda válida antes de importar.'
    );
  if (!destinationId || !salesChannelId)
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      'Configurá el canal de venta de la instalación.'
    );
  return {
    site,
    destinationId,
    salesChannelId,
    service: req.scope.resolve(CATALOG_IMPORT_MODULE) as any,
  };
}
export async function scopedConnection(req: AuthenticatedMedusaRequest, id: string) {
  const context = await catalogAdminContext(req);
  const connection = await context.service.retrieveCatalogConnection(id);
  if (
    connection.destination_id !== context.destinationId ||
    connection.sales_channel_id !== context.salesChannelId
  )
    throw new MedusaError(MedusaError.Types.NOT_FOUND, 'Conexión no encontrada en este destino.');
  return { ...context, connection };
}
