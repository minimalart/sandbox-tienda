import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { analyzeHtml, computeIndexable } from './page-analyzer';
import { runTechnicalEngine } from '../engines/technical';
import { runArchitectureEngine } from '../engines/architecture';
import { SEO_GEO_DEFAULTS } from '../config';
import type { CrawledPage } from './types';

const BASE = 'https://shop.example.com';

const RICH_HTML = `
<html><head>
  <title>Mate imperial de cuero premium 250ml</title>
  <meta name="description" content="Mate imperial de cuero, capacidad 250ml, incluye bombilla. Ideal para el mate diario y regalos.">
  <link rel="canonical" href="${BASE}/products/mate-imperial">
  <meta property="og:title" content="Mate imperial">
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Mate imperial"}</script>
</head><body>
  <h1>Mate imperial de cuero</h1>
  <h2>Características</h2>
  <p>${'palabra '.repeat(200)}</p>
  <img src="/a.jpg" alt="mate"/>
  <img src="/b.jpg"/>
  <a href="/products/otro">Otro producto</a>
  <a href="https://externo.com" rel="nofollow">Externo</a>
</body></html>`;

const POOR_HTML = `
<html><head>
  <title>x</title>
  <meta name="robots" content="noindex">
</head><body>
  <h1>uno</h1><h1>dos</h1>
  <h2>a</h2><h4>salto</h4>
  <p>corto</p>
</body></html>`;

describe('analyzeHtml', () => {
  it('extrae metadatos, headings, imágenes, enlaces y JSON-LD', () => {
    const a = analyzeHtml(RICH_HTML, `${BASE}/products/mate-imperial`, 200, 120);
    assert.equal(a.title, 'Mate imperial de cuero premium 250ml');
    assert.ok(a.meta_description && a.meta_description.length > 70);
    assert.equal(a.canonical_url, `${BASE}/products/mate-imperial`);
    assert.equal(a.h1_count, 1);
    assert.equal(a.h2_count, 1);
    assert.equal(a.images_total, 2);
    assert.equal(a.images_missing_alt, 1);
    assert.equal(a.internal_link_count, 1);
    assert.equal(a.external_link_count, 1);
    assert.equal(a.has_structured_data, true);
    assert.deepEqual(a.structured_data_types, ['Product']);
    assert.ok(a.word_count > 150);
    assert.equal(a.is_indexable, true);
    const external = a.links.find((l) => !l.is_internal);
    assert.equal(external?.is_nofollow, true);
  });

  it('sin `Link: rel=canonical` en la respuesta, canonical_header queda en null', () => {
    // `normalizeUrl(headers?.canonical || "", url)` devolvía la PROPIA URL, así que el
    // motor técnico comparaba el canonical del HTML contra un header inventado y
    // publicaba `canonical-conflict` sobre cualquier página canonicalizada a otra.
    const sinHeader = analyzeHtml(RICH_HTML, `${BASE}/products/mate-imperial`, 200, 120);
    assert.equal(sinHeader.canonical_header, null);

    const conHeader = analyzeHtml(RICH_HTML, `${BASE}/products/mate-imperial`, 200, 120, {
      canonical: `${BASE}/otra`,
    });
    assert.equal(conHeader.canonical_header, `${BASE}/otra`);
  });

  it('detecta noindex via meta robots', () => {
    const a = analyzeHtml(POOR_HTML, `${BASE}/x`, 200, 50);
    assert.equal(a.is_indexable, false);
  });
});

describe('computeIndexable', () => {
  it('no indexable si no es 2xx o hay noindex', () => {
    assert.equal(computeIndexable(200, null, null), true);
    assert.equal(computeIndexable(404, null, null), false);
    assert.equal(computeIndexable(200, 'noindex,follow', null), false);
    assert.equal(computeIndexable(200, null, 'noindex'), false);
  });
});

function toCrawled(a: ReturnType<typeof analyzeHtml>, extra?: Partial<CrawledPage>): CrawledPage {
  return { ...a, crawl_depth: 0, in_sitemap: false, page_type: null, ...extra };
}

describe('runTechnicalEngine', () => {
  it('no marca problemas críticos en una página rica', () => {
    const page = toCrawled(analyzeHtml(RICH_HTML, `${BASE}/products/mate-imperial`, 200, 120));
    const findings = runTechnicalEngine([page], SEO_GEO_DEFAULTS.technical);
    const critical = findings.filter((f) => f.severity === 'critical');
    assert.equal(critical.length, 0);
    // imagen sin alt debe salir como warning
    assert.ok(findings.some((f) => f.type === 'images-missing-alt'));
  });

  it('marca title corto, noindex, multiple-h1 y heading-skip en una página pobre', () => {
    const page = toCrawled(analyzeHtml(POOR_HTML, `${BASE}/x`, 200, 50));
    const types = new Set(runTechnicalEngine([page], SEO_GEO_DEFAULTS.technical).map((f) => f.type));
    assert.ok(types.has('title-too-short'));
    assert.ok(types.has('missing-meta-description'));
    assert.ok(types.has('noindex-page'));
    assert.ok(types.has('multiple-h1'));
    assert.ok(types.has('heading-order-skip'));
  });
});

describe('runArchitectureEngine', () => {
  it('detecta títulos duplicados y páginas huérfanas', () => {
    const p1 = toCrawled(analyzeHtml(`<html><head><title>Igual</title><meta name="description" content="d"></head><body><h1>a</h1><a href="/b">b</a></body></html>`, `${BASE}/a`, 200, 30));
    const p2 = toCrawled(analyzeHtml(`<html><head><title>Igual</title><meta name="description" content="d"></head><body><h1>b</h1></body></html>`, `${BASE}/b`, 200, 30));
    // p3 es indexable pero nadie la enlaza => huérfana
    const p3 = toCrawled(analyzeHtml(`<html><head><title>Sola</title><meta name="description" content="d"></head><body><h1>c</h1></body></html>`, `${BASE}/c`, 200, 30));
    const findings = runArchitectureEngine([p1, p2, p3]);
    assert.ok(findings.some((f) => f.type === 'duplicate-title'));
    assert.ok(findings.some((f) => f.type === 'orphan-page' && f.page_url === `${BASE}/c`));
  });
});
