import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { SEO_GEO_MODULE } from '../../../../../modules/seo-geo';
import type SeoGeoModuleService from '../../../../../modules/seo-geo/service';

import { siteFromRequest } from '../../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../../lib/multistore/scope';
import { SEO_AUDIT_SITE_SCOPE } from '../../../../../modules/seo-geo/site-scope';

/**
 * GET /admin/seo-geo/audits/:id — detalle de una auditoría con sus hallazgos y
 * un extracto de páginas. Base para el detalle de auditoría del admin (Hito 3).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  // El id del padre. Todos los handlers: el listado filtra, pero el id se
  // adivina desde ahí.
  await assertIdInSite(req.scope, await siteFromRequest(req), SEO_AUDIT_SITE_SCOPE, req.params.id as string);

  const id = req.params.id as string;
  const service = req.scope.resolve<SeoGeoModuleService>(SEO_GEO_MODULE);

  const audit = await service.retrieveSeoAudit(id).catch(() => null);
  if (!audit) {
    res.status(404).json({ type: 'not_found', message: `Auditoría ${id} no encontrada` });
    return;
  }

  const findingLimit = req.query.finding_limit ? Number(req.query.finding_limit) : 200;
  const [findings, findingsCount] = await service.listAndCountSeoFindings(
    { audit_id: id },
    { take: findingLimit, order: { severity: 'ASC', created_at: 'ASC' } }
  );
  const [, pagesCount] = await service.listAndCountSeoAuditPages({ audit_id: id }, { take: 0 });

  res.status(200).json({ audit, findings, findings_count: findingsCount, pages_count: pagesCount });
}
