import type { GeoThresholds, GeoWeights } from '../config';
import type { GeoProductResult } from './types';
import type { EngineFinding } from '../engines/types';

export type AiVisibilityAggregate = {
  score: number;
  breakdown: {
    comprehension: number;
    coverage: number;
    authority: number;
    comparability: number;
    structured_data: number;
    depth: number;
  };
  products_total: number;
  products_sufficient: number;
  coverage_percent: number;
};

/**
 * Agrega los scores por producto en el AI Visibility Score del sitio (PRD §11):
 * el breakdown es el promedio de cada dimensión; el score global el promedio
 * ponderado del breakdown. `coverage_percent` = AI Coverage (PRD §13): % de
 * productos con información suficiente (score ≥ umbral).
 */
export function aggregateAiVisibility(
  results: GeoProductResult[],
  weights: GeoWeights,
  thresholds: GeoThresholds
): AiVisibilityAggregate {
  const n = results.length;
  const avg = (sel: (r: GeoProductResult) => number) =>
    n === 0 ? 0 : Math.round(results.reduce((s, r) => s + sel(r), 0) / n);

  const breakdown = {
    comprehension: avg((r) => r.comprehension),
    coverage: avg((r) => r.coverage),
    authority: avg((r) => r.authority),
    comparability: avg((r) => r.comparability),
    structured_data: avg((r) => r.structured_data),
    depth: avg((r) => r.depth),
  };

  const wsum =
    weights.comprehension +
    weights.coverage +
    weights.authority +
    weights.comparability +
    weights.structured_data +
    weights.depth || 1;
  const score = Math.round(
    (breakdown.comprehension * weights.comprehension +
      breakdown.coverage * weights.coverage +
      breakdown.authority * weights.authority +
      breakdown.comparability * weights.comparability +
      breakdown.structured_data * weights.structured_data +
      breakdown.depth * weights.depth) /
      wsum
  );

  const products_sufficient = results.filter((r) => r.score >= thresholds.sufficient_score).length;
  const coverage_percent = n === 0 ? 0 : Math.round((products_sufficient / n) * 100);

  return { score, breakdown, products_total: n, products_sufficient, coverage_percent };
}

/**
 * Hallazgos GEO agregados (PRD §14): un hallazgo por tipo de gap con el conteo
 * de productos afectados y una muestra de ids. Sólo se emite si hay afectados.
 */
export function geoFindings(results: GeoProductResult[]): EngineFinding[] {
  const gaps: Array<{ type: string; label: string; pred: (r: GeoProductResult) => boolean; severity: EngineFinding['severity'] }> = [
    { type: 'geo-no-use-cases', label: 'no poseen casos de uso', pred: (r) => !r.has_use_cases, severity: 'warning' },
    { type: 'geo-no-materials', label: 'no indican materiales', pred: (r) => !r.has_materials, severity: 'warning' },
    { type: 'geo-not-comparable', label: 'no permiten comparaciones', pred: (r) => !r.is_comparable, severity: 'warning' },
    { type: 'geo-no-compatibilities', label: 'no explican compatibilidades', pred: (r) => !r.has_compatibilities, severity: 'info' },
    { type: 'geo-no-benefits', label: 'no contienen beneficios', pred: (r) => !r.has_benefits, severity: 'warning' },
    { type: 'geo-no-faq', label: 'no tienen preguntas frecuentes', pred: (r) => !r.has_faq, severity: 'info' },
  ];

  const out: EngineFinding[] = [];
  for (const g of gaps) {
    const affected = results.filter(g.pred);
    if (affected.length === 0) continue;
    out.push({
      engine: 'geo',
      type: g.type,
      severity: g.severity,
      entity_type: 'site',
      details: {
        label: g.label,
        count: affected.length,
        sample_product_ids: affected.slice(0, 20).map((r) => r.product_id),
      },
    });
  }
  return out;
}
