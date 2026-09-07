import type { GeoProductInput } from '../geo/types';
import type { EngineFinding } from './types';
import { createHash } from 'node:crypto';

/**
 * Motor de catálogo (PRD §9): calidad de la ficha desde los datos de Medusa
 * (no del HTML). Emite hallazgos AGREGADOS por tipo (con conteo + muestra), al
 * estilo del PRD §14. El detalle por producto vive en seo_geo_product_score.
 */
export function runCatalogEngine(products: GeoProductInput[]): EngineFinding[] {
  const out: EngineFinding[] = [];
  const agg = (
    type: string,
    label: string,
    severity: EngineFinding['severity'],
    pred: (p: GeoProductInput) => boolean
  ) => {
    const affected = products.filter(pred);
    if (affected.length === 0) return;
    out.push({
      engine: 'catalog',
      type,
      severity,
      entity_type: 'site',
      details: { label, count: affected.length, sample_product_ids: affected.slice(0, 20).map((p) => p.id) },
    });
  };

  const wordCount = (s: string | null) => (s ? s.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length : 0);

  agg('catalog-missing-description', 'sin descripción', 'critical', (p) => wordCount(p.description) === 0);
  agg('catalog-short-description', 'con descripción muy corta', 'warning', (p) => {
    const w = wordCount(p.description);
    return w > 0 && w < 20;
  });
  agg('catalog-missing-subtitle', 'sin subtítulo', 'info', (p) => !p.subtitle);
  agg('catalog-missing-sku', 'sin SKU', 'warning', (p) => !p.variants.some((v) => v.sku));
  agg('catalog-missing-gtin', 'sin GTIN/EAN/UPC', 'info', (p) => !p.variants.some((v) => v.barcode || v.ean || v.upc));
  agg('catalog-missing-brand', 'sin marca', 'info', (p) => !p.brand);
  agg('catalog-no-categories', 'sin categoría', 'warning', (p) => p.categories.length === 0);
  agg('catalog-no-images', 'sin imágenes', 'critical', (p) => p.images_count === 0);
  agg('catalog-images-missing-alt', 'con imágenes sin alt', 'warning', (p) => p.images_count > p.images_with_alt);

  // Descripciones duplicadas (mismo texto normalizado en >1 producto)
  const byHash = new Map<string, string[]>();
  for (const p of products) {
    const norm = (p.description ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
    if (norm.length < 20) continue;
    const h = createHash('sha256').update(norm).digest('hex');
    const arr = byHash.get(h) ?? [];
    arr.push(p.id);
    byHash.set(h, arr);
  }
  const dupIds = [...byHash.values()].filter((ids) => ids.length > 1).flat();
  if (dupIds.length) {
    out.push({
      engine: 'catalog',
      type: 'catalog-duplicate-description',
      severity: 'warning',
      entity_type: 'site',
      details: { label: 'con descripción duplicada', count: dupIds.length, sample_product_ids: dupIds.slice(0, 20) },
    });
  }

  return out;
}
