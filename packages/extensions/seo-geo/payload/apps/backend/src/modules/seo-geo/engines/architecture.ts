import type { CrawledPage } from '../crawler/types';
import type { EngineFinding } from './types';

/**
 * Motor de arquitectura (PRD §8): detecciones que necesitan ver TODO el sitio
 * (no una página sola). Duplicados de title/meta/contenido, páginas huérfanas
 * (indexables sin inlinks internos) y enlaces internos rotos. Portado de
 * `multipage-checks.ts` de open-seo (MIT).
 */
export function runArchitectureEngine(pages: CrawledPage[]): EngineFinding[] {
  const out: EngineFinding[] = [];
  const site = (type: string, severity: EngineFinding['severity'], details: Record<string, unknown>) =>
    out.push({ engine: 'architecture', type, severity, entity_type: 'site', details });
  const page = (type: string, severity: EngineFinding['severity'], url: string, details: Record<string, unknown>) =>
    out.push({ engine: 'architecture', type, severity, entity_type: 'page', page_url: url, details });

  const indexable = pages.filter((p) => p.is_indexable && p.fetch_class === 'ok');

  // Duplicados de title
  for (const [value, urls] of groupBy(indexable, (p) => p.title).entries()) {
    if (value && urls.length > 1) site('duplicate-title', 'warning', { value, count: urls.length, urls: urls.slice(0, 20) });
  }
  // Duplicados de meta description
  for (const [value, urls] of groupBy(indexable, (p) => p.meta_description).entries()) {
    if (value && urls.length > 1)
      site('duplicate-meta-description', 'warning', { value, count: urls.length, urls: urls.slice(0, 20) });
  }
  // Contenido duplicado (mismo hash con contenido no vacío)
  for (const [hash, urls] of groupBy(indexable.filter((p) => p.word_count > 0), (p) => p.content_hash).entries()) {
    if (hash && urls.length > 1) site('duplicate-content', 'critical', { count: urls.length, urls: urls.slice(0, 20) });
  }

  // Mapa de status por URL (para enlaces rotos) y set de inlinks internos
  const statusByUrl = new Map<string, number | null>();
  for (const p of pages) statusByUrl.set(p.url, p.status_code);
  const hasInlink = new Set<string>();

  /**
   * Enlaces internos rotos: UN hallazgo por DESTINO, no uno por enlace.
   *
   * Antes se emitía uno por cada par (página, enlace), así que un destino que vive en el
   * footer aparecía una vez por página del sitio. La auditoría del 19/08 publicó 270
   * críticos —el 98% de todos sus críticos— por UNA sola URL caída. El destino es el
   * problema; las páginas que lo enlazan son contexto, y van en los `details`.
   *
   * Y sólo cuentan los 4xx. Un 5xx no es un enlace mal escrito, es indisponibilidad: ya
   * lo reporta `server-error` sobre la página que falló, y se arregla en el servidor, no
   * en el enlace. Mezclarlos convertía un 503 transitorio DURANTE el crawl en cientos de
   * enlaces rotos que no existen.
   */
  const brokenTargets = new Map<string, { status: number; sources: Set<string> }>();
  for (const p of pages) {
    for (const l of p.links) {
      if (!l.is_internal) continue;
      hasInlink.add(l.target_url);
      const targetStatus = statusByUrl.get(l.target_url);
      if (targetStatus == null || targetStatus < 400 || targetStatus >= 500) continue;
      const entry = brokenTargets.get(l.target_url) ?? { status: targetStatus, sources: new Set<string>() };
      entry.sources.add(p.url);
      brokenTargets.set(l.target_url, entry);
    }
  }
  for (const [target, broken] of brokenTargets) {
    page('broken-internal-link', 'critical', target, {
      target,
      status: broken.status,
      linked_from_count: broken.sources.size,
      linked_from: [...broken.sources].slice(0, 20),
    });
  }

  // Páginas huérfanas: indexables 2xx sin ningún inlink interno (excluida la raíz)
  for (const p of indexable) {
    const isRoot = safePath(p.url) === '/' || safePath(p.url) === '';
    if (!isRoot && !hasInlink.has(p.url)) {
      page('orphan-page', 'warning', p.url, { depth: p.crawl_depth });
    }
  }

  return out;
}

function groupBy<T>(items: T[], key: (t: T) => string | null): Map<string | null, string[]> {
  const map = new Map<string | null, string[]>();
  for (const it of items) {
    const k = key(it);
    const url = (it as unknown as { url: string }).url;
    const arr = map.get(k) ?? [];
    arr.push(url);
    map.set(k, arr);
  }
  return map;
}

function safePath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return '';
  }
}
