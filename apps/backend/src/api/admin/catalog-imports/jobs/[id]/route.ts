import { assertRowInSite } from '../../../../../lib/multistore/scope';
import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { MedusaError } from '@medusajs/framework/utils';
import { catalogAdminContext } from '../../../../../modules/store-importer/admin-context';

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { destinationId, salesChannelId, service, site } = await catalogAdminContext(req);
  const job = await service.retrieveCatalogImport(req.params.id);
  if (job.destination_id !== destinationId)
    throw new MedusaError(MedusaError.Types.NOT_FOUND, 'Importación no encontrada.');
  assertRowInSite(job, site, {
    kind: 'site_column',
    table: 'catalog_import',
    column: 'destination_id',
    empty: 'unassigned',
  });
  if (job.sales_channel_id !== salesChannelId)
    throw new MedusaError(MedusaError.Types.NOT_FOUND, 'Importación no encontrada.');
  const action = (req.body as any)?.action;
  if (action === 'cancel' && ['pending', 'running'].includes(job.status)) {
    await service.updateCatalogImports({ id: job.id, cancel_requested: true });
  } else if (action === 'retry' && ['failed', 'partial', 'cancelled'].includes(job.status)) {
    // Persistence failures replay the snapshot. Incomplete source coverage must
    // run recovery again; replaying the same 2,500 rows can never fetch the rest.
    await service.updateCatalogImports({
      id: job.id,
      status: 'pending',
      cancel_requested: false,
      cursor: 0,
      ...(job.report?.complete === false ? { products: null, report: null } : {}),
      result: {
        created: 0,
        updated: 0,
        failed: 0,
        errors: [],
        productIds: [],
        indexingPending: job.result?.indexingPending ?? [],
      },
    });
  } else
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      'Esta acción no corresponde al estado de la importación.'
    );
  res.json({ job: await service.retrieveCatalogImport(job.id) });
}
