import type { MedusaContainer } from '@medusajs/framework/types';
import { SEO_GEO_MODULE } from '../index';
import type SeoGeoModuleService from '../service';
import type { SeoGeoConfig } from '../config';
import { loadGeoProducts } from './load-products';
import { scoreProduct } from './scoring';
import { aggregateAiVisibility, geoFindings, type AiVisibilityAggregate } from './aggregate';
import { runCatalogEngine } from '../engines/catalog';
import type { EngineFinding } from '../engines/types';

export type GeoRunResult = {
  findings: EngineFinding[];
  aiVisibility: AiVisibilityAggregate;
  scored: number;
};

/**
 * Corre los motores basados en Medusa (catálogo + GEO) para una auditoría:
 * carga productos, los puntúa (heurístico), persiste el score por producto y el
 * snapshot de AI Visibility, y devuelve los hallazgos agregados + el score.
 */
export async function runGeoScoring(
  container: MedusaContainer,
  auditId: string,
  salesChannelId: string | null,
  cfg: SeoGeoConfig
): Promise<GeoRunResult> {
  const service = container.resolve<SeoGeoModuleService>(SEO_GEO_MODULE);

  const products = await loadGeoProducts(container, {
    salesChannelId,
    max: cfg.crawl.max_pages * 20, // techo generoso; el catálogo no es el crawl
  });

  const results = products.map((p) => scoreProduct(p, cfg.geo_weights, cfg.geo_thresholds));

  // Persistir score por producto
  if (results.length) {
    await service.createSeoGeoProductScores(
      results.map((r) => ({
        audit_id: auditId,
        product_id: r.product_id,
        score: r.score,
        comprehension: r.comprehension,
        coverage: r.coverage,
        authority: r.authority,
        comparability: r.comparability,
        structured_data: r.structured_data,
        depth: r.depth,
        has_use_cases: r.has_use_cases,
        has_materials: r.has_materials,
        is_comparable: r.is_comparable,
        has_faq: r.has_faq,
        has_benefits: r.has_benefits,
        has_compatibilities: r.has_compatibilities,
        signals: r.signals,
      })) as never
    );
  }

  const aiVisibility = aggregateAiVisibility(results, cfg.geo_weights, cfg.geo_thresholds);

  // Snapshot de AI Visibility para el historial (PRD §16)
  await service.createSeoAiVisibilitySnapshots({
    audit_id: auditId,
    sales_channel_id: salesChannelId,
    score: aiVisibility.score,
    breakdown: aiVisibility.breakdown,
    products_total: aiVisibility.products_total,
    products_sufficient: aiVisibility.products_sufficient,
    coverage_percent: aiVisibility.coverage_percent,
    captured_at: new Date(),
  } as never);

  const findings: EngineFinding[] = [];
  if (cfg.engines.catalog) findings.push(...runCatalogEngine(products));
  if (cfg.engines.geo) findings.push(...geoFindings(results));

  return { findings, aiVisibility, scored: results.length };
}
