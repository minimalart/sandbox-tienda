import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { siteFromRequest } from '../../../../lib/multistore/request';
import { assertIdInSite, siteChannelFilter } from '../../../../lib/multistore/scope';
import { SEO_AUDIT_SITE_SCOPE } from '../../../../modules/seo-geo/site-scope';
import { SEO_GEO_MODULE } from '../../../../modules/seo-geo';
import type SeoGeoModuleService from '../../../../modules/seo-geo/service';

/**
 * GET /admin/seo-geo/findings — hallazgos filtrables (PRD §14). Sin `audit_id`
 * usa la última auditoría completada. Filtros: severity, engine, type, status.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<SeoGeoModuleService>(SEO_GEO_MODULE);
  const limit = req.query.limit ? Number(req.query.limit) : 100;
  const offset = req.query.offset ? Number(req.query.offset) : 0;

  const resolution = await siteFromRequest(req);

  let auditId = typeof req.query.audit_id === 'string' ? req.query.audit_id : '';
  if (auditId) {
    // Un `audit_id` explícito de OTRA tienda mostraba sus hallazgos sin más: el id se
    // adivina desde el listado de auditorías, que sí filtra.
    await assertIdInSite(req.scope, resolution, SEO_AUDIT_SITE_SCOPE, auditId);
  } else {
    // Y la "última auditoría" se tomaba de cualquier tienda. Abrir la pantalla sin
    // elegir auditoría mostraba los hallazgos de otra tienda como si fueran propios,
    // que es el peor modo de falla: parece que funciona.
    const latest = await service.listSeoAudits(
      { status: 'completed', ...siteChannelFilter(resolution, undefined) },
      { take: 1, order: { completed_at: 'DESC' } },
    );
    auditId = latest[0]?.id ?? '';
  }
  if (!auditId) {
    res.status(200).json({ findings: [], count: 0, offset, limit, audit_id: null });
    return;
  }

  const filters: Record<string, unknown> = { audit_id: auditId };
  for (const key of ['severity', 'engine', 'type', 'status', 'entity_type'] as const) {
    if (typeof req.query[key] === 'string' && req.query[key]) filters[key] = req.query[key];
  }

  const [findings, count] = await service.listAndCountSeoFindings(filters, {
    skip: offset,
    take: limit,
    order: { severity: 'ASC', created_at: 'ASC' },
  });

  res.status(200).json({ findings, count, offset, limit, audit_id: auditId });
}
