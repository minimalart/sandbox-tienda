import type { AuthenticatedMedusaRequest, MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { Logger } from '@medusajs/framework/types';
import { truncateError } from '../../../../modules/typesense/sanitize';
import { startTypesenseSync } from '../../../../modules/typesense/run-sync';
import { TYPESENSE_SYNC_LOG_MODULE } from '../../../../modules/typesense/sync-log';
import type TypesenseSyncLogService from '../../../../modules/typesense/sync-log/service';
import type { TypesenseSyncLogRow, TypesenseSyncMode } from '../../../../modules/typesense/types';

/**
 * Sincronización manual del índice, disparada desde el admin.
 *
 * Vive en /admin/typesense/sync (NO /admin/products/sync): eso colisionaba con
 * /admin/products/[id] del core, que interpretaba "sync" como id de producto.
 *
 * POST recibe `{ mode }` (`update` por defecto) y responde 202 con el
 * `sync_log_id`: la corrida sigue sola y el admin la poll-ea. Antes corría
 * SINCRÓNICA dentro del request, así que con catálogos grandes era un request de
 * minutos, expuesto a que la plataforma lo corte.
 *
 * GET se mantiene por compatibilidad con el hook de progreso, pero ahora lee la
 * ÚLTIMA FILA de la DB en vez de un singleton del proceso: sobrevive a los
 * restarts y funciona con varios contenedores.
 */

const VALID_MODES: TypesenseSyncMode[] = ['update', 'recreate'];

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const logger = req.scope.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const body = (req.body ?? {}) as { mode?: string };
  const mode: TypesenseSyncMode = VALID_MODES.includes(body.mode as TypesenseSyncMode)
    ? (body.mode as TypesenseSyncMode)
    : 'update';

  const { sync_log_id, completion } = await startTypesenseSync(req.scope, {
    mode,
    trigger: 'manual',
    actorId: req.auth_context?.actor_id ?? null,
  });

  // `completion` nunca rechaza (todo error queda en la fila de log); esto es
  // sólo una red extra por si el runtime cambia.
  void completion.catch((error) => {
    logger.error(
      `[typesense-sync] corrida manual ${sync_log_id} falló fuera del log: ${truncateError(error)}`
    );
  });

  res.status(202).json({ sync_log_id, mode });
}

/** Forma que ya consume el hook de progreso del admin. */
type SyncProgressResponse = {
  stage: string;
  done: number;
  total: number;
  message?: string;
  startedAt?: string;
  updatedAt: string;
  sync_log_id?: string;
  status?: string;
  mode?: string;
};

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<TypesenseSyncLogService>(TYPESENSE_SYNC_LOG_MODULE);
  const [latest] = (await service.listTypesenseSyncLogs(
    {},
    { take: 1, order: { started_at: 'DESC' } }
  )) as TypesenseSyncLogRow[];

  if (!latest) {
    res.status(200).json({
      stage: 'idle',
      done: 0,
      total: 0,
      updatedAt: new Date().toISOString(),
    } satisfies SyncProgressResponse);
    return;
  }

  const summary = latest.summary ?? null;
  res.status(200).json({
    stage: latest.status === 'running' ? (latest.stage ?? 'loading') : (latest.stage ?? 'done'),
    done: summary?.processed ?? 0,
    total: summary?.total ?? 0,
    message: latest.error?.message,
    startedAt: latest.started_at ? new Date(latest.started_at).toISOString() : undefined,
    updatedAt: new Date((latest.updated_at ?? latest.started_at) as string).toISOString(),
    sync_log_id: latest.id,
    status: latest.status,
    mode: latest.mode,
  } satisfies SyncProgressResponse);
}
