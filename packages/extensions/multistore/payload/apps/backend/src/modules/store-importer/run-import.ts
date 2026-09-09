/**
 * Async product-import runner for a demo store.
 */
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { DEMO_STORE_MODULE } from '../demo-store';
import { getImporter, isSalesChannelSource, type SourceType } from './importers';
import { countAdoptedChannelProducts, linkFromSalesChannel } from './link-from-sales-channel';
import { persistProducts } from '../demo-store/persist';
import { createDemoPromotions } from '../demo-store/promotions';
import { provisionDemoB2BPricing } from '../demo-store/b2b-pricing';
import { streamSyncProducts } from '../../api/store/custom/typesense-sync/loader';
import { ProductMapper } from '../typesense/product-mapper';
import { loadAdvisorRules } from '../typesense/advisor';
import TypeSenseService from '../typesense/service';

export type RunImportInput = {
  demoStoreId: string;
  importJobId: string;
  sourceType: SourceType;
  sourceUrl: string;
  sourceConfig?: Record<string, unknown> | null;
  salesChannelId: string;
  currencyCode: string;
  targetCount?: number | null;
  /** Demo slug — used to name the wholesale price list. */
  demoSlug?: string;
  /** B2B: when enabled, link the demo's products to the wholesale channel and
   *  (re)build the tiered price list after the import. */
  b2bEnabled?: boolean;
  b2bSalesChannelId?: string | null;
  b2bCustomerGroupId?: string | null;
  regionId?: string | null;
};

type ImportRunEvent = {
  at: string;
  stage: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  data?: Record<string, unknown>;
};

const normalizeTargetCount = (targetCount?: number | null): number | null =>
  Number.isFinite(targetCount) && targetCount && targetCount > 0
    ? Math.floor(targetCount)
    : null;

/**
 * Whether the sales channel already has products linked. Used to avoid regressing
 * a working store to 'failed' when a RE-import fails (e.g. the source rate-limited
 * us): the public storefront config 404s unless status === 'ready', so a transient
 * fetch failure must not break a store that still has a usable catalog.
 */
export async function salesChannelHasProducts(container: any, salesChannelId: string): Promise<boolean> {
  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    // Memory: query.graph can't FILTER products by sales_channels (only SELECT
    // the ids), so we page in small batches and SHORT-CIRCUIT on the first match
    // instead of loading the entire product table just to test membership — that
    // unbounded take OOM'd the 2GB box.
    const PAGE = 200;
    for (let offset = 0; ; offset += PAGE) {
      const { data } = await query.graph({
        entity: 'product',
        fields: ['id', 'sales_channels.id'],
        pagination: { skip: offset, take: PAGE },
      });
      const rows = (data ?? []) as any[];
      if (rows.length === 0) return false;
      const hit = rows.some(
        (p: any) =>
          Array.isArray(p.sales_channels) &&
          p.sales_channels.some((sc: any) => sc?.id === salesChannelId),
      );
      if (hit) return true;
      if (rows.length < PAGE) return false;
    }
  } catch {
    return false;
  }
}

export async function resyncTypesense(container: any): Promise<void> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  try {
    const service = new TypeSenseService();
    // Reglas del asesor guiado antes de mapear: si no, el resync de la demo
    // dejaría el índice sin los campos `advisor_*` (ver typesense/advisor.ts).
    await loadAdvisorRules(container);
    // Memory: stream the catalog page-by-page and index each page, then drop it,
    // instead of materializing the whole enriched catalog + a full docs array
    // (which OOM'd the 2GB box during demo imports). Recreate the collection
    // lazily on the first page so a failed load never wipes a working index.
    let indexed = 0;
    let recreated = false;
    const result = await streamSyncProducts(container, async (page) => {
      if (!recreated) {
        await service.recreateCollection();
        recreated = true;
      }
      for (const product of page) {
        try {
          const doc = ProductMapper.toTypesenseObject(product);
          await service.createDocumentInDB(doc);
          indexed++;
        } catch (err) {
          logger.warn(
            `[demo-store] Typesense resync failed for product ${String((product as any).id)}: ${(err as Error).message}`,
          );
        }
      }
    });
    if (!result.ok) {
      logger.warn(`[demo-store] Typesense resync skipped: ${result.message}`);
      return;
    }
    logger.info(`[demo-store] Typesense resync indexed ${indexed} products.`);
  } catch (err) {
    logger.warn(`[demo-store] Typesense resync failed: ${(err as Error).message}`);
  }
}

export async function runImport(container: any, input: RunImportInput): Promise<void> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const demoStoreService: any = container.resolve(DEMO_STORE_MODULE);

  // Último guard antes de `persistProducts` (que borra y recrea productos) y
  // `resyncTypesense` (que recrea la colección entera). El cron ya filtra la fila
  // principal, pero `runImport` es exportada: si mañana alguien la llama desde otro
  // lado, esto evita que un solo argumento equivocado arrase el catálogo real.
  const target = await demoStoreService
    .retrieveDemoStore(input.demoStoreId)
    .catch(() => null);
  if (target?.is_main) {
    logger.warn(
      `[demo-store] runImport abortado: ${input.demoStoreId} es la tienda principal, ` +
        'que no importa catálogo.',
    );
    return;
  }

  const startedAt = Date.now();
  const targetCount = normalizeTargetCount(input.targetCount);
  const events: ImportRunEvent[] = [];
  const errorSamples: string[] = [];

  const addEvent = (
    stage: string,
    message: string,
    level: ImportRunEvent['level'] = 'info',
    data?: Record<string, unknown>,
  ): void => {
    events.push({
      at: new Date().toISOString(),
      stage,
      level,
      message,
      ...(data ? { data } : {}),
    });
  };

  const durationMs = (): number => Date.now() - startedAt;

  try {
    addEvent('started', 'Import started', 'info', {
      source_type: input.sourceType,
      source_url: input.sourceUrl,
      target_count: targetCount,
    });
    await demoStoreService.updateImportJobs({
      id: input.importJobId,
      status: 'running',
      target_count: targetCount,
      started_at: new Date(startedAt),
      run_log: { events },
    });
    await demoStoreService.updateDemoStores({ id: input.demoStoreId, status: 'importing' });

    const sourceLogger = {
      info: (message: string) => {
        addEvent('source', message);
        logger.info(`[demo-store] ${message}`);
      },
      warn: (message: string) => {
        addEvent('source', message, 'warn');
        logger.warn(`[demo-store] ${message}`);
      },
    };

    let result;
    let fetchedCount: number;
    // Canal adoptado: la demo usa el canal de origen tal cual (`sourceUrl` guarda el
    // id de ese canal; ver el modelo DemoStore). No hay productos que vincular ni
    // stock que heredar, y no se le tocan las promociones a un canal preexistente.
    const adoptedChannel =
      isSalesChannelSource(input.sourceType) && input.sourceUrl === input.salesChannelId;

    if (adoptedChannel) {
      const countResult = await countAdoptedChannelProducts(container, {
        salesChannelId: input.salesChannelId,
        currencyCode: input.currencyCode,
        logger: sourceLogger,
      });
      fetchedCount = countResult.sourceProducts;
      result = countResult;
      await demoStoreService.updateImportJobs({
        id: input.importJobId,
        total_products: countResult.sourceProducts,
        fetched_products: countResult.sourceProducts,
        linked_products: 0,
        duration_ms: durationMs(),
      });
      addEvent('fetched', `La demo usa el canal existente con ${countResult.sourceProducts} productos`, 'info', {
        source_products: countResult.sourceProducts,
        without_price_in_currency: countResult.withoutPriceInCurrency,
        adopted_sales_channel_id: input.salesChannelId,
      });
    } else if (isSalesChannelSource(input.sourceType)) {
      // Demos anteriores al fix del canal duplicado: tienen canal propio, así que los
      // productos del canal de origen se vinculan a ese canal (no se clonan).
      const linkResult = await linkFromSalesChannel(container, {
        sourceSalesChannelId: input.sourceUrl,
        targetSalesChannelId: input.salesChannelId,
        currencyCode: input.currencyCode,
        targetCount,
        logger: sourceLogger,
        onProgress: async (progress) => {
          await demoStoreService.updateImportJobs({
            id: input.importJobId,
            total_products: progress.total,
            fetched_products: progress.total,
            linked_products: progress.linked,
            duration_ms: durationMs(),
          });
        },
      });
      fetchedCount = linkResult.sourceProducts;
      result = linkResult;
      addEvent('fetched', `Canal de origen con ${linkResult.sourceProducts} productos`, 'info', {
        source_products: linkResult.sourceProducts,
        already_linked: linkResult.alreadyLinked,
        without_price_in_currency: linkResult.withoutPriceInCurrency,
        // Sin ubicaciones heredadas, los productos con inventario gestionado
        // quedan sin stock en la demo (el add-to-cart falla).
        stock_locations_linked: linkResult.stockLocationsLinked,
      });
    } else {
      const importer = getImporter(input.sourceType);
      const products = await importer({
        sourceUrl: input.sourceUrl,
        sourceConfig: input.sourceConfig,
        targetCount: targetCount ?? undefined,
        logger: sourceLogger,
      });

      fetchedCount = products.length;
      addEvent('fetched', `Fetched ${products.length} products`, 'info', {
        fetched_products: products.length,
      });
      await demoStoreService.updateImportJobs({
        id: input.importJobId,
        total_products: products.length,
        fetched_products: products.length,
        run_log: { events },
      });

      result = await persistProducts(container, {
        salesChannelId: input.salesChannelId,
        currencyCode: input.currencyCode,
        products,
        onProgress: async (progress) => {
          await demoStoreService.updateImportJobs({
            id: input.importJobId,
            total_products: progress.total,
            fetched_products: products.length,
            imported_products: progress.imported,
            linked_products: progress.linked,
            skipped_products: progress.skipped,
            failed_products: progress.failed,
            duration_ms: durationMs(),
          });
        },
      });
    }

    addEvent('persisted', 'Products persisted', 'info', {
      created: result.created,
      recreated: result.recreated,
      linked_existing: result.linkedExisting,
      skipped: result.skipped,
      failed: result.failed,
      skipped_reasons: result.skippedReasons,
      linked_brands: result.linkedBrands,
      categories: result.categories,
      ...(result.errors.length ? { error_samples: result.errors.slice(0, 5) } : {}),
    });

    // Promociones de demo: se saltean cuando el canal es adoptado. Las promos se
    // scopean POR CANAL, así que sobre un canal preexistente aparecerían también en
    // lo que ya usa ese canal — el import no debería salir a poner en oferta un
    // catálogo que no creó. Siguen disponibles a mano, con el botón "Crear
    // promociones" del admin.
    if (adoptedChannel) {
      addEvent(
        'promotions',
        'Promociones de demo omitidas: el canal es preexistente y las promos se aplicarían a todo lo que lo use. ' +
          'Se pueden crear a mano desde "Crear promociones".',
        'warn',
      );
    } else {
      try {
        const promoResult = await createDemoPromotions(container, input.salesChannelId);
        addEvent('promotions', 'Demo promotions created', 'info', {
          promotions: promoResult.promotions,
          promoted_products: promoResult.promotedProducts,
          total_products: promoResult.totalProducts,
        });
        logger.info(
          `[demo-store] Promotions: ${promoResult.promotions} over ${promoResult.promotedProducts}/${promoResult.totalProducts} products.`,
        );
      } catch (err) {
        const message = (err as Error).message;
        addEvent('promotions', `Demo promotions skipped: ${message}`, 'warn');
        logger.warn(`[demo-store] Demo promotions skipped: ${message}`);
      }
    }

    // B2B: link the demo's products to the wholesale channel + (re)build the
    // tiered price list. Best-effort so a wholesale hiccup never fails the import.
    if (input.b2bEnabled && input.b2bSalesChannelId) {
      try {
        const currentStore = await demoStoreService.retrieveDemoStore(input.demoStoreId);
        const b2bResult = await provisionDemoB2BPricing(container, {
          priceListId: currentStore.b2b_price_list_owned === false ? currentStore.b2b_price_list_id : undefined,
          demoSlug: input.demoSlug ?? input.demoStoreId,
          sourceSalesChannelId: input.salesChannelId,
          b2bSalesChannelId: input.b2bSalesChannelId,
          customerGroupId: input.b2bCustomerGroupId ?? null,
          currencyCode: input.currencyCode,
          regionId: input.regionId ?? null,
        });
        if (b2bResult.priceListId) {
          await demoStoreService.updateDemoStores({
            id: input.demoStoreId,
            b2b_price_list_id: b2bResult.priceListId,
          });
        }
        addEvent('b2b', 'B2B pricing built', 'info', {
          linked_products: b2bResult.linkedProducts,
          price_list_id: b2bResult.priceListId,
          tier_prices: b2bResult.tierPrices,
        });
        logger.info(
          `[demo-store] B2B pricing: linked ${b2bResult.linkedProducts} products, price list ${b2bResult.priceListId} (${b2bResult.tierPrices} tier prices).`,
        );
      } catch (err) {
        const message = (err as Error).message;
        addEvent('b2b', `B2B pricing skipped: ${message}`, 'warn');
        logger.warn(`[demo-store] B2B pricing skipped: ${message}`);
      }
    }

    addEvent('typesense', 'Typesense resync started');
    await resyncTypesense(container);
    addEvent('typesense', 'Typesense resync finished');
    addEvent('completed', 'Import completed', 'info', {
      created: result.created,
      recreated: result.recreated,
      linked_existing: result.linkedExisting,
      skipped: result.skipped,
      failed: result.failed,
      duration_ms: durationMs(),
    });

    await demoStoreService.updateImportJobs({
      id: input.importJobId,
      status: 'completed',
      total_products: fetchedCount,
      fetched_products: fetchedCount,
      imported_products: result.created,
      linked_products: result.linkedExisting,
      skipped_products: result.skipped,
      failed_products: result.failed,
      duration_ms: durationMs(),
      run_log: { events },
      error_log: result.errors.length ? { samples: result.errors } : null,
      finished_at: new Date(),
    });
    await demoStoreService.updateDemoStores({ id: input.demoStoreId, status: 'ready' });

    logger.info(
      `[demo-store] Import done for ${input.demoStoreId}: ${result.created} created (${result.recreated} recreated), ${result.linkedExisting} linked, ${result.skipped} skipped, ${result.failed} failed.`,
    );
  } catch (err) {
    const message = (err as Error).message;
    errorSamples.push(message);
    addEvent('failed', message, 'error');
    logger.error(`[demo-store] Import failed for ${input.demoStoreId}: ${message}`);
    // Keep the store usable if it already has a catalog: only the import job fails,
    // the store stays 'ready' so the storefront keeps working with existing products.
    const keepReady = await salesChannelHasProducts(container, input.salesChannelId);
    if (keepReady) {
      addEvent(
        'recovered',
        'La importación falló pero la tienda conserva su catálogo previo; se mantiene publicada.',
        'warn',
      );
    }
    try {
      await demoStoreService.updateImportJobs({
        id: input.importJobId,
        status: 'failed',
        duration_ms: durationMs(),
        error_log: { samples: errorSamples },
        run_log: { events },
        finished_at: new Date(),
      });
      await demoStoreService.updateDemoStores({
        id: input.demoStoreId,
        status: keepReady ? 'ready' : 'failed',
      });
    } catch {
      /* nothing else to do */
    }
  }
}
