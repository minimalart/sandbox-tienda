import type { IStoreModuleService, Logger, MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys, MedusaError, Modules } from '@medusajs/framework/utils';
import { streamSyncProducts } from '../../api/store/custom/typesense-sync/loader';
import { ProductMapper } from './product-mapper';
import { loadAdvisorRules } from './advisor';
import { truncateError } from './sanitize';
import { getStaleTypesenseDocumentIds } from './search-defaults';
import TypeSenseService from './service';
import { TYPESENSE_SYNC_LOG_MODULE } from './sync-log';
import type TypesenseSyncLogService from './sync-log/service';
import type {
  TypesenseSyncMode,
  TypesenseSyncStage,
  TypesenseSyncSummary,
  TypesenseSyncTrigger,
} from './types';

/**
 * Orquestador único de las sincronizaciones de Typesense, calcado de
 * `modules/erp/sync/run-stock-sync.ts`.
 *
 * Dos modos, que antes eran uno solo:
 *  - `update`   → NO borra la colección. La crea si falta y la recrea sólo si el
 *                 schema local ya no coincide con el remoto. La búsqueda del
 *                 storefront sigue respondiendo durante todo el barrido.
 *  - `recreate` → DELETE + CREATE explícito, con snapshot y reposición de
 *                 sinónimos y curaciones (en Typesense viven en la colección, y
 *                 el sync viejo los borraba en cada corrida sin reponerlos).
 *
 * Todo queda en `typesense_sync_log`: antes el progreso vivía en un singleton
 * del proceso, así que se perdía en cada restart, era incorrecto con más de un
 * contenedor y cerrar la pestaña del admin dejaba la corrida sin forma de
 * re-enganchar.
 *
 * Concurrencia: guard por DB (fila `running` con actividad fresca → CONFLICT) +
 * lock del módulo LOCKING como cinturón extra. Un restart a mitad de corrida
 * deja la fila `running` → el barrido la marca `failed` y se puede volver a
 * correr (el sync es idempotente).
 */

/** Una fila `running` sin actividad por más de esto se considera huérfana. */
export const TYPESENSE_SYNC_STALE_MS = 15 * 60 * 1000;
const LOCK_KEY = 'typesense:sync';
/**
 * Tope de items `deleted` que se persisten. Un primer barrido contra un índice
 * muy viejo puede sacar miles de huérfanos y no tiene sentido escribir una fila
 * por cada uno; el total real siempre queda en `summary.deleted`.
 */
const MAX_LOGGED_DELETED_ITEMS = 500;
/** Ídem para el detalle de un fallo por evento: el lote puede traer miles de ids. */
const MAX_LOGGED_EVENT_FAILURES = 500;

export type StartTypesenseSyncOptions = {
  mode: TypesenseSyncMode;
  trigger: Extract<TypesenseSyncTrigger, 'manual' | 'cron'>;
  actorId?: string | null;
};

export type StartTypesenseSyncResult = {
  sync_log_id: string;
  /** Nunca rechaza: todo error termina registrado en la fila de log. */
  completion: Promise<void>;
};

type SyncLogRow = { id: string; updated_at?: unknown; started_at?: unknown };

const lastActivity = (log: SyncLogRow): number => {
  const value = (log.updated_at ?? log.started_at) as string | Date | null | undefined;
  const ts = value ? new Date(value).getTime() : 0;
  return Number.isFinite(ts) ? ts : 0;
};

const resolveLogService = (container: MedusaContainer): TypesenseSyncLogService =>
  container.resolve<TypesenseSyncLogService>(TYPESENSE_SYNC_LOG_MODULE);

/** Marca `failed` las corridas `running` huérfanas (restart a mitad de sync). */
export async function sweepStaleTypesenseSyncLogs(container: MedusaContainer): Promise<number> {
  const service = resolveLogService(container);
  const running = (await service.listTypesenseSyncLogs(
    { status: 'running' },
    { take: 20 }
  )) as SyncLogRow[];
  const cutoff = Date.now() - TYPESENSE_SYNC_STALE_MS;
  const stale = running.filter((log) => lastActivity(log) <= cutoff);
  for (const log of stale) {
    await service.updateTypesenseSyncLogs({
      id: log.id,
      status: 'failed' as const,
      stage: 'error' as const,
      finished_at: new Date(),
      error: { message: 'Sincronización interrumpida (posible restart del servidor).' },
    });
  }
  return stale.length;
}

/**
 * Valida los guards, crea la fila `running` y devuelve su id junto con la
 * promesa de ejecución (para responder 202 + poll desde el admin, o `await`
 * desde el cron). Lanza `MedusaError` CONFLICT si ya hay una corrida viva.
 */
export async function startTypesenseSync(
  container: MedusaContainer,
  opts: StartTypesenseSyncOptions
): Promise<StartTypesenseSyncResult> {
  const service = resolveLogService(container);
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);

  await sweepStaleTypesenseSyncLogs(container);

  // Guard por DB: una sola corrida activa, cross-container, sin depender del lock.
  const running = (await service.listTypesenseSyncLogs(
    { status: 'running' },
    { take: 5 }
  )) as SyncLogRow[];
  if (running.some((log) => Date.now() - lastActivity(log) < TYPESENSE_SYNC_STALE_MS)) {
    throw new MedusaError(
      MedusaError.Types.CONFLICT,
      'Ya hay una sincronización de Typesense en curso.'
    );
  }

  const collectionName = new TypeSenseService().collectionName;
  const log = (await service.createTypesenseSyncLogs({
    mode: opts.mode,
    trigger: opts.trigger,
    status: 'running',
    stage: 'loading',
    collection: collectionName,
    started_at: new Date(),
    created_by: opts.actorId ?? null,
  })) as { id: string };

  const completion = executeSync(container, { mode: opts.mode, syncLogId: log.id }).catch(
    async (error) => {
      // Última red: cualquier error no manejado queda en la fila de log.
      logger.error(
        `[typesense-sync] corrida ${log.id} murió inesperadamente: ${truncateError(error)}`
      );
      await service
        .updateTypesenseSyncLogs({
          id: log.id,
          status: 'failed' as const,
          stage: 'error' as const,
          finished_at: new Date(),
          error: { message: truncateError(error) },
        })
        .catch(() => undefined);
    }
  );

  return { sync_log_id: log.id, completion };
}

/**
 * Registra el fallo de un reindexado disparado por evento. Los reindexados por
 * subscriber NO generan fila cuando salen bien (serían miles por día y ninguna
 * aporta), pero un fallo silencioso es justamente lo que dejaba el índice atrás
 * sin que nadie se enterara.
 */
export async function recordFailedEventSync(
  container: MedusaContainer,
  opts: { productIds: string[]; error: unknown; source: string }
): Promise<void> {
  try {
    const service = resolveLogService(container);
    const now = new Date();
    const message = truncateError(opts.error);
    const log = (await service.createTypesenseSyncLogs({
      mode: 'update',
      trigger: 'event',
      status: 'failed',
      stage: 'error',
      collection: new TypeSenseService().collectionName,
      started_at: now,
      finished_at: now,
      summary: {
        total: opts.productIds.length,
        processed: 0,
        upserted: 0,
        failed: opts.productIds.length,
        deleted: 0,
        skipped: 0,
      } satisfies TypesenseSyncSummary,
      error: { message: `${opts.source}: ${message}` },
    })) as { id: string };

    if (opts.productIds.length) {
      await service.createTypesenseSyncLogItems(
        opts.productIds.slice(0, MAX_LOGGED_EVENT_FAILURES).map((id) => ({
          sync_log_id: log.id,
          entity_type: 'product',
          entity_id: id,
          status: 'failed' as const,
          error: message,
        }))
      );
    }
  } catch {
    // El log es diagnóstico: nunca puede tumbar el subscriber que lo reporta.
  }
}

async function executeSync(
  container: MedusaContainer,
  opts: { mode: TypesenseSyncMode; syncLogId: string }
): Promise<void> {
  const { mode, syncLogId } = opts;
  const service = resolveLogService(container);
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const typesense = new TypeSenseService();
  const startedAt = Date.now();

  const summary: TypesenseSyncSummary = {
    total: 0,
    processed: 0,
    upserted: 0,
    failed: 0,
    deleted: 0,
    skipped: 0,
    recreated: false,
    collection: typesense.collectionName,
  };

  /**
   * Persiste el progreso. Además de darle un % REAL al admin, mantiene
   * `updated_at` fresco para que el guard anti-stale no mate una corrida viva.
   */
  const touch = async (stage: TypesenseSyncStage): Promise<void> => {
    await service.updateTypesenseSyncLogs({
      id: syncLogId,
      stage,
      summary: { ...summary },
    });
  };

  const failLog = async (message: string): Promise<void> => {
    await service.updateTypesenseSyncLogs({
      id: syncLogId,
      status: 'failed' as const,
      stage: 'error' as const,
      finished_at: new Date(),
      summary: { ...summary, duration_ms: Date.now() - startedAt },
      error: { message },
    });
  };

  await runLocked(container, async () => {
    const query = container.resolve<{ graph: (input: unknown) => Promise<unknown> }>(
      ContainerRegistrationKeys.QUERY
    );

    // ── total REAL, antes del barrido ────────────────────────────────────────
    // Sin esto la ruta vieja hacía `touch({ done, total: done })` por página, así
    // que la barra del admin marcaba 100% desde el primer lote.
    summary.total = await countIndexableProducts(query, logger);
    await touch('loading');

    // ── Estado de la colección ───────────────────────────────────────────────
    let collectionWasReset = false;
    try {
      if (mode === 'recreate') {
        await touch('recreating');
        const restored = await typesense.recreateCollectionPreservingConfig();
        summary.recreated = true;
        summary.synonyms_restored = restored.synonyms_restored;
        summary.curations_restored = restored.curations_restored;
        collectionWasReset = true;
      } else {
        const ensured = await typesense.ensureCollection();
        if (ensured.recreated || ensured.created) {
          summary.recreated = ensured.recreated;
          summary.synonyms_restored = ensured.synonyms_restored;
          summary.curations_restored = ensured.curations_restored;
          collectionWasReset = true;
          await touch('recreating');
        }
      }
    } catch (error) {
      // Si el CREATE falla, la colección quedó borrada: seguir subiendo
      // documentos a la nada es exactamente el fallo silencioso que había antes.
      await failLog(`No se pudo preparar la colección: ${truncateError(error)}`);
      return;
    }

    // ── Documentos ya indexados (para detectar huérfanos) ────────────────────
    // Tras un reset no hay huérfanos por definición, así que se saltea el export.
    let existingIds: string[] = [];
    if (!collectionWasReset) {
      await touch('listing');
      try {
        existingIds = await typesense.listAllDocumentIds();
      } catch (error) {
        logger.warn(
          `[typesense-sync] ${syncLogId}: no se pudieron listar los documentos existentes: ${truncateError(error)}`
        );
      }
    }

    // ── Barrido + indexación ────────────────────────────────────────────────
    await touch('upserting');
    // Reglas del asesor guiado, una sola vez para toda la corrida (ver advisor.ts).
    await loadAdvisorRules(container);
    const seenIds: string[] = [];

    const result = await streamSyncProducts(container, async (page) => {
      const docs: Record<string, unknown>[] = [];
      const mapFailures: Array<{ entity_id: string; error: string }> = [];

      for (const product of page) {
        const productId = String(product.id ?? '');
        if (productId) seenIds.push(productId);
        try {
          docs.push(ProductMapper.toTypesenseObject(product) as Record<string, unknown>);
        } catch (error) {
          mapFailures.push({ entity_id: productId, error: truncateError(error) });
        }
      }

      const { upserted, failures } = await typesense.importDocuments(docs);
      summary.upserted += upserted;
      summary.processed += page.length;
      summary.failed += failures.length + mapFailures.length;

      const items = [
        ...mapFailures.map((failure) => ({
          sync_log_id: syncLogId,
          entity_type: 'product',
          entity_id: failure.entity_id,
          status: 'failed' as const,
          error: failure.error,
          payload: { phase: 'mapping' },
        })),
        ...failures.map((failure) => ({
          sync_log_id: syncLogId,
          entity_type: 'product',
          entity_id: failure.id ?? 'unknown',
          status: 'failed' as const,
          error: failure.error,
          payload: { phase: 'import' },
        })),
      ];
      if (items.length) await service.createTypesenseSyncLogItems(items);

      // Una escritura por página (200 productos): barata y suficiente para que
      // la barra avance de verdad y `updated_at` no envejezca.
      await touch('upserting');
    });

    if (!result.ok) {
      await failLog(result.message);
      return;
    }

    // ── Huérfanos ───────────────────────────────────────────────────────────
    if (!collectionWasReset && existingIds.length) {
      // Guard: una carga vacía es una FALLA, no "no hay productos". Sin esto un
      // barrido que no devuelve nada vacía el índice entero.
      if (seenIds.length === 0) {
        summary.notes = [
          ...(summary.notes ?? []),
          'El barrido no devolvió productos: se saltea el borrado de huérfanos para no vaciar el índice.',
        ];
        logger.warn(
          `[typesense-sync] ${syncLogId}: 0 productos cargados, no se borra ningún documento.`
        );
      } else {
        const stale = getStaleTypesenseDocumentIds(existingIds, seenIds);
        if (stale.length) {
          await touch('deleting');
          summary.deleted = await typesense.deleteDocumentsByIds(stale);
          const logged = stale.slice(0, MAX_LOGGED_DELETED_ITEMS);
          await service.createTypesenseSyncLogItems(
            logged.map((id) => ({
              sync_log_id: syncLogId,
              entity_type: 'product',
              entity_id: id,
              status: 'deleted' as const,
            }))
          );
          if (stale.length > logged.length) {
            summary.notes = [
              ...(summary.notes ?? []),
              `Detalle de borrados truncado: se listan ${logged.length} de ${stale.length}.`,
            ];
          }
        }
      }
    }

    // ── Cierre ──────────────────────────────────────────────────────────────
    summary.duration_ms = Date.now() - startedAt;
    await service.updateTypesenseSyncLogs({
      id: syncLogId,
      status: summary.failed > 0 ? ('completed_with_errors' as const) : ('completed' as const),
      stage: 'done' as const,
      finished_at: new Date(),
      summary: { ...summary },
    });
    await writeLastSyncMetadata(container, logger);

    logger.info(
      `[typesense-sync] ${syncLogId} listo (${mode}): ${summary.upserted} indexados / ` +
        `${summary.failed} con error / ${summary.deleted} borrados de ${summary.total}.`
    );
  });
}

/**
 * Cantidad de productos indexables (publicados). Se pide una sola fila y se lee
 * el `count` del metadata, sin traer el catálogo.
 */
async function countIndexableProducts(
  query: { graph: (input: unknown) => Promise<unknown> },
  logger: Logger
): Promise<number> {
  try {
    const response = (await query.graph({
      entity: 'product',
      fields: ['id'],
      filters: { status: { $ne: 'draft' } },
      pagination: { skip: 0, take: 1 },
    })) as { metadata?: { count?: number } };
    return Number(response?.metadata?.count) || 0;
  } catch (error) {
    logger.warn(`[typesense-sync] No se pudo contar los productos: ${truncateError(error)}`);
    return 0;
  }
}

/**
 * Sella `store.metadata.last_typesense_sync_at`. La ruta
 * `/admin/typesense/last-sync` ya leía esta clave pero NADIE la escribía, así
 * que el badge "Última sincronización" nunca aparecía.
 */
async function writeLastSyncMetadata(container: MedusaContainer, logger: Logger): Promise<void> {
  try {
    const storeService = container.resolve<IStoreModuleService>(Modules.STORE);
    const [store] = await storeService.listStores({}, { take: 1 });
    if (!store) return;
    await storeService.updateStores(store.id, {
      // `metadata` se reemplaza entero, así que hay que spreadear lo que había.
      metadata: { ...(store.metadata ?? {}), last_typesense_sync_at: new Date().toISOString() },
    });
  } catch (error) {
    logger.warn(`[typesense-sync] No se pudo sellar la última sincronización: ${truncateError(error)}`);
  }
}

/** Cinturón extra sobre el guard por DB; degrada si el módulo no está registrado. */
async function runLocked(container: MedusaContainer, job: () => Promise<void>): Promise<void> {
  let locking: {
    execute<T>(keys: string | string[], job: () => Promise<T>, args?: { timeout?: number }): Promise<T>;
  } | null = null;
  try {
    locking = container.resolve(Modules.LOCKING);
  } catch {
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
      throw new MedusaError(
        MedusaError.Types.CONFLICT,
        'Otra sincronización de Typesense tiene tomado el lock.'
      );
    }
    throw error;
  }
}
