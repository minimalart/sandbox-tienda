import { publicCatalogRequests } from '../../lib/catalog/request-context';
import { createHash } from 'node:crypto';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import { CATALOG_IMPORT_MODULE } from './index';
import { connectionConfigSchema, type ConnectionConfig } from './config';
import { getImporter } from './importers';
import { fetchVtexCatalog } from './importers/vtex-catalog';
import { persistCatalogProduct } from './persist-catalog';
import type { ImportReport, NormalizedProduct } from '../../lib/catalog/types';

export const configurationDigest = (connection: any, config: ConnectionConfig) =>
  createHash('sha256')
    .update(
      JSON.stringify([
        connection.id,
        connection.destination_id,
        connection.sales_channel_id,
        config,
      ])
    )
    .digest('hex');

export async function recoverCatalog(
  config: ConnectionConfig,
  preview = false,
  shouldCancel?: () => Promise<boolean>
) {
  let report: ImportReport = {
    strategy: config.provider,
    complete: false,
    fetched: 0,
    excluded: 0,
    reason: 'adapter_does_not_report_completeness',
    warnings: [],
  };
  const importer = config.provider === 'vtex' ? fetchVtexCatalog : getImporter(config.provider);
  const products = await publicCatalogRequests.run({ requests: 0, shouldCancel }, () =>
    importer({
      shouldCancel,
      sourceUrl: config.sourceUrl,
      sourceConfig: config,
      targetCount: preview ? Math.min(config.targetCount ?? 5, 5) : config.targetCount,
      report: (r) => {
        report = r;
      },
    })
  );
  report.fetched = products.length;
  return { products, report };
}

/** PostgreSQL advisory lock is held on one dedicated transaction connection.
 * No TTL can expire underneath a live worker. Process death releases the lock.
 * Workflows commit independently; cursor replay repairs an interrupted checkpoint.
 */
export async function runCatalogJob(container: any, jobId: string): Promise<void> {
  const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const service = container.resolve(CATALOG_IMPORT_MODULE);
  const job = await service.retrieveCatalogImport(jobId);
  await pg.transaction(async (trx: any) => {
    const { rows } = await trx.raw(
      'select pg_try_advisory_xact_lock(hashtextextended(?, 0)) as locked',
      [`catalog-import:${job.destination_id}`]
    );
    if (!rows[0]?.locked) return;
    let current = await service.retrieveCatalogImport(jobId);
    if (!['pending', 'running'].includes(current.status)) return;
    const connection = await service.retrieveCatalogConnection(job.connection_id);
    const state: any = current.result ?? {
      created: 0,
      updated: 0,
      failed: 0,
      errors: [],
      productIds: [],
      indexingPending: [],
    };
    try {
      if (current.cancel_requested) {
        await service.updateCatalogImports({ id: jobId, status: 'cancelled' });
        return;
      }
      if (!connection.enabled) throw new Error('La conexión está desactivada.');
      if (
        connection.destination_id !== job.destination_id ||
        connection.sales_channel_id !== job.sales_channel_id
      )
        throw new Error('El destino de la conexión cambió.');
      const config = connectionConfigSchema.parse(job.config);
      await service.updateCatalogImports({ id: jobId, status: 'running' });
      if (!current.products) {
        const recovered = await recoverCatalog(
          config,
          false,
          async () =>
            (await service.retrieveCatalogImport(jobId)).cancel_requested ||
            !(await service.retrieveCatalogConnection(job.connection_id)).enabled
        );
        await service.updateCatalogImports({
          id: jobId,
          products: { items: recovered.products },
          report: recovered.report,
        });
        current = await service.retrieveCatalogImport(jobId);
      }
      const products = (current.products as { items: NormalizedProduct[] }).items;
      for (let cursor = current.cursor; cursor < products.length; cursor++) {
        const live = await service.retrieveCatalogImport(jobId);
        const activeConnection = await service.retrieveCatalogConnection(job.connection_id);
        if (live.cancel_requested || !activeConnection.enabled) {
          await service.updateCatalogImports({ id: jobId, status: 'cancelled', result: state });
          return;
        }
        const product = products[cursor]!;
        try {
          const result = await persistCatalogProduct(
            container,
            {
              connectionId: job.connection_id,
              destinationId: job.destination_id,
              salesChannelId: job.sales_channel_id,
              config,
            },
            product
          );
          state[result.action]++;
          if (!state.productIds.includes(result.id)) state.productIds.push(result.id);
          if (!state.indexingPending.includes(result.id)) state.indexingPending.push(result.id);
        } catch {
          state.failed++;
          if (state.errors.length < 30)
            state.errors.push({
              productId: product.productId,
              message:
                'No se pudo persistir el producto. Revisá identidad, opciones y precio; el reintento conserva los IDs confirmados.',
            });
        }
        await service.updateCatalogImports({ id: jobId, cursor: cursor + 1, result: state });
      }
      const cancelled =
        (await service.retrieveCatalogImport(jobId)).cancel_requested ||
        !(await service.retrieveCatalogConnection(job.connection_id)).enabled;
      await service.updateCatalogImports({
        id: jobId,
        status: cancelled
          ? 'cancelled'
          : state.failed || !current.report?.complete
            ? 'partial'
            : 'completed',
        result: state,
      });
    } catch (error) {
      if ((await service.retrieveCatalogImport(jobId)).cancel_requested) {
        await service.updateCatalogImports({ id: jobId, status: 'cancelled', result: state });
        return;
      }
      state.errors.push({
        message:
          error instanceof Error && /^(La conexión|El destino)/.test(error.message)
            ? error.message
            : 'Falló la recuperación del catálogo. El catálogo previo se conserva.',
      });
      await service.updateCatalogImports({ id: jobId, status: 'failed', result: state });
    }
  });
}

/** Emit only confirmed products. Subscribers own indexing and their retry policy. */
export async function dispatchCatalogIndexing(container: any, job: any) {
  const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const result = job.result;
  if (!result?.indexingPending?.length) return;
  const bus = container.resolve(Modules.EVENT_BUS);
  for (const id of [...result.indexingPending]) {
    await bus.emit({ name: 'product.updated', data: { id } });
    // Change only the outbox field; never overwrite a concurrent retry's cursor/results.
    await pg.raw(
      `update catalog_import set result = jsonb_set(result, '{indexingPending}', coalesce(result->'indexingPending', '[]'::jsonb) - ?), updated_at = now() where id = ?`,
      [id, job.id]
    );
  }
}
