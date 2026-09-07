import type { Logger, MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys, MedusaError, Modules } from '@medusajs/framework/utils';
import { ERP_MODULE } from '../index';
import type ErpModuleService from '../service';
import type { ErpConfigRow } from '../service';
import { getErpAdapter } from '../adapters/registry';
import {
  ErpAuthError,
  ErpConnectionError,
  type ErpCatalogRow,
  type ErpCategoryNode,
} from '../adapters/types';
import { findDuplicateBarcodes } from '../barcode';
import { mergeImageFailures, type ImageFailures } from './image-failures';
import { sanitizePayload, truncateError } from '../sanitize';
import {
  DEFAULT_CATALOG_SYNC_SETTINGS,
  DEFAULT_PRODUCT_FIELDS,
  type ErpCatalogSyncSettings,
  type ErpSyncLogItemStatus,
  type ErpSyncTrigger,
} from '../types';
import {
  applyProductChanges,
  applyProductMetadata,
  readExistingProducts,
  readProductCategoryState,
} from './apply-product-changes';
import {
  applyBrandAssignments,
  readBrandState,
  resolveBrandWriter,
} from './apply-brand-assignments';
import { applyCategoryAssignments } from './apply-category-assignments';
import { applyCategoryTree, readExistingCategories } from './apply-category-tree';
import { planBrandAssignments } from './plan-brand-assignments';
import { planCategoryAssignments } from './plan-category-assignments';
import { isErpOwned, planCategoryTree } from './plan-category-tree';
import {
  planPriceUpdate,
  type ExistingPrice,
  type PriceListTarget,
  type PriceWrite,
  type VariantCatalogEntry,
} from './plan-price-updates';
import { planProductMetadata, planProductUpdate } from './plan-product-updates';
import { planProductStatuses } from './plan-product-status';
import { applyProductStatuses, readErpOwnedProducts } from './apply-product-status';
import { applyColorOptions, readColorState } from './apply-color-option';
import { applyProductImages, readProductImageState } from './apply-product-images';
import {
  resolveImagePhaseScope,
  shouldWritePriceListsOnRun,
  type ImagePhaseScope,
} from './full-sweep-scope';
import { planProductImages } from './plan-product-images';
import { planColorOptions } from './color-option';
import { applyPresentationOptions, readPresentationState } from './apply-presentation-option';
import { planPresentationOptions } from './presentation-option';
import { resolveTitleRules } from './product-title';
import { resolvePriceLists } from './resolve-price-lists';

/**
 * Catalog sync ERP → Medusa: precios (base + price lists) y, opcionalmente,
 * alta de productos nuevos (borrador o publicados, según configuración) e
 * importación de sus imágenes.
 *
 * Estructura calcada del stock sync (`run-stock-sync.ts`), incluidas sus
 * garantías:
 *
 *  A) Lee TODO (catálogo del ERP + estado actual de Medusa) sin escribir nada.
 *     Un error de conexión/auth del ERP acá aborta con CERO writes: es preferible
 *     seguir vendiendo a precios viejos que dejar el catálogo a medio actualizar.
 *  B) Clasifica cada artículo con `planPriceUpdate` (función pura) y aplica los
 *     cambios en tandas, persistiendo un `erp_sync_log_item` por artículo.
 *
 * Concurrencia: guard por DB (log `running` con actividad fresca → CONFLICT) +
 * lock `erp:catalog-sync` del módulo LOCKING. Un restart a mitad de sync deja el
 * log `running` → el sweep lo marca `failed` y se puede volver a correr (el sync
 * es idempotente).
 *
 * Decisiones de escritura, verificadas contra el Medusa 2.17.2 instalado:
 * - El precio base se escribe con `pricing.addPrices`, NO con
 *   `updateProductVariantsWorkflow`: ese workflow pasa las `prices` a
 *   `upsertPriceSets`, que hard-deletea del price set todo precio que no venga en
 *   el payload (otras monedas, precios con regla de región, tramos por cantidad).
 * - Además `updateProductVariantsWorkflow` emite `product-variant.updated`, que
 *   en este repo dispara un reindex de Typesense POR VARIANTE
 *   (`subscribers/product-variant-typesense-sync.ts`). Ir por el módulo de
 *   pricing lo evita y permite un solo reindex batcheado al final.
 * - Los deltas de monto en price lists van por `pricing.updatePrices([{id,
 *   amount}])`, que esquiva el colapso silencioso de filas por hash de
 *   `batchPriceListPricesWorkflow` (si no se mandan currency_code +
 *   min_quantity + max_quantity, dos filas de la misma variante se pisan sin
 *   error). El workflow se usa solo para `create`.
 */

/**
 * Evento que emite el catalog sync al terminar, con los productos cuyos precios
 * cambiaron. Lo consume quien tenga que reaccionar (hoy: el reindex de la
 * búsqueda). El nombre es parte del contrato público del módulo.
 */
export const ERP_CATALOG_PRICES_UPDATED = 'erp.catalog-prices-updated';

/** Un log `running` sin actividad por más de esto se considera huérfano. */
export const CATALOG_SYNC_STALE_MS = 20 * 60 * 1000;
const LOCK_KEY = 'erp:catalog-sync';
const VARIANT_PAGE_SIZE = 500;
const PRICE_READ_CHUNK = 500;
const LINK_PAGE_SIZE = 1000;

type StartCatalogSyncOptions = {
  trigger: ErpSyncTrigger;
  actorId?: string | null;
  /** No escribe nada: registra en el log lo que HARÍA. */
  dryRun?: boolean;
  /** Ignora el watermark y pide el catálogo completo. */
  fullSweep?: boolean;
  /**
   * Fuerza la retro-atribución de categoría/familia/marca sobre TODO el
   * catálogo, aunque el delta traiga pocas filas.
   */
  categoriesBackfill?: boolean;
};

export type StartCatalogSyncResult = {
  sync_log_id: string;
  /** Nunca rechaza: todo error termina registrado en el log. */
  completion: Promise<void>;
};

type CatalogCounts = Record<ErpSyncLogItemStatus, number> & { products_created: number };

/** Superficie de escritura del módulo de pricing que usa el sync (ver el cast). */
type PricingWriter = {
  addPrices(
    data: Array<{ priceSetId: string; prices: Array<Record<string, unknown>> }>
  ): Promise<unknown>;
  updatePrices(data: Array<{ id: string; amount: number }>): Promise<unknown>;
};

const emptyCounts = (): CatalogCounts => ({
  updated: 0,
  not_found: 0,
  duplicate_sku: 0,
  invalid_quantity: 0,
  skipped: 0,
  failed: 0,
  created: 0,
  price_unchanged: 0,
  no_price_set: 0,
  variant_not_found: 0,
  not_published: 0,
  products_created: 0,
});

const lastActivity = (log: { updated_at?: unknown; started_at?: unknown }): number => {
  const value = (log.updated_at ?? log.started_at) as string | Date | null | undefined;
  const ts = value ? new Date(value).getTime() : 0;
  return Number.isFinite(ts) ? ts : 0;
};

/** Marca `failed` los catalog syncs `running` huérfanos (restart a mitad de sync). */
export async function sweepStaleCatalogSyncLogs(container: MedusaContainer): Promise<number> {
  const service = container.resolve<ErpModuleService>(ERP_MODULE);
  const running = (await service.listErpSyncLogs(
    { type: 'catalog_sync', status: 'running' },
    { take: 20 }
  )) as Array<{ id: string; updated_at?: unknown; started_at?: unknown }>;
  const cutoff = Date.now() - CATALOG_SYNC_STALE_MS;
  const stale = running.filter((log) => lastActivity(log) <= cutoff);
  for (const log of stale) {
    await service.updateErpSyncLogs({
      id: log.id,
      status: 'failed' as const,
      finished_at: new Date(),
      error: { message: 'Sincronización de catálogo interrumpida (posible restart del servidor).' },
    });
  }
  return stale.length;
}

function resolveSettings(config: ErpConfigRow): Required<
  Pick<
    ErpCatalogSyncSettings,
    | 'currency_code'
    | 'base_list_index'
    | 'only_published'
    | 'create_products'
    | 'overlap_minutes'
    | 'max_change_pct'
    | 'status_sync'
    | 'status_sync_unpublish_missing'
    | 'max_unpublish_pct'
    | 'write_chunk_size'
  >
> &
  ErpCatalogSyncSettings {
  const raw = config.settings?.catalog_sync ?? {};
  return {
    ...raw,
    currency_code: (raw.currency_code ?? DEFAULT_CATALOG_SYNC_SETTINGS.currency_code).toLowerCase(),
    base_list_index: raw.base_list_index ?? DEFAULT_CATALOG_SYNC_SETTINGS.base_list_index,
    only_published: raw.only_published ?? DEFAULT_CATALOG_SYNC_SETTINGS.only_published,
    create_products: raw.create_products ?? DEFAULT_CATALOG_SYNC_SETTINGS.create_products,
    overlap_minutes: raw.overlap_minutes ?? DEFAULT_CATALOG_SYNC_SETTINGS.overlap_minutes,
    max_change_pct: raw.max_change_pct ?? DEFAULT_CATALOG_SYNC_SETTINGS.max_change_pct,
    status_sync: raw.status_sync ?? DEFAULT_CATALOG_SYNC_SETTINGS.status_sync,
    status_sync_unpublish_missing:
      raw.status_sync_unpublish_missing ??
      DEFAULT_CATALOG_SYNC_SETTINGS.status_sync_unpublish_missing,
    max_unpublish_pct: raw.max_unpublish_pct ?? DEFAULT_CATALOG_SYNC_SETTINGS.max_unpublish_pct,
    write_chunk_size: raw.write_chunk_size ?? DEFAULT_CATALOG_SYNC_SETTINGS.write_chunk_size,
  };
}

/**
 * Corre el watermark hacia atrás `overlapMinutes`. Los timestamps de Zeus son
 * hora local del server SIN offset (`AAAA-MM-DD hh:mm:ss.SSS`), así que la
 * aritmética se hace tratándolos como UTC y se re-serializa en el mismo formato:
 * lo único que importa es que el corrimiento sea consistente, no el huso.
 */
function chunkSizeOf(settings: { write_chunk_size: number }): number {
  return Math.max(settings.write_chunk_size, 1);
}

/**
 * Catálogo de Medusa indexado por SKU, detectando SKUs duplicados (que después
 * el planner descarta sin escribir). `price_set_id` lo completa el caller con el
 * mapa de links.
 */
async function readVariantCatalog(
  query: { graph(config: Record<string, unknown>): Promise<{ data: unknown[] }> }
): Promise<Map<string, VariantCatalogEntry>> {
  type VariantRow = { id: string; sku: string | null; product_id: string | null };
  const catalog = new Map<string, VariantCatalogEntry>();
  for (let skip = 0; ; skip += VARIANT_PAGE_SIZE) {
    const { data } = await query.graph({
      entity: 'product_variant',
      fields: ['id', 'sku', 'product_id'],
      pagination: { skip, take: VARIANT_PAGE_SIZE, order: { id: 'ASC' } },
    });
    const variants = data as VariantRow[];
    for (const variant of variants) {
      const sku = variant.sku?.trim();
      if (!sku) continue;
      const entry = catalog.get(sku);
      if (entry) {
        entry.variant_ids.push(variant.id);
      } else {
        catalog.set(sku, {
          sku,
          variant_ids: [variant.id],
          price_set_id: null,
          product_id: variant.product_id ?? null,
        });
      }
    }
    if (variants.length < VARIANT_PAGE_SIZE) break;
  }
  return catalog;
}

export function applyOverlap(watermark: string, overlapMinutes: number): string {
  const normalized = watermark.trim().replace(' ', 'T');
  const asUtc = new Date(`${normalized.slice(0, 23)}Z`);
  if (Number.isNaN(asUtc.getTime())) return watermark;
  const shifted = new Date(asUtc.getTime() - overlapMinutes * 60_000);
  return shifted.toISOString().slice(0, 19).replace('T', ' ');
}

export async function startCatalogSync(
  container: MedusaContainer,
  opts: StartCatalogSyncOptions
): Promise<StartCatalogSyncResult> {
  const service = container.resolve<ErpModuleService>(ERP_MODULE);
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);

  const config = await service.getActiveConfig();
  if (!config) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, 'La integración ERP está deshabilitada.');
  }
  if (!config.catalog_sync_enabled) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      'El sync de catálogo está deshabilitado en la configuración ERP.'
    );
  }
  const adapter = getErpAdapter(config.provider);
  if (!adapter.getCapabilities().catalog_pull || !adapter.getCatalogChanges) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `El provider ${config.provider} no soporta lectura de catálogo (capability catalog_pull).`
    );
  }
  const credentials = service.getDecryptedCredentials(config);
  if (!credentials) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      'No hay credenciales ERP válidas guardadas; re-ingresalas desde la configuración.'
    );
  }

  await sweepStaleCatalogSyncLogs(container);

  // Guard por DB: un solo catalog sync activo (cross-container, sin depender del lock).
  const running = (await service.listErpSyncLogs(
    { type: 'catalog_sync', status: 'running' },
    { take: 5 }
  )) as Array<{ id: string; updated_at?: unknown; started_at?: unknown }>;
  if (running.some((log) => Date.now() - lastActivity(log) < CATALOG_SYNC_STALE_MS)) {
    throw new MedusaError(MedusaError.Types.CONFLICT, 'Ya hay una sincronización de catálogo en curso.');
  }

  const log = (await service.createErpSyncLogs({
    type: 'catalog_sync',
    provider: config.provider,
    trigger: opts.trigger,
    status: 'running',
    started_at: new Date(),
    created_by: opts.actorId ?? null,
  })) as { id: string };

  const completion = executeCatalogSync(container, {
    config,
    credentials,
    syncLogId: log.id,
    dryRun: Boolean(opts.dryRun),
    fullSweep: Boolean(opts.fullSweep),
    categoriesBackfill: Boolean(opts.categoriesBackfill),
  }).catch(async (error) => {
    // Última red de seguridad: cualquier error no manejado queda en el log.
    logger.error(`[erp] catalog sync ${log.id} murió inesperadamente: ${truncateError(error)}`);
    await service
      .updateErpSyncLogs({
        id: log.id,
        status: 'failed' as const,
        finished_at: new Date(),
        error: { message: truncateError(error) },
      })
      .catch(() => undefined);
  });

  return { sync_log_id: log.id, completion };
}

async function executeCatalogSync(
  container: MedusaContainer,
  opts: {
    config: ErpConfigRow;
    credentials: Record<string, string>;
    syncLogId: string;
    dryRun: boolean;
    fullSweep: boolean;
    categoriesBackfill?: boolean;
  }
): Promise<void> {
  const { config, credentials, syncLogId, dryRun, fullSweep } = opts;
  const service = container.resolve<ErpModuleService>(ERP_MODULE);
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const startedAt = Date.now();

  const runLocked = async (job: () => Promise<void>): Promise<void> => {
    let locking: {
      execute<T>(keys: string | string[], job: () => Promise<T>, args?: { timeout?: number }): Promise<T>;
    } | null = null;
    try {
      locking = container.resolve(Modules.LOCKING);
    } catch {
      // Sin módulo de locking corremos igual: el guard por DB ya nos cubre.
      locking = null;
    }
    if (!locking) {
      await job();
      return;
    }
    try {
      await locking.execute(LOCK_KEY, job, { timeout: 5 });
    } catch (error) {
      if (error instanceof Error && /timed?[ -]?out|acquire/i.test(error.message)) {
        throw new MedusaError(MedusaError.Types.CONFLICT, 'Otra sincronización tiene tomado el lock.');
      }
      throw error;
    }
  };

  const failLog = async (message: string, extra?: Record<string, unknown>): Promise<void> => {
    await service.updateErpSyncLogs({
      id: syncLogId,
      status: 'failed' as const,
      finished_at: new Date(),
      summary: { duration_ms: Date.now() - startedAt, dry_run: dryRun, ...extra },
      error: { message },
    });
  };

  await runLocked(async () => {
    const adapter = getErpAdapter(config.provider);
    const settings = resolveSettings(config);
    const currency = settings.currency_code;
    const adapterCtx = {
      credentials,
      settings: (config.settings ?? {}) as Record<string, unknown>,
      countryCode: config.country_code,
      logger,
    };

    // ── Fase A.1: catálogo del ERP (sin escribir nada) ───────────────────────
    const watermark = settings.last_synced_at ?? null;
    const since = fullSweep || !watermark ? null : applyOverlap(watermark, settings.overlap_minutes);

    let erpRows: ErpCatalogRow[];
    try {
      erpRows = await adapter.getCatalogChanges!(since, adapterCtx);
    } catch (error) {
      const kind =
        error instanceof ErpAuthError
          ? 'credenciales'
          : error instanceof ErpConnectionError
            ? 'conexión'
            : 'inesperado';
      await failLog(
        `El ERP falló al leer el catálogo (${kind}): ${truncateError(error)}. No se modificó ningún precio.`
      );
      return;
    }

    if (!erpRows.length) {
      await service.updateErpSyncLogs({
        id: syncLogId,
        status: 'completed' as const,
        finished_at: new Date(),
        summary: {
          total_erp_rows: 0,
          since,
          full_sweep: fullSweep,
          dry_run: dryRun,
          duration_ms: Date.now() - startedAt,
        },
      });
      logger.info(`[erp] catalog sync ${syncLogId}: sin cambios en el ERP desde ${since ?? 'siempre'}.`);
      return;
    }

    // ── Fase A.1b: árbol de categorías del ERP (tolerante a fallo) ───────────
    // Va después de A.1 a propósito: las credenciales ya se probaron, así que un
    // fallo acá es del endpoint de categorías y no debe arruinar los precios.
    const categoryWarnings: string[] = [];
    const categoriesEnabled =
      (settings.categories_sync ?? false) &&
      adapter.getCapabilities().categories_pull &&
      Boolean(adapter.fetchCategories);
    let erpCategories: ErpCategoryNode[] = [];
    if (categoriesEnabled) {
      try {
        erpCategories = await adapter.fetchCategories!(adapterCtx);
      } catch (error) {
        categoryWarnings.push(
          `No se pudo leer el árbol de categorías del ERP: ${truncateError(error)}. ` +
            'Los precios se sincronizaron igual.'
        );
      }
    } else if (settings.categories_sync && !adapter.getCapabilities().categories_pull) {
      categoryWarnings.push(
        `El provider ${config.provider} no expone el árbol de categorías (capability categories_pull).`
      );
    }

    // El watermark nuevo es el máximo `modified_at` que devolvió el ERP (valor
    // del servidor), no la hora local del proceso.
    const maxModifiedAt = erpRows
      .map((row) => row.modified_at ?? '')
      .filter(Boolean)
      .sort()
      .pop();

    // ── Fase A.2: catálogo de Medusa por SKU (sin escribir nada) ─────────────
    let catalog = await readVariantCatalog(query);

    // ── Guard de sanidad: un delta desproporcionado no se aplica ─────────────
    // Va ANTES de cualquier escritura (incluida el alta de productos).
    const matchable = erpRows.filter((row) => catalog.has(row.code)).length;
    const changePct = catalog.size ? (matchable / catalog.size) * 100 : 0;
    if (!fullSweep && since && catalog.size > 0 && changePct > settings.max_change_pct) {
      await failLog(
        `El delta del ERP toca ${matchable} de ${catalog.size} variantes (${changePct.toFixed(1)}%), ` +
          `por encima del máximo configurado (${settings.max_change_pct}%). No se escribió nada. ` +
          'Revisá el watermark o corré un barrido completo manual si el cambio masivo es esperado.',
        { total_erp_rows: erpRows.length, matchable, change_pct: Number(changePct.toFixed(2)) }
      );
      return;
    }

    // ── Fase B.0: espejo del árbol de categorías ─────────────────────────────
    // Antes de B.1 porque el alta de un producto usa la categoría resuelta.
    let categoryIdByCode = new Map<string, string>();
    let erpOwnedCategoryIds = new Set<string>();
    const treeCounts = {
      nodes: erpCategories.length,
      created: 0,
      updated: 0,
      unchanged: 0,
      orphans: 0,
      planned_creates: 0,
      planned_updates: 0,
    };
    if (erpCategories.length) {
      const existingCategories = await readExistingCategories(container);
      const treePlan = planCategoryTree({
        nodes: erpCategories,
        existing: existingCategories,
        provider: config.provider,
        syncRank: settings.categories_sync_rank ?? false,
      });
      categoryWarnings.push(...treePlan.warnings);
      treeCounts.unchanged = treePlan.unchanged;
      treeCounts.orphans = treePlan.orphans.length;

      if (dryRun) {
        treeCounts.planned_creates = treePlan.creates.flat().length;
        treeCounts.planned_updates = treePlan.updates.length;
        categoryIdByCode = treePlan.resolved;
        erpOwnedCategoryIds = new Set(
          existingCategories
            .filter((category) => isErpOwned(category.external_id, config.provider))
            .map((category) => category.id)
        );
        if (treeCounts.planned_creates) {
          categoryWarnings.push(
            `Dry-run: ${treeCounts.planned_creates} categoría(s) del ERP todavía no existen y no se crean ` +
              'en modo simulación; los artículos que cuelgan de ellas figuran con código desconocido.'
          );
        }
      } else {
        const applied = await applyCategoryTree(
          container,
          treePlan,
          config.provider,
          existingCategories
        );
        categoryIdByCode = applied.categoryIdByCode;
        erpOwnedCategoryIds = applied.erpOwnedCategoryIds;
        treeCounts.created = applied.created;
        treeCounts.updated = applied.updated;
        categoryWarnings.push(...applied.errors);
      }
    }

    // ── Fase A.2b: filas de atribución (categoría / familia / marca) ─────────
    // Normalmente es el delta. Con un backfill pendiente se pide el catálogo
    // COMPLETO una sola vez: la primera corrida tiene que retro-categorizar
    // miles de artículos aunque el delta traiga tres. Va DESPUÉS del guard de
    // `max_change_pct` a propósito — el guard mide el delta y el backfill no
    // debe alterarlo.
    const attributionEnabled = categoriesEnabled || Boolean(settings.brands_sync);
    const backfillPending =
      Boolean(settings.categories_backfill_pending) || Boolean(opts.categoriesBackfill);
    let attributionRows: ErpCatalogRow[] = erpRows;
    let backfillRan = false;
    if (attributionEnabled && backfillPending) {
      if (since === null) {
        // `erpRows` YA es el catálogo completo (full sweep o primera corrida).
        backfillRan = true;
      } else {
        try {
          attributionRows = await adapter.getCatalogChanges!(null, adapterCtx);
          backfillRan = true;
        } catch (error) {
          categoryWarnings.push(
            `Backfill: no se pudo pedir el catálogo completo (${truncateError(error)}); ` +
              'se atribuye solo el delta y el backfill queda pendiente.'
          );
        }
      }
    }

    // ── Fase B.1: productos (updates + altas) ────────────────────────────────
    // Va antes que los precios para que un producto recién creado reciba su
    // precio en la MISMA corrida.
    const productErrors = new Map<string, string>();
    const productStatuses = new Map<string, ErpSyncLogItemStatus>();
    const productDetails = new Map<string, Record<string, unknown>>();
    const touchedProductIds = new Set<string>();
    /**
     * Códigos dados de alta en ESTA corrida. La fase de estado los excluye: el alta
     * ya decidió su estado con `created_product_status`, y si `status_sync` los
     * publicara acto seguido, elegir `draft` para revisarlos a mano no serviría
     * para nada.
     */
    const createdCodes = new Set<string>();
    let productsCreated = 0;

    const productFields = settings.product_fields ?? DEFAULT_PRODUCT_FIELDS;
    // El ERP manda la descripción como se cargó en la gestión (mayúsculas, marca
    // al inicio, `X 0,25 LTS`), así que el título nunca se copia literal: pasa por
    // las reglas de `product-title.ts`. `null` = normalización apagada.
    const titleRules = (settings.title_rules?.enabled ?? true)
      ? resolveTitleRules(settings.title_rules)
      : null;
    // Solo se cuentan los títulos ESCRITOS y los que dejaron warning: el
    // "no cambió" no se cuenta porque el planner no emite detalle en ese caso
    // (sería un payload por artículo en cada corrida, para decir que no pasó nada).
    const titleCounts = { normalized: 0, warnings: 0 };
    // El barcode del ERP viene de un campo de notas de texto libre, así que
    // "cuántos son GTIN válidos" es el dato que dice si ese campo sirve.
    const barcodeCounts = { valid: 0, rejected: 0, duplicated: 0 };
    // Un GTIN que reclaman varios artículos no se escribe en ninguno. Se calcula
    // sobre TODO el lote antes de planificar: es información que ninguna fila
    // tiene por sí sola.
    const duplicateBarcodes = findDuplicateBarcodes(erpRows);
    if (duplicateBarcodes.size) {
      barcodeCounts.duplicated = [...duplicateBarcodes.values()].reduce(
        (total, codes) => total + codes.length,
        0
      );
      const worst = [...duplicateBarcodes]
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 5)
        .map(([barcode, codes]) => `${barcode} (${codes.length}: ${codes.slice(0, 5).join(', ')})`);
      categoryWarnings.push(
        `${duplicateBarcodes.size} código(s) de barras están cargados en más de un artículo del ERP ` +
          `y no se escriben en ninguno: ${worst.join(' · ')}. Hay que dejarlos en un solo artículo.`
      );
    }
    const existingProducts = await readExistingProducts(
      container,
      erpRows.map((row) => row.code)
    );

    for (let i = 0; i < erpRows.length; i += chunkSizeOf(settings)) {
      const chunk = erpRows.slice(i, i + chunkSizeOf(settings));
      const productPlans = chunk.map((row) => ({
        code: row.code,
        row,
        plan: planProductUpdate({
          row,
          existing: existingProducts.get(row.code),
          fields: productFields,
          createProducts: settings.create_products,
          onlyPublished: settings.only_published,
          titleRules,
          duplicateBarcodes,
        }),
      }));

      for (const { code, row, plan } of productPlans) {
        productStatuses.set(code, plan.status);
        productDetails.set(code, plan.response_payload);
        const titleDetail = plan.response_payload.title_rules as
          | { written?: boolean; warnings?: string[] }
          | undefined;
        if (titleDetail) {
          if (titleDetail.written) titleCounts.normalized += 1;
          if (titleDetail.warnings?.length) titleCounts.warnings += 1;
        }
        // Se cuenta sobre la fila del ERP y no sobre el plan: interesa cuántos
        // artículos traen un barcode usable, tengan o no producto en Medusa. Un
        // código compartido no cuenta como válido: no se escribe en ninguno.
        if (row.barcode && !duplicateBarcodes.has(row.barcode)) barcodeCounts.valid += 1;
        else if (row.barcode_rejected) barcodeCounts.rejected += 1;
      }

      const actionable = productPlans.filter(
        ({ plan }) => plan.product_update || plan.variant_update || plan.status === 'created'
      );
      if (actionable.length && !dryRun) {
        const applied = await applyProductChanges(container, actionable, settings, categoryIdByCode);
        for (const [code, message] of applied.errors) productErrors.set(code, message);
        for (const id of applied.touchedProductIds) touchedProductIds.add(id);
        for (const code of applied.created.keys()) createdCodes.add(code);
        productsCreated += applied.created.size;
      }
    }

    // Si se crearon productos, el mapa por SKU quedó viejo: se relee para que la
    // fase de precios los encuentre.
    if (productsCreated > 0) {
      catalog = await readVariantCatalog(query);
    }

    // ── Fases B.1b/c/d: metadata de producto, categorías y marcas ────────────
    // Se leen los productos DESPUÉS de B.1 para que los recién creados también
    // queden categorizados y con marca en la misma corrida.
    const categoryCounts = {
      links_added: 0,
      links_removed: 0,
      unchanged: 0,
      articles_without_category: 0,
      articles_without_product: 0,
      unknown_codes: {} as Record<string, number>,
      planned_links: 0,
    };
    const brandCounts = { created: 0, links_added: 0, links_removed: 0, unchanged: 0 };
    let metadataPatches = 0;
    let categoryPerArticle = new Map<string, Record<string, unknown>>();
    let brandPerArticle = new Map<string, Record<string, unknown>>();

    if (attributionEnabled) {
      const attributionCodes = attributionRows.map((row) => row.code);
      const productState = await readProductCategoryState(container, attributionCodes);

      // B.1b — marca y familia a `product.metadata` (lo que indexa la búsqueda).
      const metadataPatchList: Array<{ product_id: string; metadata: Record<string, unknown> }> = [];
      for (const row of attributionRows) {
        const state = productState.get(row.code);
        if (!state) continue;
        const patch = planProductMetadata({
          row,
          current: state.product_metadata,
          fields: productFields,
        });
        if (patch) metadataPatchList.push({ product_id: state.product_id, metadata: patch });
      }
      if (metadataPatchList.length) {
        metadataPatches = metadataPatchList.length;
        if (!dryRun) {
          const applied = await applyProductMetadata(container, metadataPatchList);
          metadataPatches = applied.updated;
          categoryWarnings.push(...applied.errors);
          for (const patch of metadataPatchList) touchedProductIds.add(patch.product_id);
        }
      }

      // B.1c — categorización aditiva.
      if (categoriesEnabled && categoryIdByCode.size) {
        const assignmentPlan = planCategoryAssignments({
          rows: attributionRows.map((row) => ({ code: row.code, category_code: row.category_code })),
          productsByCode: productState,
          categoryIdByCode,
          erpOwnedCategoryIds,
        });
        categoryCounts.unchanged = assignmentPlan.unchanged;
        categoryCounts.articles_without_category = assignmentPlan.no_category;
        categoryCounts.articles_without_product = assignmentPlan.no_product;
        categoryCounts.unknown_codes = Object.fromEntries(
          [...assignmentPlan.unknown_codes].sort((a, b) => b[1] - a[1]).slice(0, 20)
        );
        categoryPerArticle = new Map(
          [...assignmentPlan.perArticle].map(([code, detail]) => [code, { ...detail }])
        );

        if (dryRun) {
          categoryCounts.planned_links = [...assignmentPlan.add.values()].reduce(
            (total, ids) => total + ids.length,
            0
          );
        } else {
          const applied = await applyCategoryAssignments(container, assignmentPlan);
          categoryCounts.links_added = applied.linksAdded;
          categoryCounts.links_removed = applied.linksRemoved;
          categoryWarnings.push(...applied.errors);
          // El workflow de link NO emite `product.updated`: sin esto los
          // productos recategorizados nunca se reindexarían.
          for (const id of assignmentPlan.touched_product_ids) touchedProductIds.add(id);
        }
      }

      // B.1d — marcas como entidades de la extensión Marcas.
      if (settings.brands_sync) {
        const brands = resolveBrandWriter(container);
        if (!brands) {
          categoryWarnings.push(
            'La extensión Marcas no está instalada: la marca se guardó en la metadata del producto ' +
              '(el filtro del storefront funciona) pero no se crearon entidades de marca.'
          );
        } else {
          try {
            const productIds = [...productState.values()].map((state) => state.product_id);
            const { brandIdByHandle, linksByProduct } = await readBrandState(brands, productIds);
            const brandPlan = planBrandAssignments({
              rows: attributionRows.map((row) => ({ code: row.code, brand: row.brand })),
              productsByCode: productState,
              existingBrandIdByHandle: brandIdByHandle,
              existingLinksByProduct: linksByProduct,
              replaceExisting: settings.brands_replace_existing ?? true,
            });
            brandCounts.unchanged = brandPlan.unchanged;
            brandPerArticle = new Map(
              [...brandPlan.perArticle].map(([code, detail]) => [code, { ...detail }])
            );

            if (dryRun) {
              brandCounts.created = brandPlan.creates.length;
              brandCounts.links_added = [...brandPlan.links.values()].reduce(
                (total, ids) => total + ids.length,
                0
              );
              brandCounts.links_removed = brandPlan.unlinkIds.length;
            } else {
              const applied = await applyBrandAssignments(
                brands,
                brandPlan,
                brandIdByHandle,
                config.provider
              );
              brandCounts.created = applied.brandsCreated;
              brandCounts.links_added = applied.linksAdded;
              brandCounts.links_removed = applied.linksRemoved;
              categoryWarnings.push(...applied.errors);
            }
          } catch (error) {
            categoryWarnings.push(`Falló la sincronización de marcas: ${truncateError(error)}`);
          }
        }
      }
    }

    // ── Fase B.1e: etiqueta de presentación en la opción de variante ─────────
    // Va DESPUÉS de B.1 para que un producto recién creado y los títulos recién
    // normalizados ya tengan `zeus_presentacion` en la metadata, que es de donde
    // sale la etiqueta.
    const presentationCounts = {
      renamed: 0,
      titles_updated: 0,
      unchanged: 0,
      planned: 0,
      skipped: {} as Record<string, number>,
    };
    const presentationEnabled = settings.presentation_option?.enabled ?? false;
    let presentationBackfillRan = false;
    /**
     * Filas que la fase de presentación terminó usando (delta o catálogo
     * completo). La fase de color las reusa: pedirle a Zeus el catálogo completo
     * una tercera vez en la misma corrida no le sirve a nadie.
     */
    let presentationRows: ErpCatalogRow[] | null = null;
    if (presentationEnabled) {
      // Con backfill pendiente se recorre el catálogo COMPLETO: la primera corrida
      // tiene que rellenar miles de placeholders aunque el delta traiga diez.
      const presentationPending = settings.presentation_option?.backfill_pending ?? false;
      let rows = erpRows;
      if (presentationPending) {
        if (since === null) {
          // `erpRows` YA es el catálogo completo (full sweep o primera corrida).
          presentationBackfillRan = true;
        } else if (attributionRows !== erpRows) {
          // El backfill de categorías ya pidió el catálogo completo: se reusa en
          // lugar de pegarle a Zeus una segunda vez.
          rows = attributionRows;
          presentationBackfillRan = true;
        } else {
          try {
            rows = await adapter.getCatalogChanges!(null, adapterCtx);
            presentationBackfillRan = true;
          } catch (error) {
            categoryWarnings.push(
              `Presentación: no se pudo pedir el catálogo completo (${truncateError(error)}); ` +
                'se rellenó solo el delta y el backfill queda pendiente.'
            );
          }
        }
      }
      presentationRows = rows;
      try {
        const states = await readPresentationState(
          container,
          rows.map((row) => row.code)
        );
        const plan = planPresentationOptions(states);
        presentationCounts.unchanged = plan.unchanged;
        presentationCounts.skipped = plan.skipped;
        if (dryRun) {
          presentationCounts.planned = plan.renames.length;
        } else {
          const applied = await applyPresentationOptions(container, plan);
          presentationCounts.renamed = applied.renamed;
          presentationCounts.titles_updated = applied.titles_updated;
          categoryWarnings.push(...applied.errors);
          // El módulo de producto no emite `product.updated`: sin esto las cards
          // quedarían con el placeholder en el índice de búsqueda.
          for (const id of applied.touchedProductIds) touchedProductIds.add(id);
          if (applied.errors.length) presentationBackfillRan = false;
        }
      } catch (error) {
        categoryWarnings.push(
          `Falló la etiqueta de presentación: ${truncateError(error)}. El resto del sync siguió.`
        );
        presentationBackfillRan = false;
      }
    }

    // ── Fase B.1f: opción de color ───────────────────────────────────────────
    // Zeus no manda color: sale del título contra un vocabulario cerrado, y el
    // sync lo dejó en `metadata.zeus_color` al normalizar. Va después de B.1e por
    // el mismo motivo: la metadata tiene que estar escrita antes de leerla.
    const colorCounts = {
      created: 0,
      planned: 0,
      /** Etiquetas de color corregidas in situ (`Marron` → `Marrón`). */
      renamed: 0,
      planned_renames: 0,
      /** La fase se corto por fallos consecutivos: quedo trabajo sin intentar. */
      aborted: false,
      skipped: {} as Record<string, number>,
    };
    const colorEnabled = settings.color_option?.enabled ?? false;
    let colorBackfillRan = false;
    if (colorEnabled) {
      const colorPending = settings.color_option?.backfill_pending ?? false;
      // Se reusa el alcance que ya resolvió la fase de presentación: pedirle a
      // Zeus el catálogo completo una tercera vez sería gratis para nadie.
      const rows = colorPending && presentationRows ? presentationRows : erpRows;
      colorBackfillRan = colorPending && rows !== erpRows;
      if (colorPending && rows === erpRows && since === null) colorBackfillRan = true;
      try {
        const plan = planColorOptions(await readColorState(container, rows.map((row) => row.code)));
        colorCounts.skipped = plan.skipped;
        if (dryRun) {
          colorCounts.planned = plan.creates.length;
          colorCounts.planned_renames = plan.renames.length;
        } else {
          const applied = await applyColorOptions(container, plan);
          colorCounts.created = applied.created;
          colorCounts.renamed = applied.renamed;
          colorCounts.aborted = applied.aborted;
          categoryWarnings.push(...applied.errors);
          for (const id of applied.touchedProductIds) touchedProductIds.add(id);
          if (applied.errors.length) colorBackfillRan = false;
        }
      } catch (error) {
        categoryWarnings.push(
          `Falló la opción de color: ${truncateError(error)}. El resto del sync siguió.`
        );
        colorBackfillRan = false;
      }
    }

    // ── Fase B.1g: imágenes del ERP ──────────────────────────────────────────
    // Va DESPUÉS de B.1 para que los productos recién creados entren con foto en
    // la misma corrida, y ANTES de los precios porque es la fase larga: si el
    // proceso se cae bajando 200 MB, los precios de esta corrida no se perdieron.
    //
    // Es la única fase que hace I/O pesado contra un server ajeno, así que va con
    // su propio touch de progreso: sin eso el log queda sin actividad más de 20
    // minutos y el sweep anti-huérfanos lo marca `failed` mientras corre.
    const imageCounts = {
      imported: 0,
      without_image: 0,
      /** El ERP tiene foto pero es demasiado chica para el storefront. */
      too_small: 0,
      failed: 0,
      planned: 0,
      megabytes: 0,
      aborted: false,
      /** Sobre qué filas corrió; ver `full-sweep-scope.ts`. */
      scope: 'skipped' as ImagePhaseScope,
      skipped: {} as Record<string, number>,
      tracked_failures: 0,
    };
    const imagesEnabled =
      (settings.images?.enabled ?? false) &&
      adapter.getCapabilities().product_images &&
      Boolean(adapter.fetchProductImage);
    let imagesBackfillRan = false;
    /** Un solo `now` para toda la fase: el cooldown y los strikes se comparan contra él. */
    const imagesNow = new Date();
    const imageFailures = settings.images?.failures;
    /** `null` = la fase no corrió y no hay nada que reescribir. */
    let nextImageFailures: ImageFailures | null = null;
    if (settings.images?.enabled && !adapter.getCapabilities().product_images) {
      categoryWarnings.push(
        `El provider ${config.provider} no expone imágenes de artículos (capability product_images).`
      );
    }
    /**
     * Alcance de la fase, y es lo que decide cuánta transferencia se paga:
     *
     *  - Con backfill pendiente: catálogo COMPLETO, reusando el que ya trajo otra
     *    fase si hay uno a mano.
     *  - Sin backfill, con delta: SOLO el delta.
     *  - Sin backfill, en barrido completo: NADA.
     *
     * El último caso es el que importa. `planProductImages` descarta todo producto
     * que ya tiene foto, así que lo que sobrevive en un barrido completo son
     * justamente los artículos SIN imagen — y 878 de los 2.547 de la cuenta real
     * no la tienen en Zeus tampoco. Volver a preguntarle por esos 878 en cada
     * barrido es transferencia y latencia para una respuesta que ya sabemos, y que
     * sólo puede cambiar si el artículo cambia — y eso entra por el delta: cargarle
     * la foto en Zeus le mueve `fechahoramodife`.
     *
     * En el BACKFILL, además, se saltean los artículos que vienen fallando
     * (`images.failures`). Sin eso el backfill no avanza nunca: un puñado de
     * códigos que siempre dan HTTP 500 se comen los 15 fallos consecutivos que
     * abortan la fase, y las corridas siguientes reintentan exactamente los
     * mismos. Medido en desdeelsur: `planned: 914, imported: 0` cada 15 minutos
     * durante días. Ver `image-failures.ts`.
     */
    let imageRows: ErpCatalogRow[] | null = null;
    if (imagesEnabled) {
      const scope = resolveImagePhaseScope({
        backfillPending: settings.images?.backfill_pending ?? false,
        fullCatalogRun: since === null,
        scanOnFullSweep: settings.full_sweep?.images ?? false,
      });
      if (scope === 'backfill') {
        // Se reusa el catálogo completo que ya trajo otra fase: pedírselo al ERP
        // una segunda vez en la misma corrida no le sirve a nadie.
        imageRows =
          since === null
            ? erpRows
            : attributionRows !== erpRows
              ? attributionRows
              : presentationRows && presentationRows !== erpRows
                ? presentationRows
                : null;
        if (!imageRows) {
          try {
            imageRows = await adapter.getCatalogChanges!(null, adapterCtx);
          } catch (error) {
            categoryWarnings.push(
              `Imágenes: no se pudo pedir el catálogo completo (${truncateError(error)}); ` +
                'el backfill queda pendiente.'
            );
          }
        }
        if (imageRows) {
          imagesBackfillRan = true;
          imageCounts.scope = 'backfill';
        }
      } else if (scope !== 'skipped') {
        // `delta` y `full_sweep` son las MISMAS filas (`erpRows`); lo que cambia es
        // qué son: el delta del ERP, o el catálogo entero cuando la corrida es un
        // barrido. Se distinguen en el log para que el operador vea qué pagó.
        imageRows = erpRows;
        imageCounts.scope = scope;
      }
    }
    if (imagesEnabled && imageRows) {
      const rows = imageRows;
      try {
        const states = await readProductImageState(
          container,
          rows.map((row) => row.code)
        );
        /**
         * La lista de fallidos se pasa SÓLO en el backfill. Si el artículo llega
         * por el delta es porque cambió en el ERP —cargarle la foto le mueve
         * `fechahoramodife`—, así que ahí se reintenta aunque esté en cooldown.
         */
        const plan = planProductImages(
          states,
          imageCounts.scope === 'backfill' ? { failures: imageFailures, now: imagesNow } : {}
        );
        imageCounts.planned = plan.fetches.length;
        imageCounts.skipped = plan.skipped;
        if (!dryRun) {
          const applied = await applyProductImages(container, adapter, adapterCtx, plan, {
            minDimensionPx: settings.images?.min_dimension_px,
            onProgress: async (imagesDone, imagesTotal) => {
              await service.updateErpSyncLogs({
                id: syncLogId,
                summary: {
                  phase: 'images',
                  images_done: imagesDone,
                  images_total: imagesTotal,
                  total_erp_rows: erpRows.length,
                  dry_run: dryRun,
                },
              });
            },
          });
          imageCounts.imported = applied.imported;
          imageCounts.without_image = applied.without_image;
          imageCounts.too_small = applied.too_small;
          imageCounts.failed = applied.failed;
          imageCounts.aborted = applied.aborted;
          imageCounts.megabytes = Number((applied.bytes / 1024 / 1024).toFixed(1));
          categoryWarnings.push(...applied.errors);
          for (const id of applied.touchedProductIds) touchedProductIds.add(id);
          /**
           * Se anota qué códigos fallaron para que la corrida siguiente los
           * saltee. Sin esto la fase reintenta el mismo bloque roto cada vez y
           * muere en el mismo lugar: medido en desdeelsur, `imported: 0` cada 15
           * minutos durante días con 914 productos esperando.
           */
          /**
           * Los descartados por resolución van al MISMO registro: el planner los
           * ve sin imagen y se los volvería a bajar cada 15 minutos para tirarlos
           * de nuevo. El cooldown de 7 días los reintenta solo, que es lo que se
           * quiere si alguien carga una foto mejor en el ERP.
           */
          nextImageFailures = mergeImageFailures(
            imageFailures,
            {
              failed: [...applied.failedCodes, ...applied.tooSmallCodes],
              imported: applied.importedCodes,
            },
            imagesNow
          );
          imageCounts.tracked_failures = Object.keys(nextImageFailures).length;
          // El backfill solo se da por hecho si NO quedó trabajo sin intentar.
          // `too_small` NO cuenta: el artículo se intentó y se resolvió: la foto
          // del ERP no sirve. Repetir el barrido completo del catálogo no la
          // agranda, y dejaría el backfill pendiente para siempre.
          if (applied.aborted || applied.failed > 0) imagesBackfillRan = false;
        }
      } catch (error) {
        categoryWarnings.push(
          `Falló la importación de imágenes: ${truncateError(error)}. El resto del sync siguió.`
        );
        imagesBackfillRan = false;
      }
    }

    // ── Fase B.1h: estado de publicación (ERP → Medusa) ──────────────────────
    // Lo que le faltaba al barrido completo. `only_published` nunca despublicó
    // nada: filtraba el artículo y dejaba el producto publicado y a la venta.
    // Acá se actúa sobre esa información, en las dos direcciones.
    const statusCounts = {
      published: 0,
      unpublished: 0,
      unchanged: 0,
      skipped_not_owned: 0,
      skipped_manual_state: 0,
      skipped_by_guard: 0,
      planned_published: 0,
      planned_unpublished: 0,
    };
    const statusPerArticle = new Map<string, Record<string, unknown>>();
    if (settings.status_sync) {
      try {
        // Los recién creados quedan afuera: su estado lo fijó el alta.
        const statusRows = erpRows.filter((row) => !createdCodes.has(row.code));
        const unpublishMissing = Boolean(settings.status_sync_unpublish_missing) && fullSweep;
        // El barrido de todo el catálogo solo se paga cuando hace falta: sin el
        // flag de "ausentes", los flags de las filas alcanzan.
        const erpOwned = unpublishMissing ? await readErpOwnedProducts(container) : undefined;

        const statusPlan = planProductStatuses({
          rows: statusRows,
          existing: existingProducts,
          erpOwned,
          unpublishMissing: Boolean(settings.status_sync_unpublish_missing),
          fullSweep,
        });
        statusCounts.unchanged = statusPlan.unchanged;
        statusCounts.skipped_not_owned = statusPlan.skipped_not_owned;
        statusCounts.skipped_manual_state = statusPlan.skipped_manual_state;

        // Guard de volumen, ANTES de escribir y solo sobre las despublicaciones.
        // Publicar de más se revierte desde el admin; despublicar de más es venta
        // perdida sin que nadie se entere. Un `publica_en_ecommerce` que el ERP
        // mande vacío por un bug propio no puede bajar la tienda a las 4 AM.
        //
        // El denominador es el catálogo COMPLETO de Medusa y no el lote, igual que
        // el guard del delta: contra el lote, una corrida incremental de 3
        // artículos con 1 baja daría 33% y bloquearía una baja perfectamente
        // legítima. "% del catálogo" es lo que el setting promete.
        const unpublishPct = catalog.size
          ? (statusPlan.unpublish.length / catalog.size) * 100
          : 0;
        const maxUnpublishPct = settings.max_unpublish_pct ?? 10;
        const guardTripped = statusPlan.unpublish.length > 0 && unpublishPct > maxUnpublishPct;
        if (guardTripped) {
          statusCounts.skipped_by_guard = statusPlan.unpublish.length;
          categoryWarnings.push(
            `Se iban a despublicar ${statusPlan.unpublish.length} productos, ` +
              `el ${unpublishPct.toFixed(1)}% del catálogo (${catalog.size} variantes), por encima ` +
              `del máximo configurado (${maxUnpublishPct}%). NO se despublicó ninguno. Revisá los ` +
              'flags de publicación en el ERP, o subí `max_unpublish_pct` si la baja masiva es esperada.'
          );
        }
        const unpublish = guardTripped ? [] : statusPlan.unpublish;

        for (const change of statusPlan.publish) {
          for (const code of change.codes) {
            statusPerArticle.set(code, { action: 'publish', reason: change.reason });
          }
        }
        for (const change of statusPlan.unpublish) {
          for (const code of change.codes) {
            statusPerArticle.set(code, {
              action: guardTripped ? 'unpublish_blocked_by_guard' : 'unpublish',
              reason: change.reason,
            });
          }
        }

        if (dryRun) {
          statusCounts.planned_published = statusPlan.publish.length;
          statusCounts.planned_unpublished = unpublish.length;
        } else {
          const applied = await applyProductStatuses(
            container,
            { publish: statusPlan.publish, unpublish },
            chunkSizeOf(settings)
          );
          statusCounts.published = applied.published;
          statusCounts.unpublished = applied.unpublished;
          categoryWarnings.push(...applied.errors);
          // Un producto que pasó a borrador tiene que SALIR del índice, y el
          // reindex batcheado del cierre ya lo hace (`reindexProductsByIds` borra
          // los que no resuelven). Sin esto seguiría navegable en la búsqueda.
          for (const change of [...statusPlan.publish, ...unpublish]) {
            touchedProductIds.add(change.product_id);
          }
        }
      } catch (error) {
        // Un fallo acá no puede arruinar los precios, que es el corazón del sync.
        categoryWarnings.push(
          `Falló la sincronización del estado de publicación: ${truncateError(error)}. ` +
            'El resto del sync siguió.'
        );
      }
    }

    // ── Fase A.3: estado de precios actual en Medusa ─────────────────────────
    // variant_id → price_set_id por la tabla de link (una fila por variante).
    const priceSetByVariant = new Map<string, string>();
    const variantByPriceSet = new Map<string, string>();
    type LinkRow = { variant_id: string; price_set_id: string };
    for (let skip = 0; ; skip += LINK_PAGE_SIZE) {
      const { data: links } = (await query.graph({
        entity: 'product_variant_price_set',
        fields: ['variant_id', 'price_set_id'],
        pagination: { skip, take: LINK_PAGE_SIZE, order: { id: 'ASC' } },
      })) as { data: LinkRow[] };
      for (const link of links) {
        if (!link.variant_id || !link.price_set_id) continue;
        priceSetByVariant.set(link.variant_id, link.price_set_id);
        variantByPriceSet.set(link.price_set_id, link.variant_id);
      }
      if (links.length < LINK_PAGE_SIZE) break;
    }
    for (const entry of catalog.values()) {
      const first = entry.variant_ids[0];
      entry.price_set_id = first ? (priceSetByVariant.get(first) ?? null) : null;
    }

    // Price lists destino (se crean si faltan, nunca se borran).
    //
    // En un barrido completo esto es opcional: con varias listas mapeadas, leer
    // todos los precios de cada price list y escribir los que difieren es la parte
    // pesada de la corrida. Apagado, el barrido igual arrastra el precio BASE — eso
    // no se negocia, es lo que ve el comprador.
    const writePriceLists = shouldWritePriceListsOnRun({
      fullSweep,
      writeOnFullSweep: settings.full_sweep?.price_lists ?? true,
    });
    let priceLists: PriceListTarget[] = [];
    let priceListWarnings: string[] = [];
    if (!writePriceLists && settings.price_lists?.length) {
      priceListWarnings.push(
        'Barrido completo: las price lists no se revisaron porque están apagadas para el barrido ' +
          `(${settings.price_lists.length} lista(s) mapeada(s)). El precio base sí se actualizó.`
      );
    }
    if (writePriceLists && settings.price_lists?.length) {
      if (dryRun) {
        // En dry-run no se crean listas: solo se mapean las que ya existen.
        const resolved = await resolveExistingPriceListsOnly(container, settings.price_lists);
        priceLists = resolved.targets;
        priceListWarnings = resolved.warnings;
      } else {
        const resolved = await resolvePriceLists(container, settings.price_lists);
        priceLists = resolved.targets;
        priceListWarnings = resolved.warnings;
      }
    }

    // Precios base actuales, por price_set_id. Se lee la entidad `price` con
    // `price_list_id: null` (base) y se descartan las filas con reglas o con
    // tramos por cantidad: la fila "default" es la que no tiene ninguna.
    const relevantPriceSetIds = [...catalog.values()]
      .map((entry) => entry.price_set_id)
      .filter((id): id is string => Boolean(id));
    const currentBase = new Map<string, ExistingPrice>();
    type PriceRow = {
      id: string;
      amount: unknown;
      currency_code: string | null;
      min_quantity: unknown;
      price_set_id: string | null;
      price_rules?: Array<unknown> | null;
    };
    for (let i = 0; i < relevantPriceSetIds.length; i += PRICE_READ_CHUNK) {
      const chunk = relevantPriceSetIds.slice(i, i + PRICE_READ_CHUNK);
      const { data: prices } = (await query.graph({
        entity: 'price',
        fields: ['id', 'amount', 'currency_code', 'min_quantity', 'price_set_id', 'price_rules.attribute'],
        // `price_list_id: null` se traduce a `IS NULL`; el tipo del filtro dice
        // string[] pero el runtime acepta el escalar (el core hace lo mismo).
        filters: { price_set_id: chunk, price_list_id: null } as never,
      })) as { data: PriceRow[] };
      for (const price of prices) {
        if (!price.price_set_id) continue;
        if (price.currency_code?.toLowerCase() !== currency) continue;
        if (price.price_rules?.length) continue;
        if (price.min_quantity !== null && price.min_quantity !== undefined) continue;
        currentBase.set(price.price_set_id, { id: price.id, amount: Number(price.amount) || 0 });
      }
    }

    // Precios actuales de cada price list, indexados por variante.
    const currentByListAndVariant = new Map<string, Map<string, ExistingPrice>>();
    for (const target of priceLists) {
      const perVariant = new Map<string, ExistingPrice>();
      const { data: prices } = (await query.graph({
        entity: 'price',
        fields: ['id', 'amount', 'currency_code', 'price_set_id'],
        filters: { price_list_id: target.price_list_id } as never,
      })) as { data: PriceRow[] };
      for (const price of prices) {
        if (!price.price_set_id) continue;
        if (price.currency_code?.toLowerCase() !== currency) continue;
        const variantId = variantByPriceSet.get(price.price_set_id);
        if (!variantId) continue;
        perVariant.set(variantId, { id: price.id, amount: Number(price.amount) || 0 });
      }
      currentByListAndVariant.set(target.price_list_id, perVariant);
    }

    // ── Fase B.2: precios (base + price lists) ───────────────────────────────
    /**
     * `addPrices` sí está en `IPricingModuleService`, pero `updatePrices` NO: lo
     * genera `MedusaService` en runtime a partir del modelo `Price` y nunca se
     * declaró en la interfaz. El core hace lo mismo (`removePriceListPricesStep`
     * llama a `softDeletePrices`, igual de indeclarado), así que el cast es la
     * forma soportada de llegar a él.
     */
    const pricing = container.resolve(Modules.PRICING) as unknown as PricingWriter;
    const counts = emptyCounts();
    counts.products_created = productsCreated;
    const changedProductIds = new Set<string>(touchedProductIds);
    const chunkSize = chunkSizeOf(settings);
    let processed = 0;

    for (let i = 0; i < erpRows.length; i += chunkSize) {
      const chunk = erpRows.slice(i, i + chunkSize);
      const plans = chunk.map((row) => {
        const entry = catalog.get(row.code);
        const variantId = entry?.variant_ids[0] ?? null;
        const currentByPriceList = new Map<string, ExistingPrice>();
        if (variantId) {
          for (const target of priceLists) {
            const found = currentByListAndVariant.get(target.price_list_id)?.get(variantId);
            if (found) currentByPriceList.set(target.price_list_id, found);
          }
        }
        return {
          row,
          plan: planPriceUpdate({
            row,
            entry,
            currencyCode: currency,
            baseListIndex: settings.base_list_index,
            priceLists,
            currentBase: entry?.price_set_id ? (currentBase.get(entry.price_set_id) ?? null) : null,
            currentByPriceList,
            onlyPublished: settings.only_published,
            pricesIncludeTax: adapter.getCapabilities().catalog_prices_include_tax,
          }),
        };
      });

      const writes = plans.flatMap(({ plan }) => plan.writes);
      let chunkError: string | null = null;
      if (writes.length && !dryRun) {
        chunkError = await applyPriceWrites(pricing, container, writes, currency, logger);
      }

      // Un solo log item por artículo, combinando el resultado de producto y de
      // precio: para operar sirve más "qué pasó con el artículo 010/50" que dos
      // filas separadas.
      await service.createErpSyncLogItems(
        plans.map(({ row, plan }) => {
          const productError = productErrors.get(row.code) ?? null;
          const priceFailed = Boolean(chunkError) && plan.writes.length > 0;
          const productStatus = productStatuses.get(row.code);

          let status: ErpSyncLogItemStatus;
          if (productError || priceFailed) {
            status = 'failed';
          } else if (productStatus === 'created') {
            // El alta manda sobre el estado de precio: es el hecho relevante.
            status = 'created';
          } else {
            status = plan.status;
          }
          counts[status] = (counts[status] ?? 0) + 1;

          if (status !== 'failed' && plan.product_id && plan.writes.length) {
            changedProductIds.add(plan.product_id);
          }

          const productDetail = productDetails.get(row.code);
          return {
            sync_log_id: syncLogId,
            entity_type: 'article_code',
            entity_id: row.code,
            status,
            response_payload: sanitizePayload({
              ...plan.response_payload,
              ...(productDetail && productStatus !== 'skipped'
                ? { product: { status: productStatus, ...productDetail } }
                : {}),
              // Categoría y marca NO cambian el `status` del item: ese campo
              // sigue significando qué pasó con el producto/precio del artículo.
              ...(categoryPerArticle.has(row.code)
                ? { category: categoryPerArticle.get(row.code) }
                : {}),
              ...(brandPerArticle.has(row.code) ? { brand: brandPerArticle.get(row.code) } : {}),
              // Tampoco cambia el `status` del item, por la misma razón: es el
              // único lugar donde después se va a poder ver POR QUÉ un producto
              // desapareció de la tienda.
              ...(statusPerArticle.has(row.code)
                ? { publication: statusPerArticle.get(row.code) }
                : {}),
              ...(dryRun && plan.writes.length ? { dry_run_writes: plan.writes.length } : {}),
            }) as Record<string, unknown>,
            error: productError ?? (priceFailed ? chunkError : (plan.error ?? null)),
          };
        })
      );

      processed += chunk.length;
      // Touch de progreso: mantiene updated_at fresco (guard anti-stale) y le da
      // progreso real al poll del admin.
      await service.updateErpSyncLogs({
        id: syncLogId,
        summary: { processed, total_erp_rows: erpRows.length, dry_run: dryRun, ...counts },
      });
    }

    // ── Cierre: watermark, reindex y estado final ────────────────────────────
    // El backfill se apaga solo si corrió y no hubo errores de categoría/marca:
    // si algo falló, la corrida siguiente lo vuelve a intentar sobre todo el
    // catálogo en lugar de dejar la mitad sin categorizar.
    const clearBackfill = backfillRan && backfillPending && categoryWarnings.length === 0;
    // El de presentación se apaga por su cuenta: puede haber corrido bien aunque
    // el de categorías haya dejado warnings, y viceversa.
    const clearPresentationBackfill =
      presentationBackfillRan &&
      Boolean(settings.presentation_option?.backfill_pending) &&
      presentationCounts.renamed >= 0 &&
      categoryWarnings.length === 0;
    const clearColorBackfill =
      colorBackfillRan &&
      Boolean(settings.color_option?.backfill_pending) &&
      categoryWarnings.length === 0;
    // El de imágenes NO mira `categoryWarnings`: la fase deja un warning por cada
    // artículo que falló, y con 2.500 artículos siempre va a haber alguno. Su
    // propia condición (`imagesBackfillRan`) ya se apaga sola si hubo fallos.
    const clearImagesBackfill = imagesBackfillRan && Boolean(settings.images?.backfill_pending);
    /**
     * La lista de artículos con imagen rota se guarda aunque no haya nada más
     * que escribir: es lo único que hace que la corrida siguiente avance en vez
     * de morir en el mismo bloque. Se escribe sólo si CAMBIÓ, para no ensuciar
     * la config en cada corrida.
     */
    const writeImageFailures =
      nextImageFailures !== null &&
      JSON.stringify(nextImageFailures) !== JSON.stringify(settings.images?.failures ?? {});
    /**
     * Se estampa la marca del barrido completo solo si LLEGÓ hasta acá: un sweep
     * que abortó (ERP caído, guard de sanidad) no puede consumir el cupo del día,
     * o la baja de un artículo se quedaría sin detectar hasta mañana.
     *
     * Un barrido MANUAL desde el panel también estampa. Es correcto —ya barrió
     * hoy— pero es sorprendente: si alguien corre uno a las 3 AM, el cron de las 4
     * se saltea.
     */
    const stampFullSweep = fullSweep && !dryRun;
    if (
      !dryRun &&
      (maxModifiedAt ||
        stampFullSweep ||
        clearBackfill ||
        clearPresentationBackfill ||
        clearColorBackfill ||
        clearImagesBackfill ||
        writeImageFailures)
    ) {
      await service.upsertConfig({
        settings: {
          catalog_sync: {
            ...(maxModifiedAt ? { last_synced_at: maxModifiedAt } : {}),
            ...(stampFullSweep ? { last_full_sweep_at: new Date().toISOString() } : {}),
            ...(clearBackfill ? { categories_backfill_pending: false } : {}),
            ...(clearColorBackfill
              ? {
                  color_option: {
                    ...(settings.color_option ?? {}),
                    backfill_pending: false,
                  },
                }
              : {}),
            ...(clearPresentationBackfill
              ? {
                  presentation_option: {
                    ...(settings.presentation_option ?? {}),
                    backfill_pending: false,
                  },
                }
              : {}),
            ...(clearImagesBackfill || writeImageFailures
              ? {
                  images: {
                    ...(settings.images ?? {}),
                    ...(clearImagesBackfill ? { backfill_pending: false } : {}),
                    ...(writeImageFailures ? { failures: nextImageFailures ?? {} } : {}),
                  },
                }
              : {}),
          },
        },
      });
    }

    if (!dryRun && changedProductIds.size) {
      // UN evento al final con todos los productos tocados, en lugar de importar
      // el módulo de búsqueda: la extensión `erp` se instala sola y no debe
      // depender de Typesense. Quien reindexa es el subscriber
      // `erp-catalog-typesense-sync`, que vive del lado de Typesense; si esa
      // extensión no está instalada simplemente nadie escucha y los precios se
      // arrastran en el reconcile periódico.
      try {
        const eventBus = container.resolve(Modules.EVENT_BUS) as {
          emit(data: { name: string; data: unknown }): Promise<unknown>;
        };
        await eventBus.emit({
          name: ERP_CATALOG_PRICES_UPDATED,
          data: { product_ids: [...changedProductIds], sync_log_id: syncLogId },
        });
      } catch (error) {
        logger.warn(
          `[erp] catalog sync: no se pudo emitir ${ERP_CATALOG_PRICES_UPDATED} ` +
            `(${truncateError(error)}). Los precios quedaron bien en la base; ` +
            'el reconcile periódico de la búsqueda los va a arrastrar.'
        );
      }
    }

    const errorish =
      counts.failed + counts.duplicate_sku + counts.invalid_quantity + counts.no_price_set;
    await service.updateErpSyncLogs({
      id: syncLogId,
      status: errorish > 0 ? ('completed_with_errors' as const) : ('completed' as const),
      finished_at: new Date(),
      summary: {
        total_erp_rows: erpRows.length,
        processed,
        ...counts,
        since,
        full_sweep: fullSweep,
        dry_run: dryRun,
        watermark: maxModifiedAt ?? null,
        currency_code: currency,
        base_list_index: settings.base_list_index,
        price_lists: priceLists.map((target) => ({
          zeus_index: target.zeus_index,
          title: target.title,
          price_list_id: target.price_list_id,
        })),
        reindexed_products: dryRun ? 0 : changedProductIds.size,
        create_products: settings.create_products,
        created_product_status: settings.created_product_status ?? 'draft',
        sales_channel_ids: settings.sales_channel_ids ?? [],
        status_sync: {
          enabled: Boolean(settings.status_sync),
          unpublish_missing: Boolean(settings.status_sync_unpublish_missing),
          max_unpublish_pct: settings.max_unpublish_pct ?? 10,
          ...statusCounts,
        },
        product_fields: productFields,
        categories: {
          enabled: categoriesEnabled,
          ...treeCounts,
          ...categoryCounts,
          backfill: backfillRan,
          attribution_rows: attributionRows.length,
        },
        brands: { enabled: Boolean(settings.brands_sync), ...brandCounts },
        titles: {
          enabled: Boolean(titleRules),
          // Sin `title` en la allowlist solo se normalizan las altas: es la
          // diferencia entre "las reglas están prendidas" y "el catálogo
          // existente se está corrigiendo".
          rewrites_existing: productFields.includes('title'),
          ...titleCounts,
        },
        presentation: {
          enabled: presentationEnabled,
          backfill: presentationBackfillRan,
          ...presentationCounts,
        },
        color: {
          enabled: colorEnabled,
          backfill: colorBackfillRan,
          ...colorCounts,
        },
        images: {
          enabled: imagesEnabled,
          backfill: imagesBackfillRan,
          ...imageCounts,
        },
        // Lo que el barrido completo tenía habilitado en esta corrida. Va al log
        // siempre (no solo cuando `full_sweep`): al leer un informe viejo hay que
        // poder saber con qué configuración se sacó.
        full_sweep_scope: {
          images: settings.full_sweep?.images ?? false,
          price_lists: settings.full_sweep?.price_lists ?? true,
          price_lists_written: writePriceLists,
        },
        barcodes: {
          // Sin `barcode` en la allowlist igual se cuenta: es la forma de medir si
          // el campo del ERP sirve ANTES de habilitar la escritura.
          writes: productFields.includes('barcode'),
          ...barcodeCounts,
        },
        metadata_patches: metadataPatches,
        duration_ms: Date.now() - startedAt,
        ...(priceListWarnings.length || categoryWarnings.length
          ? { warnings: [...priceListWarnings, ...categoryWarnings] }
          : {}),
      },
    });
    logger.info(
      `[erp] catalog sync ${syncLogId} listo${dryRun ? ' (DRY-RUN)' : ''}: ` +
        `${counts.updated} actualizados / ${counts.price_unchanged} sin cambio / ` +
        `${counts.created} creados / ${counts.variant_not_found} sin variante / ` +
        `${counts.failed} fallidos (${erpRows.length} filas del ERP)` +
        (categoriesEnabled
          ? ` | categorías: ${treeCounts.created} nuevas, ${categoryCounts.links_added} asignaciones`
          : '') +
        (settings.brands_sync
          ? ` | marcas: ${brandCounts.created} nuevas, ${brandCounts.links_added} asignaciones`
          : '') +
        (titleCounts.normalized || titleCounts.warnings
          ? ` | títulos: ${titleCounts.normalized} normalizados, ${titleCounts.warnings} con warning`
          : '') +
        (imagesEnabled
          ? imageCounts.scope === 'skipped'
            ? ' | imágenes: sin revisar (barrido completo sin backfill pendiente)'
            : ` | imágenes (${imageCounts.scope}): ${imageCounts.imported} importadas ` +
              `(${imageCounts.megabytes} MB), ${imageCounts.without_image} sin foto en el ERP, ` +
              `${imageCounts.too_small} descartadas por resolución, ` +
              `${imageCounts.failed} fallidas`
          : '') +
        '.'
    );
  });
}

/**
 * Aplica las escrituras de una tanda. Devuelve el mensaje de error si algo falló
 * (la tanda entera se marca `failed`, igual que el stock sync), o `null` si salió
 * todo bien.
 */
async function applyPriceWrites(
  pricing: PricingWriter,
  container: MedusaContainer,
  writes: PriceWrite[],
  currency: string,
  logger: Logger
): Promise<string | null> {
  try {
    const baseWrites = writes.filter((write) => write.kind === 'base');
    if (baseWrites.length) {
      // `addPrices` hace upsert por hash (currency + price_set + price_list +
      // min/max qty + reglas) SIN rama de delete: adopta el id del precio base
      // existente y no toca precios de otras monedas ni con reglas de región.
      await pricing.addPrices(
        baseWrites.map((write) => ({
          priceSetId: write.price_set_id,
          prices: [{ currency_code: write.currency_code, amount: write.amount }],
        }))
      );
    }

    const listUpdates = writes.filter((write) => write.kind === 'price_list_update');
    if (listUpdates.length) {
      // Update directo por id de precio: no pasa por `normalizePrices`, así que
      // no hay riesgo de colapso de filas por hash.
      await pricing.updatePrices(
        listUpdates.map((write) => ({ id: write.price_id, amount: write.amount }))
      );
    }

    const creates = writes.filter((write) => write.kind === 'price_list_create');
    if (creates.length) {
      const byList = new Map<string, typeof creates>();
      for (const write of creates) {
        const bucket = byList.get(write.price_list_id) ?? [];
        bucket.push(write);
        byList.set(write.price_list_id, bucket);
      }
      const { batchPriceListPricesWorkflow } = await import('@medusajs/medusa/core-flows');
      for (const [priceListId, items] of byList) {
        // `data` es UN objeto por price list (no un array), y las tres claves son
        // obligatorias aunque vayan vacías.
        await batchPriceListPricesWorkflow(container).run({
          input: {
            data: {
              id: priceListId,
              create: items.map((write) => ({
                variant_id: write.variant_id,
                currency_code: currency,
                amount: write.amount,
              })),
              update: [],
              delete: [],
            },
          },
        });
      }
    }
    return null;
  } catch (error) {
    const message = truncateError(error);
    logger.warn(`[erp] catalog sync: falló una tanda de precios: ${message}`);
    return message;
  }
}

/** Variante de `resolvePriceLists` para dry-run: mapea sin crear nada. */
async function resolveExistingPriceListsOnly(
  container: MedusaContainer,
  mappings: NonNullable<ErpCatalogSyncSettings['price_lists']>
): Promise<{ targets: PriceListTarget[]; warnings: string[] }> {
  const pricing = container.resolve(Modules.PRICING) as {
    listPriceLists(filters: Record<string, unknown>, config?: unknown): Promise<Array<{ id: string; title: string }>>;
  };
  const existing = await pricing.listPriceLists({}, { take: null });
  const byTitle = new Map(existing.map((list) => [list.title, list]));
  const targets: PriceListTarget[] = [];
  const warnings: string[] = [];
  for (const mapping of mappings.filter((m) => m.enabled !== false)) {
    const found = mapping.title ? byTitle.get(mapping.title) : undefined;
    if (found) {
      targets.push({ zeus_index: mapping.zeus_index, price_list_id: found.id, title: mapping.title });
    } else {
      warnings.push(
        `Dry-run: la price list "${mapping.title}" todavía no existe y no se crea en modo simulación; ` +
          'sus precios no aparecen en este informe.'
      );
    }
  }
  return { targets, warnings };
}
