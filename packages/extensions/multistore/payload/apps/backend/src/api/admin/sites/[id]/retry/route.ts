import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { DEMO_STORE_MODULE } from '../../../../../modules/demo-store';
import { ensureDemoStoreTables } from '../../../../../modules/demo-store/ensure-tables';
import { isMainStore } from '../../../../../modules/demo-store/main-store';
import { isSalesChannelSource } from '../../../../../modules/demo-store/source-type';
import {
  adoptSourceSalesChannel,
  provisionDemoStore,
  provisionDemoB2B,
} from '../../../../../modules/demo-store/provision';

/**
 * Retry a demo's catalog import. Re-provisions the operational config first if
 * it never completed (no sales channel yet), then starts a fresh ImportJob in
 * the background. Used by the "Reintentar" admin action and to recover demos
 * that failed during provisioning.
 *
 * También repara las demos de origen `sales_channel` que quedaron con canal
 * duplicado (ver `adoptSourceSalesChannel`): las repunta al canal de origen y borra
 * el canal de más. El import que se encola después re-indexa Typesense, que es lo
 * que hace falta para que el cambio de canal se vea en el storefront.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const id = req.params.id as string;
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);
  const service: any = req.scope.resolve(DEMO_STORE_MODULE);

  await ensureDemoStoreTables(req.scope);

  const demo = await service.retrieveDemoStore(id);

  // La tienda principal NO se reintenta. Este handler es el ÚNICO caller de
  // `provisionDemoStore` y `adoptSourceSalesChannel` para una fila que ya existe:
  // sobre la principal re-provisionaría canal/región/stock location del sitio real,
  // podría borrar su canal por "duplicado" y además encola un import que arrasaría
  // el catálogo vía persist.ts.
  if (isMainStore(demo)) {
    res.status(409).json({
      message:
        'La tienda principal no se reintenta: no importa catálogo y re-provisionar ' +
        'tocaría el canal, la región y el depósito del sitio real.',
    });
    return;
  }

  // Supersede stale jobs: a prior run orphaned by a container restart (the import
  // is fire-and-forget, so a deploy/restart kills it mid-flight) leaves the job
  // stuck in 'running' and the store in 'importing'. Mark them failed so there's a
  // single in-flight job and the history isn't misleading.
  try {
    const stale = await service.listImportJobs({
      demo_store_id: demo.id,
      status: ['pending', 'running'],
    });
    for (const prev of stale as any[]) {
      await service.updateImportJobs({
        id: prev.id,
        status: 'failed',
        finished_at: new Date(),
        error_log: { samples: ['Reemplazada por una nueva importación (la anterior quedó trabada).'] },
      });
    }
  } catch (err) {
    logger.warn(`[demo-store] No se pudieron limpiar jobs trabados: ${(err as Error).message}`);
  }

  let salesChannelId = demo.sales_channel_id;
  let regionId = demo.region_id;
  let stockLocationId = demo.stock_location_id;
  let currencyCode = demo.currency_code;

  // Provision if it never completed (e.g. previous run failed before this step).
  if (!salesChannelId) {
    await service.updateDemoStores({ id: demo.id, status: 'provisioning' });
    try {
      const provision = await provisionDemoStore(req.scope, {
        id: demo.id,
        name: demo.name,
        slug: demo.slug,
        country_code: demo.country_code,
        currency_code: demo.currency_code,
        // Origen `sales_channel`: la demo adopta el canal de origen (`source_url`)
        // en vez de crear un canal nuevo con el mismo catálogo adentro.
        adoptSalesChannelId: isSalesChannelSource(demo.source_type) ? demo.source_url : null,
      });
      salesChannelId = provision.salesChannelId;
      regionId = provision.regionId;
      stockLocationId = provision.stockLocationId;
      currencyCode = provision.currencyCode;
      await service.updateDemoStores({
        id: demo.id,
        sales_channel_id: salesChannelId,
        region_id: regionId,
        stock_location_id: stockLocationId,
        currency_code: currencyCode,
      });
    } catch (err) {
      logger.error(`[demo-store] Retry provision failed: ${(err as Error).message}`);
      await service.updateDemoStores({ id: demo.id, status: 'failed' });
      res.status(500).json({ message: `Provisioning failed: ${(err as Error).message}` });
      return;
    }
  }

  // Canal duplicado: la demo tiene canal propio pero su catálogo sale de otro canal
  // de esta instancia. Se repunta al de origen y se borra el duplicado. Best-effort:
  // si algo falla, la demo sigue funcionando con el canal que ya tenía.
  if (
    isSalesChannelSource(demo.source_type) &&
    salesChannelId &&
    demo.source_url &&
    salesChannelId !== demo.source_url
  ) {
    try {
      const adopted = await adoptSourceSalesChannel(req.scope, {
        demoId: demo.id,
        sourceSalesChannelId: demo.source_url,
        currentSalesChannelId: salesChannelId,
        stockLocationId,
      });
      salesChannelId = adopted.salesChannelId;
      await service.updateDemoStores({ id: demo.id, sales_channel_id: salesChannelId });
    } catch (err) {
      logger.warn(
        `[demo-store] No se pudo repuntar la demo al canal de origen: ${(err as Error).message}`,
      );
    }
  }

  // (Re)provision B2B if enabled but not yet provisioned — recovers a B2B setup
  // that failed (best-effort) at create time. Idempotent: completes only the
  // missing pieces. The import enqueued below then builds the tiered price list.
  if (demo.b2b_enabled && !demo.b2b_sales_channel_id && regionId && stockLocationId) {
    try {
      const b2b = await provisionDemoB2B(req.scope, {
        id: demo.id,
        name: demo.name,
        slug: demo.slug,
        regionId,
        stockLocationId,
      });
      await service.updateDemoStores({
        id: demo.id,
        b2b_sales_channel_id: b2b.salesChannelId,
        b2b_customer_group_id: b2b.customerGroupId,
        b2b_company_id: b2b.companyId,
        ...(b2b.testEmail
          ? { b2b_test_email: b2b.testEmail, b2b_test_password: b2b.testPassword }
          : {}),
      });
    } catch (err) {
      logger.warn(`[demo-store] Retry B2B provision failed: ${(err as Error).message}`);
    }
  }

  // Enqueue the import as 'pending'; the process-demo-store-imports cron picks it
  // up and runs it. Durable: a server restart no longer kills an inline import.
  const job = await service.createImportJobs({
    demo_store_id: demo.id,
    source_type: demo.source_type,
    source_url: demo.source_url,
    target_count: demo.target_count ?? null,
    status: 'pending',
  });
  await service.updateDemoStores({ id: demo.id, status: 'importing' });

  res.status(200).json({
    demo_store: { ...demo, sales_channel_id: salesChannelId, region_id: regionId, stock_location_id: stockLocationId, status: 'importing' },
    import_job: job,
  });
}
