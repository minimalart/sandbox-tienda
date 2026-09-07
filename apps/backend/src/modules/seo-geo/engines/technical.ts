import type { CrawledPage } from '../crawler/types';
import type { TechnicalThresholds } from '../config';
import type { EngineFinding } from './types';

/**
 * Motor técnico (PRD §9): corre reporters por página sobre el snapshot SEO.
 * Portado de `page-reporters.ts` de open-seo (MIT) con los mismos umbrales
 * (configurables). Cada reporter devuelve 0..1 hallazgos con su severidad.
 */
export function runTechnicalEngine(pages: CrawledPage[], t: TechnicalThresholds): EngineFinding[] {
  const findings: EngineFinding[] = [];
  for (const p of pages) findings.push(...analyzePage(p, t));
  return findings;
}

function analyzePage(p: CrawledPage, t: TechnicalThresholds): EngineFinding[] {
  const out: EngineFinding[] = [];
  const page = (type: string, severity: EngineFinding['severity'], details?: Record<string, unknown>) =>
    out.push({ engine: 'technical', type, severity, entity_type: 'page', page_url: p.url, details: details ?? null });

  // Estado del fetch
  if (p.fetch_class === 'blocked') {
    page('blocked-page', 'critical', { status_code: p.status_code });
    return out; // sin más análisis si está bloqueada
  }
  if (p.status_code && p.status_code >= 500) {
    page('server-error', 'critical', { status_code: p.status_code });
    return out;
  }
  if (p.status_code && p.status_code >= 400) {
    page('broken-page', 'critical', { status_code: p.status_code });
    return out;
  }
  if (p.fetch_class === 'error') {
    page('fetch-error', 'critical', {});
    return out;
  }
  if (p.response_time_ms && p.response_time_ms > t.slow_response_ms) {
    page('slow-response', 'warning', { response_time_ms: p.response_time_ms, threshold: t.slow_response_ms });
  }

  // Indexabilidad
  if (!p.is_indexable) {
    page('noindex-page', 'critical', { robots_meta: p.robots_meta, x_robots_tag: p.x_robots_tag });
  }
  // Conflicto de canonical (HTML vs header)
  if (p.canonical_url && p.canonical_header && p.canonical_url !== p.canonical_header) {
    page('canonical-conflict', 'warning', { html: p.canonical_url, header: p.canonical_header });
  }
  // Página canonicalizada hacia otra
  if (p.canonical_url && p.canonical_url !== p.url) {
    page('canonicalized-page', 'info', { canonical: p.canonical_url });
  }

  // Title
  if (!p.title) page('missing-title', 'critical', {});
  else {
    if (p.title.length > t.title_max) page('title-too-long', 'warning', { length: p.title.length, max: t.title_max });
    if (p.title.length < t.title_min) page('title-too-short', 'warning', { length: p.title.length, min: t.title_min });
  }

  // Meta description
  if (!p.meta_description) page('missing-meta-description', 'critical', {});
  else {
    if (p.meta_description.length > t.meta_description_max)
      page('meta-description-too-long', 'warning', { length: p.meta_description.length, max: t.meta_description_max });
    if (p.meta_description.length < t.meta_description_min)
      page('meta-description-too-short', 'warning', { length: p.meta_description.length, min: t.meta_description_min });
  }

  // Encabezados
  if (p.h1_count === 0) page('missing-h1', 'critical', {});
  else if (p.h1_count > 1) page('multiple-h1', 'warning', { count: p.h1_count });
  if (hasHeadingSkip(p.heading_order)) page('heading-order-skip', 'warning', { order: p.heading_order });

  // Contenido delgado (solo indexables)
  if (p.is_indexable && p.word_count > 0 && p.word_count < t.thin_content_words) {
    page('thin-content', 'warning', { word_count: p.word_count, threshold: t.thin_content_words });
  }

  // Imágenes sin alt
  if (p.images_missing_alt > 0) {
    page('images-missing-alt', 'warning', { missing: p.images_missing_alt, total: p.images_total });
  }

  // Datos estructurados ausentes (habilitador de GEO / rich results)
  if (p.is_indexable && !p.has_structured_data) {
    page('missing-structured-data', 'warning', {});
  }

  // Sin enlaces salientes
  if (p.internal_link_count === 0 && p.external_link_count === 0) {
    page('no-outgoing-links', 'warning', {});
  }

  // Página profunda
  if (p.crawl_depth >= t.deep_page_depth) {
    page('deep-page', 'info', { depth: p.crawl_depth, threshold: t.deep_page_depth });
  }

  return out;
}

/** ¿La secuencia de encabezados salta un nivel al bajar (ej. H2→H4)? */
function hasHeadingSkip(order: number[]): boolean {
  for (let i = 1; i < order.length; i++) {
    const cur = order[i] ?? 0;
    const prev = order[i - 1] ?? 0;
    if (cur - prev > 1) return true;
  }
  return false;
}
