import type { Logger, MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';

import { WHATSAPP_EVENT_LOG_MODULE } from '../modules/whatsapp-agent/event-log/types';

/**
 * Retención del embudo de WhatsApp.
 *
 * `whatsapp_event` no tenía purga de ningún tipo: crecía para siempre. Con la
 * traza del grafo cada conversación escribe además un evento por NODO recorrido,
 * así que el volumen por conversación se multiplica y el tablero —que lee hasta
 * 20.000 filas en memoria— empieza a truncar.
 *
 * Copia de `typesense-sync-log-prune`: borra en tandas para no hacer un DELETE
 * gigante, y una falla se loguea sin voltear el resto de los crons.
 */

const BATCH = 500;
const DEFAULT_RETENTION_DAYS = 90;

export default async function whatsappEventPruneJob(container: MedusaContainer): Promise<void> {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);

  const days = Number(process.env.WHATSAPP_EVENT_RETENTION_DAYS || DEFAULT_RETENTION_DAYS);
  // `0` apaga la purga a propósito: es la salida para una instalación que quiera
  // conservar todo el historial.
  if (!Number.isFinite(days) || days <= 0) return;

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  let service: { listWhatsappEvents: Function; deleteWhatsappEvents: Function };
  try {
    service = container.resolve(WHATSAPP_EVENT_LOG_MODULE) as never;
  } catch {
    // El módulo es opcional: sin la extensión de WhatsApp no hay nada que podar.
    return;
  }

  let deleted = 0;
  try {
    for (;;) {
      const stale = (await service.listWhatsappEvents(
        { created_at: { $lt: cutoff } },
        { take: BATCH, order: { created_at: 'ASC' } },
      )) as Array<{ id: string }>;
      if (stale.length === 0) break;

      await service.deleteWhatsappEvents(stale.map((row) => row.id));
      deleted += stale.length;

      if (stale.length < BATCH) break;
    }

    if (deleted) {
      logger.info(
        `[WhatsApp Prune] Borrados ${deleted} eventos anteriores a ${cutoff.toISOString()}.`,
      );
    }
  } catch (error) {
    logger.warn(
      `[WhatsApp Prune] falló: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export const config = {
  name: 'whatsapp-event-prune',
  schedule: process.env.WHATSAPP_EVENT_PRUNE_CRON || '45 4 * * *',
};
