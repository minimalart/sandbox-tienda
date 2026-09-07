import type { GeoThresholds, GeoWeights } from '../config';
import type { GeoProductInput, GeoProductResult } from './types';

/**
 * Scoring GEO heurístico (PRD §10/§11). Función pura sobre datos de Medusa, SIN
 * LLM por producto: barato, determinista y escalable a catálogos grandes. Mide
 * la PROBABILIDAD de que un LLM comprenda y use el producto como fuente, no una
 * "aparición" en ChatGPT (que ningún proveedor puede medir hoy — PRD, cierre).
 */

// Señales de texto en español. Cada set detecta un tipo de contenido útil.
const USE_CASE_RE = /\b(ideal para|perfecto para|usar para|uso|se usa|pensado para|recomendado para|apto para|para el|para la)\b/i;
const BENEFIT_RE = /\b(beneficio|permite|ayuda a|mejora|facilita|gracias a|te permite|lográs|conseguís|evita|protege|ahorra)\b/i;
const COMPAT_RE = /\b(compatible|combina con|va con|encastra|acople|para usar con|funciona con|apto para)\b/i;
const MATERIAL_RE = /\b(cuero|algod[oó]n|acero|inoxidable|madera|pl[aá]stico|vidrio|cer[aá]mica|silicona|aluminio|goma|tela|poli[eé]ster|nylon|bamb[uú]|material)\b/i;
const FAQ_RE = /(\?\s+[A-ZÁÉÍÓÚ])|(preguntas frecuentes|¿c[oó]mo|¿qu[eé]|¿cu[aá]l|¿cu[aá]nto)/i;

function words(s: string | null): number {
  if (!s) return 0;
  return stripHtml(s).split(/\s+/).filter(Boolean).length;
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Escala lineal 0..100 saturando en `full`. */
function ramp(value: number, full: number): number {
  if (full <= 0) return value > 0 ? 100 : 0;
  return Math.round(Math.max(0, Math.min(100, (value / full) * 100)));
}

/** Cantidad de atributos comparables presentes (dimensiones, peso, opciones, metadata, material). */
function comparableAttributes(p: GeoProductInput): number {
  let n = 0;
  if (p.material) n += 1;
  if (p.weight) n += 1;
  if (p.length || p.height || p.width) n += 1;
  n += p.option_titles.length;
  n += p.metadata_keys.length;
  return n;
}

function hasIdentifier(p: GeoProductInput): boolean {
  return p.variants.some((v) => v.sku || v.barcode || v.ean || v.upc);
}

export function scoreProduct(p: GeoProductInput, weights: GeoWeights, thresholds: GeoThresholds): GeoProductResult {
  const desc = p.description ?? '';
  const descWords = words(desc);
  const descText = stripHtml(desc);

  // Flags de contenido
  const has_materials = Boolean(p.material) || MATERIAL_RE.test(descText);
  const has_use_cases = USE_CASE_RE.test(descText);
  const has_benefits = BENEFIT_RE.test(descText);
  const has_compatibilities = COMPAT_RE.test(descText);
  const has_faq = p.has_faq || FAQ_RE.test(descText);
  const attrs = comparableAttributes(p);
  const is_comparable = attrs >= thresholds.min_attributes;

  // Dimensiones 0-100
  // Comprensión: hay suficiente texto + título/subtítulo para responder preguntas.
  const comprehension = Math.round(
    0.6 * ramp(descWords, Math.max(thresholds.min_description_words * 3, 120)) +
      0.2 * (p.title ? 100 : 0) +
      0.2 * (p.subtitle ? 100 : 0)
  );

  // Cobertura: amplitud temática (categorías, tags, casos de uso, FAQ).
  const coverage = Math.round(
    0.3 * ramp(p.categories.length, 2) +
      0.2 * ramp(p.tags.length, 5) +
      0.25 * (has_use_cases ? 100 : 0) +
      0.25 * (has_faq ? 100 : 0)
  );

  // Autoridad: contenido propio y específico (materiales, medidas, beneficios).
  const authority = Math.round(
    0.4 * ramp(descWords, Math.max(thresholds.min_description_words * 4, 160)) +
      0.2 * (has_materials ? 100 : 0) +
      0.2 * (p.weight || p.length || p.height || p.width ? 100 : 0) +
      0.2 * (has_benefits ? 100 : 0)
  );

  // Comparabilidad: existen atributos comparables suficientes.
  const comparability = ramp(attrs, Math.max(thresholds.min_attributes * 2, 4));

  // Datos estructurados: datos disponibles para armar un Product schema rico
  // (identificador, marca, imágenes, descripción). Habilitado por el Hito 5 en
  // el storefront; acá se mide la MATERIA PRIMA para ese schema.
  const structured_data = Math.round(
    0.3 * (hasIdentifier(p) ? 100 : 0) +
      0.25 * (p.brand ? 100 : 0) +
      0.25 * ramp(p.images_count, 3) +
      0.2 * (descWords > 0 ? 100 : 0)
  );

  // Profundidad: riqueza de contenido (texto largo + FAQ + compatibilidades).
  const depth = Math.round(
    0.5 * ramp(descWords, 200) + 0.25 * (has_faq ? 100 : 0) + 0.25 * (has_compatibilities ? 100 : 0)
  );

  const dims = { comprehension, coverage, authority, comparability, structured_data, depth };
  const wsum =
    weights.comprehension +
    weights.coverage +
    weights.authority +
    weights.comparability +
    weights.structured_data +
    weights.depth;
  const score = Math.round(
    (comprehension * weights.comprehension +
      coverage * weights.coverage +
      authority * weights.authority +
      comparability * weights.comparability +
      structured_data * weights.structured_data +
      depth * weights.depth) /
      (wsum || 1)
  );

  return {
    product_id: p.id,
    score,
    ...dims,
    has_use_cases,
    has_materials,
    is_comparable,
    has_faq,
    has_benefits,
    has_compatibilities,
    signals: {
      description_words: descWords,
      comparable_attributes: attrs,
      has_identifier: hasIdentifier(p),
      images_count: p.images_count,
      categories: p.categories.length,
      tags: p.tags.length,
    },
  };
}
