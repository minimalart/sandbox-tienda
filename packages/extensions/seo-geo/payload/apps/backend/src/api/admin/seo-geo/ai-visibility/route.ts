import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { siteFromRequest } from '../../../../lib/multistore/request';
import { siteChannelFilter } from '../../../../lib/multistore/scope';
import { SEO_GEO_MODULE } from '../../../../modules/seo-geo';
import type SeoGeoModuleService from '../../../../modules/seo-geo/service';

/**
 * GET /admin/seo-geo/ai-visibility — AI Visibility Score actual + desglose por
 * dimensión + AI Coverage + historial de snapshots (PRD §11/§13/§16). Filtro
 * opcional por sales_channel_id.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<SeoGeoModuleService>(SEO_GEO_MODULE);
  const filters: Record<string, unknown> = {};
  // La tienda activa como default; el parámetro explícito gana.
  Object.assign(
    filters,
    siteChannelFilter(
      await siteFromRequest(req),
      typeof req.query.sales_channel_id === 'string' ? req.query.sales_channel_id : undefined,
    ),
  );

  const snapshots = await service.listSeoAiVisibilitySnapshots(filters, {
    take: 24,
    order: { captured_at: 'DESC' },
  });

  const latest = snapshots[0] ?? null;
  // Historial en orden cronológico ascendente para graficar (junio → julio → …)
  const history = [...snapshots].reverse();

  res.status(200).json({ latest, history });
}
