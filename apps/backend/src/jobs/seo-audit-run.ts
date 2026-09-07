import type { Logger, MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { SEO_GEO_MODULE } from '../modules/seo-geo';
import type SeoGeoModuleService from '../modules/seo-geo/service';
import { runAudit } from '../modules/seo-geo/lib/run-audit';
import { getSeoGeoSettings } from '../modules/seo-geo/settings';

/**
 * Job del módulo SEO & GEO: drena en segundo plano las auditorías en `queued`,
 * de a UNA por vez (se salta si ya hay una `running` FRESCA), para no lanzar
 * crawls concurrentes ni sobrecargar el storefront. Cada crawl es acotado por el
 * presupuesto de config. Este patrón (job que drena) evita el problema de correr
 * el trabajo pesado vía `medusa exec` (OOM/503 en la consola de DO).
 *
 * Recuperación de huérfanas: como `runAudit` corre el crawl completo en un tick,
 * si el proceso muere a mitad (deploy/restart/OOM) la fila queda en `running`
 * para siempre y bloquearía todo el módulo. Por eso, antes de serializar, se
 * marcan como `failed` las `running` sin progreso hace más de STALE_MINUTES (su
 * `updated_at` se bumpea en cada lote del crawl mientras el proceso vive).
 */
export const config = {
  name: 'seo-audit-run',
  schedule: process.env.SEO_GEO_JOB_SCHEDULE || '*/1 * * * *',
};

export default async function seoAuditRunJob(container: MedusaContainer): Promise<void> {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const service = container.resolve<SeoGeoModuleService>(SEO_GEO_MODULE);

  // Minutos sin progreso tras los que una auditoría `running` se considera
  // huérfana. Se lee por corrida y no en un `const` de módulo: viene de
  // `app-settings`, así que ajustarlo desde el admin aplica en el tick siguiente.
  const STALE_MS = getSeoGeoSettings().staleMinutes * 60_000;

  // Reconciliar `running`: destrabar huérfanas; una fresca sí serializa.
  const running = await service.listSeoAudits({ status: 'running' }, { take: 20, order: { updated_at: 'DESC' } });
  const now = Date.now();
  let hasFreshRunning = false;
  for (const a of running) {
    const lastProgress = a.updated_at ? new Date(a.updated_at).getTime() : 0;
    if (now - lastProgress > STALE_MS) {
      await service
        .updateSeoAudits({
          id: a.id,
          status: 'failed',
          completed_at: new Date(),
          error_summary: {
            message: `Auditoría huérfana: sin progreso por más de ${Math.round(STALE_MS / 60_000)} min. Probable reinicio/deploy/OOM del backend durante el crawl.`,
            recovered: true,
          },
        })
        .catch(() => undefined);
      logger.warn(`[seo-geo] auditoría ${a.id} destrabada (huérfana en running)`);
    } else {
      hasFreshRunning = true;
    }
  }
  if (hasFreshRunning) return;

  const queued = await service.listSeoAudits({ status: 'queued' }, { take: 1, order: { created_at: 'ASC' } });
  const audit = queued[0];
  if (!audit) return;

  logger.info(`[seo-geo] arrancando auditoría ${audit.id}`);
  await runAudit(container, audit.id);
}
