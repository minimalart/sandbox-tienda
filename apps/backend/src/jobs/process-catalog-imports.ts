import type { MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { CATALOG_IMPORT_MODULE } from '../modules/store-importer';
import { dispatchCatalogIndexing, runCatalogJob } from '../modules/store-importer/catalog-jobs';

export default async function processCatalogImports(container: MedusaContainer) {
  const service: any = container.resolve(CATALOG_IMPORT_MODULE);
  const jobs = await service.listCatalogImports(
    { status: ['pending', 'running'] },
    { take: 10, order: { created_at: 'ASC' } }
  );
  for (const job of jobs) await runCatalogJob(container, job.id);
  const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const { rows: completed } = await pg.raw(
    `select id from catalog_import where deleted_at is null and status in ('completed','partial','cancelled','failed') and jsonb_array_length(coalesce(result->'indexingPending','[]'::jsonb)) > 0 order by created_at asc limit 100`
  );
  for (const row of completed) {
    const job = await service.retrieveCatalogImport(row.id);
    try {
      await dispatchCatalogIndexing(container, job);
    } catch {
      /* The durable pending ids will be retried on the next tick. */
    }
  }
}
export const config = { name: 'process-catalog-imports', schedule: '* * * * *' };
