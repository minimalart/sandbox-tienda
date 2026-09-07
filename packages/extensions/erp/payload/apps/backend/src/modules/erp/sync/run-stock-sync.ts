import type { IInventoryService, IStockLocationService, Logger, MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys, MedusaError, Modules } from '@medusajs/framework/utils';
import {
  createInventoryLevelsWorkflow,
  updateInventoryLevelsWorkflow,
} from '@medusajs/medusa/core-flows';
import { ERP_MODULE } from '../index';
import type ErpModuleService from '../service';
import type { ErpConfigRow } from '../service';
import { getErpAdapter } from '../adapters/registry';
import { ErpAuthError, ErpConnectionError, type ErpStockResult } from '../adapters/types';
import { sanitizePayload, truncateError } from '../sanitize';
import type { ErpSyncTrigger } from '../types';
import {
  planStockUpdate,
  quantityForTarget,
  type SkuCatalogEntry,
  type StockTarget,
  type StockUpdatePlan,
} from './plan-stock-updates';

/**
 * Stock sync ERP → Medusa por SKU (PRD §8.2), en dos fases:
 *
 *  A) Recolecta el catálogo de Medusa (variantes por SKU, detectando
 *     duplicados) y TODO el stock del ERP en chunks. Cualquier error de
 *     conexión/auth acá aborta con CERO writes ("si el ERP no responde, no
 *     modificar stock").
 *  B) Clasifica cada SKU (`plan-stock-updates`), aplica los updates vía
 *     `updateInventoryLevelsWorkflow` en tandas y persiste el detalle por SKU.
 *
 * Concurrencia: guard por DB (log `running` con actividad fresca → CONFLICT)
 * + lock `erp:stock-sync` del módulo LOCKING como cinturón extra. Un restart
 * a mitad de sync deja el log `running` → el sweep lo marca `failed` y se
 * puede volver a correr (el sync es idempotente).
 */

const DEFAULT_PAGE_SIZE = 200;
const DEFAULT_UPDATE_CHUNK_SIZE = 100;
/** Un log `running` sin actividad por más de esto se considera huérfano. */
export const STOCK_SYNC_STALE_MS = 15 * 60 * 1000;
const LOCK_KEY = 'erp:stock-sync';

type StartStockSyncOptions = {
  trigger: ErpSyncTrigger;
  actorId?: string | null;
};

export type StartStockSyncResult = {
  sync_log_id: string;
  /** Nunca rechaza: todo error termina registrado en el log. */
  completion: Promise<void>;
};

type SyncCounts = {
  updated: number;
  not_found: number;
  duplicate_sku: number;
  invalid_quantity: number;
  skipped_unchanged: number;
  skipped_other: number;
  failed: number;
};

const lastActivity = (log: { updated_at?: unknown; started_at?: unknown }): number => {
  const value = (log.updated_at ?? log.started_at) as string | Date | null | undefined;
  const ts = value ? new Date(value).getTime() : 0;
  return Number.isFinite(ts) ? ts : 0;
};

/** Marca `failed` los sync logs `running` huérfanos (restart a mitad de sync). */
export async function sweepStaleSyncLogs(container: MedusaContainer): Promise<number> {
  const service = container.resolve<ErpModuleService>(ERP_MODULE);
  const running = (await service.listErpSyncLogs(
    { type: 'stock_sync', status: 'running' },
    { take: 20 }
  )) as Array<{ id: string; updated_at?: unknown; started_at?: unknown }>;
  const cutoff = Date.now() - STOCK_SYNC_STALE_MS;
  const stale = running.filter((log) => lastActivity(log) <= cutoff);
  for (const log of stale) {
    await service.updateErpSyncLogs({
      id: log.id,
      status: 'failed' as const,
      finished_at: new Date(),
      error: { message: 'Sincronización interrumpida (posible restart del servidor).' },
    });
  }
  return stale.length;
}

/**
 * Valida guards, crea el log `running` y devuelve su id junto con la promesa
 * de ejecución (para 202 + poll desde el admin, o `await` desde el cron).
 * Lanza `MedusaError` (NOT_ALLOWED/INVALID_DATA/CONFLICT) si no puede arrancar.
 */
export async function startStockSync(
  container: MedusaContainer,
  opts: StartStockSyncOptions
): Promise<StartStockSyncResult> {
  const service = container.resolve<ErpModuleService>(ERP_MODULE);
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);

  const config = await service.getActiveConfig();
  if (!config) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, 'La integración ERP está deshabilitada.');
  }
  if (!config.stock_sync_enabled) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, 'El sync de stock está deshabilitado en la configuración ERP.');
  }
  const adapter = getErpAdapter(config.provider);
  if (!adapter.getCapabilities().stock_pull) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `El provider ${config.provider} no soporta lectura de stock (capability stock_pull).`
    );
  }
  const credentials = service.getDecryptedCredentials(config);
  if (!credentials) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      'No hay credenciales ERP válidas guardadas; re-ingresalas desde la configuración.'
    );
  }

  await sweepStaleSyncLogs(container);

  // Guard por DB: un solo sync activo (cross-container, sin depender del lock).
  const running = (await service.listErpSyncLogs(
    { type: 'stock_sync', status: 'running' },
    { take: 5 }
  )) as Array<{ id: string; updated_at?: unknown; started_at?: unknown }>;
  if (running.some((log) => Date.now() - lastActivity(log) < STOCK_SYNC_STALE_MS)) {
    throw new MedusaError(MedusaError.Types.CONFLICT, 'Ya hay una sincronización de stock en curso.');
  }

  const log = (await service.createErpSyncLogs({
    type: 'stock_sync',
    provider: config.provider,
    trigger: opts.trigger,
    status: 'running',
    started_at: new Date(),
    created_by: opts.actorId ?? null,
  })) as { id: string };

  const completion = executeStockSync(container, { config, credentials, syncLogId: log.id }).catch(
    async (error) => {
      // Última red de seguridad: cualquier error no manejado queda en el log.
      logger.error(`[erp] stock sync ${log.id} murió inesperadamente: ${truncateError(error)}`);
      await service
        .updateErpSyncLogs({
          id: log.id,
          status: 'failed' as const,
          finished_at: new Date(),
          error: { message: truncateError(error) },
        })
        .catch(() => undefined);
    }
  );

  return { sync_log_id: log.id, completion };
}

async function executeStockSync(
  container: MedusaContainer,
  opts: { config: ErpConfigRow; credentials: Record<string, string>; syncLogId: string }
): Promise<void> {
  const { config, credentials, syncLogId } = opts;
  const service = container.resolve<ErpModuleService>(ERP_MODULE);
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
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
      summary: { duration_ms: Date.now() - startedAt, ...extra },
      error: { message },
    });
  };

  await runLocked(async () => {
    const adapter = getErpAdapter(config.provider);
    const settings = config.settings ?? {};
    const pageSize = settings.stock_sync?.page_size ?? DEFAULT_PAGE_SIZE;
    const updateChunkSize = settings.stock_sync?.update_chunk_size ?? DEFAULT_UPDATE_CHUNK_SIZE;
    const adapterCtx = {
      credentials,
      settings: settings as Record<string, unknown>,
      countryCode: config.country_code,
      logger,
    };

    // ── Destinos: uno por depósito mapeado, o la location única (modo viejo) ──
    //
    // Con `deposito_map` cada depósito del ERP escribe SU cantidad en la location
    // que le corresponde. Sin mapeo se mantiene el comportamiento anterior: el
    // total del ERP en una sola location.
    const stockLocationService = container.resolve<IStockLocationService>(Modules.STOCK_LOCATION);
    const mappings = (settings.stock_sync?.deposito_map ?? []).filter(
      (row) => row.enabled !== false && row.deposito?.toString().trim() && row.stock_location_id
    );
    const targets: StockTarget[] = [];
    let locationWarning: string | null = null;

    if (mappings.length) {
      const wanted = [...new Set(mappings.map((row) => row.stock_location_id))];
      const found = await stockLocationService.listStockLocations({ id: wanted }, { take: wanted.length });
      const known = new Set(found.map((location) => location.id));
      const missing = wanted.filter((id) => !known.has(id));
      if (missing.length) {
        await failLog(
          `El mapeo de depósitos apunta a stock locations que no existen: ${missing.join(', ')}.`
        );
        return;
      }
      for (const row of mappings) {
        targets.push({
          deposito: row.deposito.toString().trim(),
          location_id: row.stock_location_id,
        });
      }
    } else {
      let locationId = settings.stock_location_id ?? null;
      if (locationId) {
        const [found] = await stockLocationService.listStockLocations({ id: [locationId] }, { take: 1 });
        if (!found) {
          await failLog(`La stock location configurada (${locationId}) no existe.`);
          return;
        }
      } else {
        const locations = await stockLocationService.listStockLocations(
          {},
          { take: 2, order: { created_at: 'ASC' } }
        );
        if (!locations.length) {
          await failLog('No hay stock locations en Medusa; creá una antes de sincronizar stock.');
          return;
        }
        locationId = locations[0]!.id;
        if (locations.length > 1) {
          locationWarning = `Hay varias stock locations y ninguna configurada: se usa la más antigua (${locationId}). Si el ERP maneja depósitos, configurá el mapeo depósito → location.`;
          logger.warn(`[erp] stock sync: ${locationWarning}`);
        }
      }
      targets.push({ deposito: null, location_id: locationId });
    }
    const targetLocationIds = [...new Set(targets.map((target) => target.location_id))];
    /** Para el resumen: con mapeo son varias, sin mapeo es la única. */
    const locationId = targets[0]!.location_id;

    // ── Fase A: catálogo de Medusa + stock del ERP (sin escribir nada) ──────
    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const salesChannelIds = (settings.stock_sync?.sales_channel_ids ?? []).filter(Boolean);
    const catalog = new Map<string, SkuCatalogEntry>();
    type VariantRow = {
      id: string;
      sku: string | null;
      inventory_items?: Array<{ inventory_item_id: string | null } | null> | null;
    };
    const addVariant = (variant: VariantRow): void => {
      const sku = variant.sku?.trim();
      if (!sku) return;
      const inventoryItemId =
        variant.inventory_items?.find((item) => item?.inventory_item_id)?.inventory_item_id ?? null;
      const entry = catalog.get(sku);
      if (entry) {
        entry.variant_ids.push(variant.id);
      } else {
        catalog.set(sku, { sku, variant_ids: [variant.id], inventory_item_id: inventoryItemId });
      }
    };

    if (salesChannelIds.length) {
      // Acotado por canal: se recorre por PRODUCTO porque el link de canal es
      // producto ↔ sales_channel. Es el modo seguro en una plataforma con varios
      // demos, donde un SKU corto del ERP puede coincidir con el de otro.
      //
      // El link NO es filtrable desde `product` (`filters: { sales_channels: … }`
      // tira "Trying to query by not existing property Product.sales_channels"):
      // hay que pasar por el entry point del link — igual que `maybeApplyLinkFilter`
      // en el core — y después pedir esos productos por id.
      type ProductRow = { id: string; variants?: VariantRow[] | null };
      const productIds = new Set<string>();
      for (let skip = 0; ; skip += pageSize) {
        const { data: links } = (await query.graph({
          entity: 'product_sales_channel',
          fields: ['product_id'],
          filters: { sales_channel_id: salesChannelIds },
          pagination: { skip, take: pageSize, order: { id: 'ASC' } },
        })) as { data: Array<{ product_id?: string | null }> };
        for (const link of links) {
          if (link.product_id) productIds.add(link.product_id);
        }
        if (links.length < pageSize) break;
      }

      const scopedProductIds = [...productIds];
      for (let i = 0; i < scopedProductIds.length; i += pageSize) {
        const { data: products } = (await query.graph({
          entity: 'product',
          fields: ['id', 'variants.id', 'variants.sku', 'variants.inventory_items.inventory_item_id'],
          filters: { id: scopedProductIds.slice(i, i + pageSize) },
          pagination: { take: pageSize },
        })) as { data: ProductRow[] };
        for (const product of products) {
          for (const variant of product.variants ?? []) addVariant(variant);
        }
      }
    } else {
      for (let skip = 0; ; skip += pageSize) {
        const { data: variants } = (await query.graph({
          entity: 'product_variant',
          fields: ['id', 'sku', 'inventory_items.inventory_item_id'],
          pagination: { skip, take: pageSize, order: { id: 'ASC' } },
        })) as { data: VariantRow[] };
        for (const variant of variants) addVariant(variant);
        if (variants.length < pageSize) break;
      }
    }

    if (!catalog.size) {
      await service.updateErpSyncLogs({
        id: syncLogId,
        status: 'completed' as const,
        finished_at: new Date(),
        summary: { total_skus: 0, duration_ms: Date.now() - startedAt, location_id: locationId },
      });
      return;
    }

    const skus = [...catalog.keys()];
    const batchSize = Math.max(adapter.getCapabilities().stock_batch_size, 1);
    const erpStock = new Map<string, ErpStockResult>();
    try {
      for (let i = 0; i < skus.length; i += batchSize) {
        const batch = skus.slice(i, i + batchSize);
        const results = await adapter.getStockBySku(batch, adapterCtx);
        for (const [sku, result] of results) erpStock.set(sku, result);
      }
    } catch (error) {
      const kind =
        error instanceof ErpAuthError
          ? 'credenciales'
          : error instanceof ErpConnectionError
            ? 'conexión'
            : 'inesperado';
      await failLog(
        `El ERP falló durante la lectura de stock (${kind}): ${truncateError(error)}. No se modificó ningún stock.`
      );
      return;
    }

    // ── Fase B: clasificar y aplicar en tandas ───────────────────────────────
    const inventoryService = container.resolve<IInventoryService>(Modules.INVENTORY);
    const counts: SyncCounts = {
      updated: 0,
      not_found: 0,
      duplicate_sku: 0,
      invalid_quantity: 0,
      skipped_unchanged: 0,
      skipped_other: 0,
      failed: 0,
    };
    const entries = [...catalog.values()];
    let processed = 0;

    for (let i = 0; i < entries.length; i += updateChunkSize) {
      const chunk = entries.slice(i, i + updateChunkSize);

      const itemIds = chunk
        .map((entry) => entry.inventory_item_id)
        .filter((id): id is string => Boolean(id));
      const levels = itemIds.length
        ? await inventoryService.listInventoryLevels(
            { inventory_item_id: itemIds, location_id: targetLocationIds },
            { take: itemIds.length * targetLocationIds.length }
          )
        : [];
      // Clave compuesta: un mismo inventory item tiene un nivel por location.
      const levelByItemAndLocation = new Map(
        levels.map((level) => [
          `${level.inventory_item_id}::${level.location_id}`,
          {
            stocked_quantity: Number(level.stocked_quantity) || 0,
            reserved_quantity: Number(level.reserved_quantity) || 0,
          },
        ])
      );

      // Un plan por (SKU, destino). El planner se reusa tal cual: lo que cambia
      // por destino es la cantidad (la del depósito) y el nivel actual.
      const plans: Array<{ entry: SkuCatalogEntry; target: StockTarget; plan: StockUpdatePlan }> = [];
      for (const entry of chunk) {
        for (const target of targets) {
          plans.push({
            entry,
            target,
            plan: planStockUpdate({
              entry,
              erpResult: quantityForTarget(erpStock.get(entry.sku), target),
              level: entry.inventory_item_id
                ? (levelByItemAndLocation.get(`${entry.inventory_item_id}::${target.location_id}`) ??
                  null)
                : null,
            }),
          });
        }
      }

      const writes = plans.filter(({ plan }) => plan.status === 'updated' && plan.update);
      // El plan marca `update.create` cuando el nivel no existía en la
      // location destino: esos van a `createInventoryLevelsWorkflow`; el
      // resto, a `updateInventoryLevelsWorkflow`. `update` no crea niveles
      // faltantes (el core los ignora en silencio), así que mezclar los dos
      // caminos deja la sucursal sin stock aunque el ERP haya respondido bien.
      const levelCreates = writes.filter(({ plan }) => plan.update!.create);
      const levelUpdates = writes.filter(({ plan }) => !plan.update!.create);
      let chunkApplyError: string | null = null;
      if (writes.length) {
        try {
          if (levelUpdates.length) {
            await updateInventoryLevelsWorkflow(container).run({
              input: {
                updates: levelUpdates.map(({ plan, target }) => ({
                  inventory_item_id: plan.update!.inventory_item_id,
                  location_id: target.location_id,
                  stocked_quantity: plan.update!.stocked_quantity,
                })),
              },
            });
          }
          if (levelCreates.length) {
            await createInventoryLevelsWorkflow(container).run({
              input: {
                inventory_levels: levelCreates.map(({ plan, target }) => ({
                  inventory_item_id: plan.update!.inventory_item_id,
                  location_id: target.location_id,
                  stocked_quantity: plan.update!.stocked_quantity,
                })),
              },
            });
          }
        } catch (error) {
          chunkApplyError = truncateError(error);
          logger.warn(`[erp] stock sync ${syncLogId}: falló una tanda de updates: ${chunkApplyError}`);
        }
      }

      await service.createErpSyncLogItems(
        plans.map(({ entry, target, plan }) => {
          const applyFailed = chunkApplyError && plan.status === 'updated';
          const status = applyFailed ? ('failed' as const) : plan.status;
          if (status === 'failed') counts.failed += 1;
          else if (status === 'updated') counts.updated += 1;
          else if (status === 'not_found') counts.not_found += 1;
          else if (status === 'duplicate_sku') counts.duplicate_sku += 1;
          else if (status === 'invalid_quantity') counts.invalid_quantity += 1;
          else if (plan.response_payload.reason === 'unchanged') counts.skipped_unchanged += 1;
          else counts.skipped_other += 1;
          return {
            sync_log_id: syncLogId,
            entity_type: 'variant_sku',
            entity_id: entry.sku,
            status,
            response_payload: sanitizePayload({
              ...plan.response_payload,
              // Con varios destinos, sin esto no se sabe a qué depósito/location
              // corresponde cada fila del log.
              location_id: target.location_id,
              ...(target.deposito ? { deposito: target.deposito } : {}),
            }) as Record<string, unknown>,
            error: applyFailed ? chunkApplyError : (plan.error ?? null),
          };
        })
      );

      processed += chunk.length;
      // Touch de progreso: mantiene updated_at fresco (guard anti-stale) y
      // le da progreso real al poll del admin.
      await service.updateErpSyncLogs({
        id: syncLogId,
        summary: {
          processed,
          total_skus: entries.length,
          ...counts,
          location_id: locationId,
        },
      });
    }

    // Sólo lo que pide intervención marca la corrida como "con errores". Antes
    // sumaba `not_found` y `skipped_other`, así que una corrida sana en una
    // plataforma con varios demos (donde la mayoría de los SKUs de Medusa no
    // existe en este ERP) salía siempre en rojo y nadie miraba el detalle.
    const errorish = counts.duplicate_sku + counts.invalid_quantity + counts.failed;
    await service.updateErpSyncLogs({
      id: syncLogId,
      status: errorish > 0 ? ('completed_with_errors' as const) : ('completed' as const),
      finished_at: new Date(),
      summary: {
        total_skus: entries.length,
        processed,
        ...counts,
        duration_ms: Date.now() - startedAt,
        location_id: locationId,
        ...(targets.length > 1
          ? { targets: targets.map((t) => ({ deposito: t.deposito, location_id: t.location_id })) }
          : {}),
        ...(locationWarning ? { location_warning: locationWarning } : {}),
      },
    });
    logger.info(
      `[erp] stock sync ${syncLogId} listo: ${counts.updated} updated / ${counts.not_found} not_found / ${counts.failed} failed (${entries.length} SKUs).`
    );
  });
}
