import * as cheerio from 'cheerio';
import { createHash } from 'node:crypto';
import type { ExtractedLink, PageAnalysis } from './types';
import { isCrawlableHref, isSameOrigin, normalizeUrl } from './url-utils';

/**
 * Parsea el HTML de una página y devuelve una representación estructurada SEO
 * (PRD §6). Función pura testeable. Portada de `analyzeHtml()` de open-seo (MIT)
 * y adaptada: usa Cheerio (corre en Node sin cambios), snake_case, y resuelve
 * enlaces a same-origin contra la URL final.
 */
export function analyzeHtml(
  html: string,
  url: string,
  statusCode: number,
  responseTimeMs: number,
  headers?: { canonical?: string | null; xRobotsTag?: string | null; contentType?: string | null }
): PageAnalysis {
  const $ = cheerio.load(html);

  const title = text($('title').first().text());
  const meta_description = attr($, 'meta[name="description"]', 'content');
  const canonical_url = normalizeUrl($('link[rel="canonical"]').first().attr('href') || '', url);
  const robots_meta = attr($, 'meta[name="robots"]', 'content');
  const og_title = attr($, 'meta[property="og:title"]', 'content');
  const og_description = attr($, 'meta[property="og:description"]', 'content');
  const og_image = attr($, 'meta[property="og:image"]', 'content');

  // Encabezados: conteo por nivel + secuencia (para detectar saltos)
  const heading_order: number[] = [];
  const counts = [0, 0, 0, 0, 0, 0];
  $('h1,h2,h3,h4,h5,h6').each((_, el) => {
    const tag = (el as { tagName?: string }).tagName || (el as { name?: string }).name || '';
    const level = Number(tag[1]);
    if (level >= 1 && level <= 6) {
      counts[level - 1] = (counts[level - 1] ?? 0) + 1;
      heading_order.push(level);
    }
  });

  // Imágenes: total + sin alt (alt ausente, no alt="")
  let images_total = 0;
  let images_missing_alt = 0;
  $('img').each((_, el) => {
    images_total += 1;
    if ($(el).attr('alt') === undefined) images_missing_alt += 1;
  });

  // Enlaces: internos/externos + nofollow
  const links: ExtractedLink[] = [];
  let internal_link_count = 0;
  let external_link_count = 0;
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (!isCrawlableHref(href)) return;
    const resolved = normalizeUrl(href, url);
    if (!resolved) return;
    const internal = isSameOrigin(resolved, url);
    if (internal) internal_link_count += 1;
    else external_link_count += 1;
    const rel = ($(el).attr('rel') || '').toLowerCase();
    const anchorText = text($(el).text());
    links.push({
      target_url: resolved,
      anchor: anchorText ? anchorText.slice(0, 200) : null,
      is_internal: internal,
      is_nofollow: rel.includes('nofollow'),
    });
  });

  // JSON-LD (datos estructurados): presencia + @type declarados
  const structured_data_types: string[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const parsed = JSON.parse($(el).contents().text());
      collectJsonLdTypes(parsed, structured_data_types);
    } catch {
      // JSON-LD inválido: se cuenta como presente pero sin tipo
    }
  });
  const has_structured_data = $('script[type="application/ld+json"]').length > 0;

  const hreflang_tags: string[] = [];
  $('link[rel="alternate"][hreflang]').each((_, el) => {
    const v = $(el).attr('hreflang');
    if (v) hreflang_tags.push(v);
  });

  // Conteo de palabras del contenido visible (sin script/style/noscript/svg)
  const bodyClone = $('body').clone();
  bodyClone.find('script, style, noscript, svg').remove();
  const bodyText = text(bodyClone.text());
  const word_count = bodyText ? bodyText.split(/\s+/).filter(Boolean).length : 0;
  const content_hash = bodyText ? createHash('sha256').update(bodyText).digest('hex') : null;

  // Sin header no hay header: `null`, no la propia URL.
  //
  // `normalizeUrl('', url)` devuelve `url` — `new URL('', base)` resuelve a la base —, así
  // que con `|| ''` este campo valía SIEMPRE la URL de la página, incluso cuando la
  // respuesta no traía ningún `Link: rel="canonical"` (que es el caso normal: Next no lo
  // emite). Consecuencia: `canonical-conflict` disparaba cada vez que el canonical del
  // HTML apuntaba a otra parte, o sea que era un duplicado de `canonicalized-page` y no
  // podía quedar en verde para una URL consolidada A PROPÓSITO — una faceta de listado
  // canonicalizando al listado. 22 hallazgos falsos en la auditoría del 19/08.
  const canonical_header = headers?.canonical ? normalizeUrl(headers.canonical, url) : null;
  const x_robots_tag = headers?.xRobotsTag ?? null;

  const is_indexable = computeIndexable(statusCode, robots_meta, x_robots_tag);

  // Site gate: el storefront monta `SiteGateScreen` con este `data-testid` y tapa la
  // página entera (`modules/site-gate/components/site-gate-screen.tsx`). Se detecta por
  // el testid y no por el `noindex` que la pantalla también emite, porque `noindex` lo
  // pone cualquier página legítimamente y no significa lo mismo.
  const is_gated = $('[data-testid="site-gate"]').length > 0;

  return {
    url,
    status_code: statusCode,
    fetch_class: 'ok',
    response_time_ms: responseTimeMs,
    content_type: headers?.contentType ?? null,
    canonical_url,
    canonical_header,
    robots_meta,
    x_robots_tag,
    is_indexable,
    title,
    meta_description,
    og_title,
    og_description,
    og_image,
    h1_count: counts[0] ?? 0,
    h2_count: counts[1] ?? 0,
    h3_count: counts[2] ?? 0,
    h4_count: counts[3] ?? 0,
    h5_count: counts[4] ?? 0,
    h6_count: counts[5] ?? 0,
    heading_order,
    word_count,
    content_hash,
    images_total,
    images_missing_alt,
    internal_link_count,
    external_link_count,
    has_structured_data,
    structured_data_types: [...new Set(structured_data_types)],
    hreflang_tags,
    links,
    is_gated,
  };
}

/** Indexable si 2xx y no hay noindex en meta robots ni X-Robots-Tag. */
export function computeIndexable(
  statusCode: number,
  robotsMeta: string | null,
  xRobotsTag: string | null
): boolean {
  if (statusCode < 200 || statusCode >= 300) return false;
  const hay = `${robotsMeta || ''} ${xRobotsTag || ''}`.toLowerCase();
  return !hay.includes('noindex');
}

function collectJsonLdTypes(node: unknown, out: string[]): void {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const n of node) collectJsonLdTypes(n, out);
    return;
  }
  if (typeof node === 'object') {
    const t = (node as Record<string, unknown>)['@type'];
    if (typeof t === 'string') out.push(t);
    else if (Array.isArray(t)) for (const x of t) if (typeof x === 'string') out.push(x);
    const graph = (node as Record<string, unknown>)['@graph'];
    if (graph) collectJsonLdTypes(graph, out);
  }
}

function text(v: string | null | undefined): string | null {
  const s = (v || '').replace(/\s+/g, ' ').trim();
  return s || null;
}

function attr($: cheerio.CheerioAPI, selector: string, name: string): string | null {
  return text($(selector).first().attr(name));
}
