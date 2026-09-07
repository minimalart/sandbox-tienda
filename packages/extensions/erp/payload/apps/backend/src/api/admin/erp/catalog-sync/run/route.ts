import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { Logger } from '@medusajs/framework/types';
import { startCatalogSync } from '../../../../../modules/erp/sync/run-catalog-sync';
import { truncateError } from '../../../../../modules/erp/sanitize';

/**
 * POST /admin/erp/catalog-sync/run — sincronización manual de catálogo.
 *
 * Query params:
 * - `dry_run=true`: hace todo el diff y lo deja registrado por artículo, sin
 *   escribir un solo precio. Es la forma de validar el mapeo de listas contra
 *   datos reales antes de la primera corrida en serio.
 * - `full_sweep=true`: ignora el watermark y pide el catálogo completo.
 * - `categories_backfill=true`: retro-atribuye categoría/familia/marca sobre
 *   TODO el catálogo, aunque el delta traiga pocas filas (la primera corrida
 *   después de prender el espejo de categorías).
 *
 * Responde 202 con el `sync_log_id` apenas arranca (fire-and-forget con catch: no
 * atar la corrida al request) y la UI sigue el progreso polleando el log. 409 si
 * ya hay una en curso; 400 si la integración/sync están deshabilitados o faltan
 * credenciales.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const logger = req.scope.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const isTrue = (value: unknown): boolean => value === 'true' || value === true;
  const dryRun = isTrue((req.query as Record<string, unknown>).dry_run);
  const fullSweep = isTrue((req.query as Record<string, unknown>).full_sweep);
  const categoriesBackfill = isTrue((req.query as Record<string, unknown>).categories_backfill);

  const { sync_log_id, completion } = await startCatalogSync(req.scope, {
    trigger: 'manual',
    actorId: req.auth_context?.actor_id ?? null,
    dryRun,
    fullSweep,
    categoriesBackfill,
  });

  // La corrida sigue sola; cualquier error queda en el log (completion nunca
  // rechaza, esto es solo una red extra por si el runtime cambia).
  void completion.catch((error) => {
    logger.error(
      `[erp] corrida manual de catálogo ${sync_log_id} falló fuera del log: ${truncateError(error)}`
    );
  });

  res.status(202).json({
    sync_log_id,
    dry_run: dryRun,
    full_sweep: fullSweep,
    categories_backfill: categoriesBackfill,
  });
}
