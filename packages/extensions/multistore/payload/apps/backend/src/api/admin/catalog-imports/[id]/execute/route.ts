import { assertRowInSite } from '../../../../../lib/multistore/scope';
import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { MedusaError } from '@medusajs/framework/utils';
import { scopedConnection } from '../../../../../modules/store-importer/admin-context';
import { connectionConfigSchema } from '../../../../../modules/store-importer/config';
import { configurationDigest } from '../../../../../modules/store-importer/catalog-jobs';

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { connection, service, site } = await scopedConnection(req, req.params.id!);
  assertRowInSite(connection, site, {
    kind: 'site_column',
    table: 'catalog_connection',
    column: 'destination_id',
    empty: 'unassigned',
  });
  if (!connection.enabled)
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, 'Activá la conexión antes de ejecutar.');
  const config = connectionConfigSchema.parse(connection.config);
  if ((req.body as any)?.configuration_digest !== configurationDigest(connection, config))
    throw new MedusaError(
      MedusaError.Types.CONFLICT,
      'La configuración cambió. Volvé a previsualizar.'
    );
  try {
    const job = await service.createCatalogImports({
      connection_id: connection.id,
      destination_id: connection.destination_id,
      sales_channel_id: connection.sales_channel_id,
      config,
    });
    res.status(202).json({ job });
  } catch (error: any) {
    if (error.code === '23505' || error.cause?.code === '23505')
      throw new MedusaError(
        MedusaError.Types.CONFLICT,
        'Ya hay una importación en curso para esta conexión.'
      );
    throw error;
  }
}
