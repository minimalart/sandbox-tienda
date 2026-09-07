import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { scoreProduct } from './scoring';
import { aggregateAiVisibility, geoFindings } from './aggregate';
import { runCatalogEngine } from '../engines/catalog';
import { SEO_GEO_DEFAULTS } from '../config';
import type { GeoProductInput } from './types';

const { geo_weights: W, geo_thresholds: T } = SEO_GEO_DEFAULTS;

const RICH: GeoProductInput = {
  id: 'prod_rich',
  title: 'Mate imperial de cuero premium',
  subtitle: 'Con bombilla incluida',
  description:
    'Mate imperial de cuero genuino, capacidad 250ml. Ideal para el mate diario y para regalo. ' +
    'El material de cuero premium permite mayor durabilidad y mejora la experiencia. Compatible con bombillas estándar. ' +
    '¿Cómo se cura? Se recomienda curarlo antes del primer uso. '.repeat(2),
  material: 'cuero',
  weight: 300,
  length: 12,
  height: 10,
  width: 10,
  tags: ['mate', 'cuero', 'regalo', 'imperial', 'premium'],
  categories: ['Mates', 'Regalos'],
  collection: 'Materia',
  type: 'Mate',
  brand: 'Materia',
  variants: [{ sku: 'MATE-001', barcode: '7791234567890', ean: null, upc: null }],
  option_titles: ['Color', 'Terminación'],
  images_count: 4,
  images_with_alt: 4,
  metadata_keys: ['origen', 'garantia'],
  has_faq: true,
};

const POOR: GeoProductInput = {
  id: 'prod_poor',
  title: 'Mate',
  subtitle: null,
  description: 'Mate lindo.',
  material: null,
  weight: null,
  length: null,
  height: null,
  width: null,
  tags: [],
  categories: [],
  collection: null,
  type: null,
  brand: null,
  variants: [{ sku: null, barcode: null, ean: null, upc: null }],
  option_titles: [],
  images_count: 0,
  images_with_alt: 0,
  metadata_keys: [],
  has_faq: false,
};

describe('scoreProduct', () => {
  it('puntúa alto un producto completo y detecta sus flags', () => {
    const r = scoreProduct(RICH, W, T);
    assert.ok(r.score >= 70, `score ${r.score} debería ser alto`);
    assert.equal(r.has_materials, true);
    assert.equal(r.has_use_cases, true);
    assert.equal(r.has_benefits, true);
    assert.equal(r.has_compatibilities, true);
    assert.equal(r.has_faq, true);
    assert.equal(r.is_comparable, true);
  });

  it('puntúa bajo un producto pobre y marca todos los gaps', () => {
    const r = scoreProduct(POOR, W, T);
    assert.ok(r.score < 40, `score ${r.score} debería ser bajo`);
    assert.equal(r.has_materials, false);
    assert.equal(r.is_comparable, false);
    assert.equal(r.has_faq, false);
  });
});

describe('aggregateAiVisibility', () => {
  it('promedia dimensiones y calcula coverage', () => {
    const results = [scoreProduct(RICH, W, T), scoreProduct(POOR, W, T)];
    const agg = aggregateAiVisibility(results, W, T);
    assert.equal(agg.products_total, 2);
    assert.ok(agg.score > 0 && agg.score <= 100);
    assert.equal(agg.products_sufficient, results.filter((r) => r.score >= T.sufficient_score).length);
    assert.equal(agg.coverage_percent, Math.round((agg.products_sufficient / 2) * 100));
  });
});

describe('geoFindings', () => {
  it('emite hallazgos agregados por gap con conteo', () => {
    const results = [scoreProduct(RICH, W, T), scoreProduct(POOR, W, T)];
    const findings = geoFindings(results);
    const materials = findings.find((f) => f.type === 'geo-no-materials');
    assert.ok(materials, 'debería haber hallazgo de materiales');
    assert.equal((materials!.details as { count: number }).count, 1);
    assert.equal(materials!.entity_type, 'site');
  });
});

describe('runCatalogEngine', () => {
  it('detecta descripción faltante/corta, sin sku, sin categorías, sin imágenes', () => {
    const types = new Set(runCatalogEngine([POOR]).map((f) => f.type));
    assert.ok(types.has('catalog-short-description'));
    assert.ok(types.has('catalog-missing-sku'));
    assert.ok(types.has('catalog-no-categories'));
    assert.ok(types.has('catalog-no-images'));
  });
});
