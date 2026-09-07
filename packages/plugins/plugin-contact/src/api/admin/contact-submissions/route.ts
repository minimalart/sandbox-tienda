import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { CONTACT_MODULE } from '../../../modules/contact';
import type ContactModuleService from '../../../modules/contact/service';
import { siteFilter, siteFromRequest } from '../../../lib/multistore-shim';
import { CONTACT_SUBMISSION_SITE_SCOPE } from '../../../modules/contact/site-scope';

/** GET /admin/contact-submissions — listado paginado (más nuevos primero). */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service: ContactModuleService = req.scope.resolve(CONTACT_MODULE);

  const limit = Math.min(Number(req.query.limit ?? 20) || 20, 100);
  const offset = Number(req.query.offset ?? 0) || 0;
  const status = req.query.status as string | undefined;

  const filters: Record<string, unknown> = {};
  if (status) filters.status = status;

  // El filtro va en el WHERE, no en memoria: si no, `count` miente y la
  // paginación devuelve páginas de tamaño variable.
  Object.assign(
    filters,
    await siteFilter(req.scope, await siteFromRequest(req), CONTACT_SUBMISSION_SITE_SCOPE),
  );

  const [contact_submissions, count] = await service.listAndCountContactSubmissions(
    filters,
    { take: limit, skip: offset, order: { created_at: 'DESC' } },
  );

  return res.json({ contact_submissions, count, limit, offset });
}
