import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { Logger } from '@medusajs/framework/types';
import { startStockSync } from '../../../../../modules/erp/sync/run-stock-sync';
import { truncateError } from '../../../../../modules/erp/sanitize';

/**
 * POST /admin/erp/stock-sync/run — dispara una sincronización manual.
 * Responde 202 con el `sync_log_id` apenas arranca (fire-and-forget con
 * catch, lección del import de demo-store: no atar la corrida al request) y
 * la UI sigue el progreso polleando el log. 409 si ya hay una en curso;
 * 400 si la integración/sync están deshabilitados o faltan credenciales.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const logger = req.scope.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const { sync_log_id, completion } = await startStockSync(req.scope, {
    trigger: 'manual',
    actorId: req.auth_context?.actor_id ?? null,
  });

  // La corrida sigue sola; cualquier error queda en el log (completion nunca
  // rechaza, esto es solo una red extra por si el runtime cambia).
  void completion.catch((error) => {
    logger.error(`[erp] corrida manual ${sync_log_id} falló fuera del log: ${truncateError(error)}`);
  });

  res.status(202).json({ sync_log_id });
}
