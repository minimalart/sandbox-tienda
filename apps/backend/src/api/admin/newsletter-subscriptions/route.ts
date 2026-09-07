import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { siteFilter, siteFromRequest } from '../../../lib/multistore';
import { NEWSLETTER_MODULE } from '../../../modules/newsletter';
import type NewsletterModuleService from '../../../modules/newsletter/service';
import { NEWSLETTER_SUBSCRIPTION_SITE_SCOPE } from '../../../modules/newsletter/site-scope';

const SYNC_STATUSES = new Set(['pending', 'synced', 'failed', 'skipped']);

/**
 * GET /admin/newsletter-subscriptions — listado paginado (más nuevos primero).
 *
 * Devuelve además `pending_count`: cuántas de las suscripciones VISIBLES en este
 * scope no llegaron a Brevo. Es el número que justifica la pantalla — sin él, una
 * tienda mal configurada se ve igual que una que anda, sólo que con una tabla
 * llena de filas que nadie va a leer una por una.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service: NewsletterModuleService = req.scope.resolve(NEWSLETTER_MODULE);

  const limit = Math.min(Number(req.query.limit ?? 20) || 20, 100);
  const offset = Number(req.query.offset ?? 0) || 0;
  const syncStatus = req.query.sync_status as string | undefined;

  // El filtro de tienda va en el WHERE. Si se aplicara en memoria, `count`
  // mentiría y la paginación devolvería páginas de tamaño variable.
  const scopeFilter = await siteFilter(
    req.scope,
    await siteFromRequest(req),
    NEWSLETTER_SUBSCRIPTION_SITE_SCOPE,
  );

  const filters: Record<string, unknown> = { ...scopeFilter };
  if (syncStatus && SYNC_STATUSES.has(syncStatus)) filters.sync_status = syncStatus;

  const [newsletter_subscriptions, count] = await service.listAndCountNewsletterSubscriptions(
    filters,
    { take: limit, skip: offset, order: { created_at: 'DESC' } },
  );

  /**
   * Se cuenta sobre el scope, no sobre la página: el operador necesita saber si
   * hay algo roto en SU tienda, no en las 20 filas que le tocaron.
   */
  const [, pending_count] = await service.listAndCountNewsletterSubscriptions(
    { ...scopeFilter, sync_status: ['pending', 'failed', 'skipped'] },
    { take: 1 },
  );

  return res.json({ newsletter_subscriptions, count, pending_count, limit, offset });
}
