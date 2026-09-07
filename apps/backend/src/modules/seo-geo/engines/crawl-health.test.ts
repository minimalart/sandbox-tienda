import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { analyzeHtml } from '../crawler/page-analyzer';
import { isCrawlUsable, runCrawlHealthChecks, unscorableReason } from './crawl-health';
import type { CrawledPage } from '../crawler/types';

const BASE = 'https://shop.example.com';

/** HTML mínimo sano: título, h1, contenido y un enlace interno. */
const okHtml = (path: string, canonical = `${BASE}${path}`): string => `
<html><head>
  <title>Página ${path}</title>
  <link rel="canonical" href="${canonical}">
</head><body>
  <h1>Hola</h1>
  <p>${'palabra '.repeat(60)}</p>
  <a href="/otra">Otra</a>
</body></html>`;

/**
 * La pantalla del site gate tal como la sirve el storefront: 200, HTML válido,
 * su propio `noindex` y el testid que la identifica.
 */
const GATED_HTML = `
<html><head><title>Desde el sur</title></head><body>
  <section data-testid="site-gate">
    <meta content="noindex, nofollow" name="robots" />
    <p>Todavía no abrimos al público.</p>
  </section>
</body></html>`;

const page = (html: string, path: string): CrawledPage => ({
  ...analyzeHtml(html, `${BASE}${path}`, 200, 100),
  crawl_depth: 0,
  in_sitemap: false,
  page_type: null,
});

describe('runCrawlHealthChecks', () => {
  it('un crawl sano no emite hallazgos y es puntuable', () => {
    const pages = [page(okHtml('/'), '/'), page(okHtml('/otra'), '/otra')];
    assert.deepEqual(runCrawlHealthChecks(pages), []);
    assert.equal(isCrawlUsable(pages), true);
    assert.equal(unscorableReason(pages, true), null);
  });

  it('detecta el site gate y anula el score aunque la página responda 200', () => {
    const pages = [page(GATED_HTML, '/tienda/desde-el-sur')];
    const findings = runCrawlHealthChecks(pages);
    assert.equal(findings.length, 1);
    assert.equal(findings[0]?.type, 'site-gated');
    assert.equal(findings[0]?.severity, 'critical');
    assert.equal(isCrawlUsable(pages), false);
    assert.match(String(unscorableReason(pages, true)), /contraseña/);
  });

  it('reporta el crawl que se quedó en una sola página', () => {
    const pages = [page(okHtml('/'), '/')];
    const types = runCrawlHealthChecks(pages).map((f) => f.type);
    assert.deepEqual(types, ['crawl-dead-end']);
    assert.equal(isCrawlUsable(pages), false);
  });

  it('reporta el crawl vacío', () => {
    assert.deepEqual(runCrawlHealthChecks([]).map((f) => f.type), ['empty-crawl']);
    assert.equal(isCrawlUsable([]), false);
  });

  it('detecta canonicals a localhost (URL pública del storefront mal configurada)', () => {
    const pages = [
      page(okHtml('/', 'http://localhost:3000'), '/'),
      page(okHtml('/otra', 'http://localhost:3000'), '/otra'),
    ];
    const findings = runCrawlHealthChecks(pages);
    assert.equal(findings.length, 2);
    assert.equal(findings[0]?.type, 'local-canonical');
    assert.equal(findings[0]?.page_url, `${BASE}/`);
    // El crawl SÍ sirvió: el score se sigue publicando, con el hallazgo adentro.
    assert.equal(isCrawlUsable(pages), true);
  });
});

describe('unscorableReason', () => {
  it('sin motores prendidos, el motivo es la configuración y no el crawl', () => {
    const pages = [page(okHtml('/'), '/'), page(okHtml('/otra'), '/otra')];
    assert.match(String(unscorableReason(pages, false)), /Técnico y Arquitectura/);
  });
});
