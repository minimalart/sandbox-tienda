import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { siteFromRequest } from '../../../../lib/multistore/request';
import { siteChannelFilter } from '../../../../lib/multistore/scope';
import { SEO_GEO_MODULE } from '../../../../modules/seo-geo';
import type SeoGeoModuleService from '../../../../modules/seo-geo/service';

/**
 * GET /admin/seo-geo/dashboard — resumen para el dashboard (PRD §11): la última
 * auditoría completada con sus scores + desglose, y las auditorías recientes.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<SeoGeoModuleService>(SEO_GEO_MODULE);

  // El dashboard es el primer lugar donde alguien mira el score. Sin filtrar, el de
  // otra tienda pasa por propio — y un score ajeno no se distingue de uno malo.
  const site = siteChannelFilter(await siteFromRequest(req), undefined);

  const completed = await service.listSeoAudits(
    { status: 'completed', ...site },
    { take: 1, order: { completed_at: 'DESC' } }
  );
  const latest = completed[0] ?? null;

  const recent = await service.listSeoAudits(site, { take: 10, order: { created_at: 'DESC' } });

  res.status(200).json({
    latest,
    recent,
    seo_score: latest?.seo_score ?? null,
    ai_visibility_score: latest?.ai_visibility_score ?? null,
    ai_visibility_breakdown: latest?.ai_visibility_breakdown ?? null,
    findings_summary: latest?.findings_summary ?? null,
  });
}
