import { assertRowInSite } from '../../../../lib/multistore/scope';
import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { MedusaError } from '@medusajs/framework/utils';
import { z } from 'zod';
import { scopedConnection } from '../../../../modules/store-importer/admin-context';
import { connectionConfigSchema } from '../../../../modules/store-importer/config';

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { connection, service, site } = await scopedConnection(req, req.params.id!);
  assertRowInSite(connection, site, {
    kind: 'site_column',
    table: 'catalog_connection',
    column: 'destination_id',
    empty: 'unassigned',
  });
  const parsed = z
    .object({
      name: z.string().trim().min(1).max(100).optional(),
      enabled: z.boolean().optional(),
      config: connectionConfigSchema.optional(),
    })
    .strict()
    .safeParse(req.body);
  if (!parsed.success)
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      parsed.error.issues.map((i) => i.message).join(' ')
    );
  if (
    parsed.data.config &&
    (parsed.data.config.sourceUrl !== connection.config.sourceUrl ||
      parsed.data.config.provider !== connection.config.provider ||
      parsed.data.config.currencyCode !== connection.config.currencyCode ||
      parsed.data.config.sourceChannel !== connection.config.sourceChannel ||
      parsed.data.config.sellerRef !== connection.config.sellerRef)
  )
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      'Creá otra conexión para cambiar el origen, la moneda o el contexto de oferta.'
    );
  const updated = await service.updateCatalogConnections({ id: connection.id, ...parsed.data });
  res.json({ connection: updated });
}
