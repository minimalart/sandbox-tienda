import type { Logger, MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { DEMO_STORE_MODULE } from '../modules/demo-store';
import { ensureDemoStoreTables } from '../modules/demo-store/ensure-tables';
import { runImport, salesChannelHasProducts } from '../modules/store-importer/run-import';
import {
  loadStoreImporterSettingsViaPg,
  type PgRawConnection,
} from '../modules/store-importer/settings';

/**
 * Durable executor for demo-store catalog imports.
 *
 * The create/retry endpoints only enqueue an ImportJob ('pending') — they no
 * longer run the import inline (a fire-and-forget `void runImport` died whenever
 * DO restarted the container mid-import, leaving the job stuck in 'running' and
 * the store in 'importing' forever). This cron is the single executor:
 *
 *  1. Sweep: a 'running' job whose progress hasn't advanced for STALE_MS was
 *     orphaned by a restart → mark it 'failed' (keeping the store 'ready' if it
 *     still has a catalog, so the storefront isn't broken by a transient run).
 *  2. Single-flight: never start a second import while one is actively running.
 *  3. Claim & run the oldest 'pending' job.
 *
 * Re-running is safe: persistProducts dedupes by handle/sku and links existing
 * products, so a job picked up after a restart simply completes the catalog.
 */
/**
 * El umbral de "importación huérfana" (STALE_MS) se lee EN CADA TICK, dentro de la
 * función, y ya no en el scope del módulo como antes
 * (`const STALE_MS = Number(process.env.DEMO_IMPORT_STALE_MS ?? …)`).
 *
 * No es un detalle de estilo. Leerlo arriba lo congelaba en el arranque del proceso,
 * o sea que después de esta migración un cambio guardado desde el admin nunca habría
 * llegado: la fila existiría en `site_setting` y el job seguiría usando el env con el
 * que levantó el worker. Un valor "configurable" que no se puede cambiar es peor que
 * uno hardcodeado, porque miente.
 */
const lastActivity = (job: any): number => {
  const value = job.updated_at ?? job.started_at ?? job.created_at;
  const ts = value ? new Date(value).getTime() : 0;
  return Number.isFinite(ts) ? ts : 0;
};

export default async function processDemoStoreImportsJob(container: MedusaContainer): Promise<void> {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const service: any = container.resolve(DEMO_STORE_MODULE);

  try {
    await ensureDemoStoreTables(container);
  } catch (err) {
    logger.warn(`[demo-store cron] ensureTables failed: ${(err as Error).message}`);
    return;
  }

  const now = Date.now();

  // Camino async por `PG_CONNECTION`: el job tiene contenedor, así que ve la fila
  // recién guardada sin esperar a que venza el snapshot del worker — y este número
  // es justo el que un operador mueve mientras mira una importación grande correr.
  //
  // El `try` no es decorativo: `container.resolve` de awilix TIRA cuando la clave no
  // está registrada, y perder el barrido de importaciones huérfanas por no poder
  // leer un número sería el peor intercambio posible. Sin conexión,
  // `loadStoreImporterSettingsViaPg(undefined)` cae sola al snapshot.
  let pg: PgRawConnection | undefined;
  try {
    pg = container.resolve<PgRawConnection>(ContainerRegistrationKeys.PG_CONNECTION);
  } catch {
    pg = undefined;
  }
  const { staleMs: STALE_MS } = await loadStoreImporterSettingsViaPg(pg);

  // 1) Sweep orphaned 'running' jobs (process killed mid-import by a restart).
  let running: any[] = [];
  try {
    running = (await service.listImportJobs({ status: 'running' })) as any[];
  } catch (err) {
    logger.warn(`[demo-store cron] list running failed: ${(err as Error).message}`);
    return;
  }

  for (const job of running) {
    if (now - lastActivity(job) < STALE_MS) continue;
    logger.warn(`[demo-store cron] Marcando job huérfano ${job.id} como fallido (sin avance ${STALE_MS}ms).`);
    try {
      await service.updateImportJobs({
        id: job.id,
        status: 'failed',
        finished_at: new Date(),
        error_log: { samples: ['Importación interrumpida por un reinicio del servidor; marcada como fallida.'] },
      });
      const demo = await service.retrieveDemoStore(job.demo_store_id);
      const keepReady = demo?.sales_channel_id
        ? await salesChannelHasProducts(container, demo.sales_channel_id)
        : false;
      await service.updateDemoStores({ id: job.demo_store_id, status: keepReady ? 'ready' : 'failed' });
    } catch (err) {
      logger.warn(`[demo-store cron] sweep ${job.id} failed: ${(err as Error).message}`);
    }
  }

  // 2) Single-flight: don't start another import while one is actively running.
  const stillActive = running.some((job) => now - lastActivity(job) < STALE_MS);
  if (stillActive) return;

  // 3) Claim and run the oldest pending job.
  let job: any;
  try {
    const pending = (await service.listImportJobs(
      { status: 'pending' },
      { order: { created_at: 'ASC' }, take: 1 },
    )) as any[];
    job = pending[0];
  } catch (err) {
    logger.warn(`[demo-store cron] list pending failed: ${(err as Error).message}`);
    return;
  }
  if (!job) return;

  let demo: any;
  try {
    demo = await service.retrieveDemoStore(job.demo_store_id);
  } catch (err) {
    logger.warn(`[demo-store cron] retrieve store ${job.demo_store_id} failed: ${(err as Error).message}`);
    return;
  }

  // Cinturón y tiradores. Ninguna ruta puede encolarle un job a la fila principal
  // (POST /admin/stores no la crea, /retry le da 409, y `native` es ilegal en
  // demo_import_job.source_type), pero ESTE es el último punto antes de que
  // `persist.ts` borre y recree productos y `resyncTypesense` recree la colección.
  // Un job huérfano de una migración a medias arrasaría el catálogo REAL.
  if (demo?.is_main) {
    logger.warn(
      `[demo-store cron] Job ${job.id} apunta a la tienda principal (${demo.id}): se descarta. ` +
        'La principal no importa catálogo — revisá cómo se creó ese job.',
    );
    await service.updateImportJobs({
      id: job.id,
      status: 'failed',
      finished_at: new Date(),
      error_log: {
        samples: ['La tienda principal no importa catálogo: su catálogo ya es de esta instancia.'],
      },
    });
    return;
  }

  if (!demo?.sales_channel_id) {
    await service.updateImportJobs({
      id: job.id,
      status: 'failed',
      finished_at: new Date(),
      error_log: { samples: ['La tienda no tiene sales channel aprovisionado; reintentá para reaprovisionar.'] },
    });
    return;
  }

  // Claim it so an overlapping tick's single-flight guard sees it as running.
  await service.updateImportJobs({ id: job.id, status: 'running', started_at: new Date() });
  logger.info(`[demo-store cron] Ejecutando importación ${job.id} para "${demo.slug}".`);

  await runImport(container, {
    demoStoreId: demo.id,
    importJobId: job.id,
    sourceType: job.source_type,
    sourceUrl: job.source_url,
    sourceConfig: demo.source_config,
    salesChannelId: demo.sales_channel_id,
    currencyCode: demo.currency_code,
    targetCount: job.target_count ?? undefined,
    demoSlug: demo.slug,
    // B2B: build the wholesale product links + tiered price list post-import.
    b2bEnabled: !!demo.b2b_enabled,
    b2bSalesChannelId: demo.b2b_sales_channel_id ?? null,
    b2bCustomerGroupId: demo.b2b_customer_group_id ?? null,
    regionId: demo.region_id ?? null,
  });
}

export const config = {
  name: 'process-demo-store-imports',
  schedule: process.env.DEMO_IMPORT_CRON || '*/5 * * * *',
};
