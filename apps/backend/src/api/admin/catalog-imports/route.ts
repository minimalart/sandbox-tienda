import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { MedusaError } from '@medusajs/framework/utils';
import { z } from 'zod';
import { catalogAdminContext } from '../../../modules/store-importer/admin-context';
import { connectionConfigSchema } from '../../../modules/store-importer/config';

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { destinationId, salesChannelId, service } = await catalogAdminContext(req);
  const connections = await service.listCatalogConnections(
    { destination_id: destinationId },
    { take: 100, order: { created_at: 'DESC' } }
  );
  const jobs = await service.listCatalogImports(
    { destination_id: destinationId },
    {
      take: 25,
      order: { created_at: 'DESC' },
      select: [
        'id',
        'connection_id',
        'status',
        'cursor',
        'report',
        'result',
        'created_at',
        'updated_at',
        'cancel_requested',
      ],
    }
  );
  res.json({ connections, jobs, destination_id: destinationId, sales_channel_id: salesChannelId });
}
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { destinationId, salesChannelId, service } = await catalogAdminContext(req);
  const parsed = z
    .object({
      name: z.string().trim().min(1).max(100),
      config: connectionConfigSchema,
      enabled: z.boolean().default(false),
    })
    .strict()
    .safeParse(req.body);
  if (!parsed.success)
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      parsed.error.issues.map((i) => i.message).join(' ')
    );
  const connection = await service.createCatalogConnections({
    ...parsed.data,
    destination_id: destinationId,
    sales_channel_id: salesChannelId,
  });
  res.status(201).json({ connection });
}
