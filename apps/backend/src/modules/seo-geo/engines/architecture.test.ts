import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { runArchitectureEngine } from './architecture';
import type { CrawledPage, ExtractedLink } from '../crawler/types';

const BASE = 'https://shop.example.com';

/**
 * Página del crawl armada a mano.
 *
 * A propósito NO se usa `analyzeHtml`: arrastra `cheerio`, y este motor no ve HTML —
 * recibe `CrawledPage[]`. Cada página trae título y descripción propios para no disparar
 * los chequeos de duplicados, que son de este mismo motor.
 */
const page = (path: string, opts: { status?: number; linksTo?: string[] } = {}): CrawledPage => {
  const status = opts.status ?? 200;
  const links: ExtractedLink[] = (opts.linksTo ?? []).map((target) => ({
    target_url: `${BASE}${target}`,
    anchor: target,
    is_internal: true,
    is_nofollow: false,
  }));
  return {
    url: `${BASE}${path}`,
    status_code: status,
    fetch_class: 'ok',
    response_time_ms: 100,
    content_type: 'text/html',
    canonical_url: `${BASE}${path}`,
    canonical_header: null,
    robots_meta: null,
    x_robots_tag: null,
    is_indexable: status < 400,
    title: `Título de ${path}`,
    meta_description: `Descripción de ${path}`,
    og_title: null,
    og_description: null,
    og_image: null,
    h1_count: 1,
    h2_count: 1,
    h3_count: 0,
    h4_count: 0,
    h5_count: 0,
    h6_count: 0,
    heading_order: [1, 2],
    word_count: 400,
    content_hash: `hash-${path}`,
    images_total: 0,
    images_missing_alt: 0,
    internal_link_count: links.length,
    external_link_count: 0,
    has_structured_data: true,
    structured_data_types: [],
    hreflang_tags: [],
    links,
    is_gated: false,
    crawl_depth: 0,
    in_sitemap: true,
    page_type: null,
  };
};

const brokenLinks = (pages: CrawledPage[]) =>
  runArchitectureEngine(pages).filter((f) => f.type === 'broken-internal-link');

describe('runArchitectureEngine — enlaces internos rotos', () => {
  it('agrupa por DESTINO: un 404 enlazado desde 3 páginas es UN hallazgo', () => {
    const found = brokenLinks([
      page('/a', { linksTo: ['/roto'] }),
      page('/b', { linksTo: ['/roto'] }),
      page('/c', { linksTo: ['/roto'] }),
      page('/roto', { status: 404, linksTo: ['/a'] }),
    ]);

    // Uno por destino, no uno por enlace: antes esto emitía 3.
    assert.equal(found.length, 1);
    assert.equal(found[0]?.page_url, `${BASE}/roto`);
    assert.equal(found[0]?.details?.status, 404);
    assert.equal(found[0]?.details?.linked_from_count, 3);
    assert.deepEqual([...(found[0]?.details?.linked_from as string[])].sort(), [
      `${BASE}/a`,
      `${BASE}/b`,
      `${BASE}/c`,
    ]);
  });

  it('un 5xx NO es un enlace roto: eso lo reporta `server-error`', () => {
    // El caso que ensució la auditoría del 19/08: /contact falló UNA vez durante el
    // crawl y, al estar en el footer, salieron 270 críticos de enlace roto.
    const found = brokenLinks([
      page('/a', { linksTo: ['/caido'] }),
      page('/b', { linksTo: ['/caido'] }),
      page('/caido', { status: 503, linksTo: ['/a'] }),
    ]);

    assert.deepEqual(found, []);
  });

  it('varios destinos rotos son varios hallazgos, uno por cada uno', () => {
    const found = brokenLinks([
      page('/a', { linksTo: ['/roto-1', '/roto-2'] }),
      page('/roto-1', { status: 404 }),
      page('/roto-2', { status: 410 }),
    ]);

    assert.equal(found.length, 2);
    assert.deepEqual(found.map((f) => f.details?.status).sort(), [404, 410]);
  });

  it('un destino sano no genera nada', () => {
    assert.deepEqual(brokenLinks([page('/a', { linksTo: ['/b'] }), page('/b', { linksTo: ['/a'] })]), []);
  });
});
