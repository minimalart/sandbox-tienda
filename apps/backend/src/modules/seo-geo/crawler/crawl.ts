import { analyzeHtml } from './page-analyzer';
import { discover } from './discovery';
import { fetchWithTimeout, mapWithConcurrency } from './concurrency';
import { classifyPageType, isInSiteScope, normalizeUrl } from './url-utils';
import type { CrawledPage, FetchClassValue } from './types';
import type { CrawlConfig } from '../config';
import { getSeoGeoSettings } from '../settings';

export type CrawlProgress = (crawled: number, total: number) => void | Promise<void>;

/**
 * Pausa entre lotes del crawl (ms) para ceder el event loop al HTTP server.
 *
 * Función y no `const` de módulo: viene de `app-settings`, así que se resuelve
 * al empezar cada crawl y no una sola vez al importar el archivo. Guardar el
 * valor desde el admin tiene efecto en la auditoría siguiente, sin redeploy.
 */
const batchPauseMs = (): number => getSeoGeoSettings().batchPauseMs;

/**
 * Credenciales del crawl. Aparte de `CrawlConfig` A PROPÓSITO: la config se
 * CONGELA en la fila de la auditoría y se muestra entera en el admin, así que un
 * token de acceso ahí adentro quedaría guardado y visible. Esto se resuelve en
 * cada corrida y vive sólo en memoria.
 */
export type CrawlAuth = {
  /** Cookie ya armada (`_site_gate=<token>`) para pasar la página de contraseña. */
  cookie?: string | null;
};

export type CrawlOutput = {
  pages: CrawledPage[];
  base_url: string;
};

/**
 * Recorre el storefront desde `baseUrl` (PRD §6): descubre semillas (robots +
 * sitemap), hace BFS same-origin por profundidad respetando el presupuesto de
 * páginas y la concurrencia, y devuelve una página estructurada por URL. El
 * crawl es acotado y con timeout por request para no colgar (patrón del sitemap
 * del storefront).
 */
export async function crawlSite(
  baseUrl: string,
  crawl: CrawlConfig,
  onProgress?: CrawlProgress,
  auth?: CrawlAuth
): Promise<CrawlOutput> {
  // Se resuelve UNA vez por crawl, no por lote: el snapshot se revalida cada 30 s
  // y no queremos que una auditoría larga cambie de ritmo a la mitad.
  const pauseMs = batchPauseMs();

  const cookie = auth?.cookie ?? null;

  // La cookie va también al descubrimiento: `robots.txt` y `sitemap.xml` hoy quedan
  // FUERA del gate (el gate lo aplica el layout de `[countryCode]`), pero mandarla
  // no cuesta nada y deja de importar si mañana el gate se mueve al proxy.
  const { seeds, sitemapUrls, robots } = await discover(baseUrl, {
    userAgent: crawl.user_agent,
    timeoutMs: crawl.per_request_timeout_ms,
    respectRobots: crawl.respect_robots,
    useSitemap: crawl.use_sitemap,
    cookie,
  });

  const visited = new Set<string>();
  const pages: CrawledPage[] = [];
  // Frontera: mezcla la raíz/enlaces (crawl real) con las URLs del sitemap
  // (profundidad 0). Acotada al SITIO auditado, no al host: el sitemap es del host
  // entero, así que auditar una tienda secundaria arrancaba con 5.000 URLs de la
  // principal en la frontera.
  let frontier: Array<{ url: string; depth: number }> = seeds
    .map((u) => ({ url: u, depth: 0 }))
    .filter((s) => isInSiteScope(s.url, baseUrl));

  // Páginas ya tomadas por tipo, para la cuota de fichas. Se cuenta al RESERVAR la
  // URL (no al guardar la página) porque un lote de `concurrency` URLs se elige
  // entero antes de bajar ninguna: contar después dejaría pasar un lote de más.
  const takenByType = new Map<string, number>();

  while (frontier.length > 0 && pages.length < crawl.max_pages) {
    // Tomar un lote de URLs no visitadas dentro del presupuesto restante
    const batch: Array<{ url: string; depth: number }> = [];
    for (const item of frontier) {
      if (batch.length >= crawl.concurrency) break;
      if (pages.length + batch.length >= crawl.max_pages) break;
      if (visited.has(item.url)) continue;
      if (crawl.respect_robots && robots && robots.isDisallowed(item.url, crawl.user_agent) === true) {
        visited.add(item.url);
        continue;
      }
      // Cuota por tipo: hoy sólo acota fichas de producto. `visited` y no un skip a
      // secas, porque la URL sigue en la frontera y volvería a evaluarse en cada
      // vuelta del while con el mismo resultado.
      const type = classifyPageType(item.url, baseUrl);
      if (type === 'product' && (takenByType.get(type) ?? 0) >= crawl.max_product_pages) {
        visited.add(item.url);
        continue;
      }
      takenByType.set(type, (takenByType.get(type) ?? 0) + 1);
      visited.add(item.url);
      batch.push(item);
    }
    // Remover del frontier lo consumido/omitido
    frontier = frontier.filter((f) => !visited.has(f.url));

    if (batch.length === 0) continue;

    const results = await mapWithConcurrency(batch, crawl.concurrency, (item) =>
      fetchAndAnalyze(item.url, item.depth, crawl, cookie)
    );

    for (const page of results) {
      if (!page) continue;
      page.in_sitemap = sitemapUrls.has(page.url);
      page.page_type = classifyPageType(page.url, baseUrl);
      pages.push(page);

      // Encolar enlaces internos si hay profundidad disponible
      if (page.crawl_depth < crawl.max_depth) {
        for (const link of page.links) {
          if (!link.is_internal) continue;
          if (visited.has(link.target_url)) continue;
          // Alcance del SITIO, no del host: en una tienda secundaria los enlaces al
          // resto del host (la principal) son same-origin y arrastraban el crawl
          // entero fuera de la tienda auditada.
          if (!isInSiteScope(link.target_url, baseUrl)) continue;
          frontier.push({ url: link.target_url, depth: page.crawl_depth + 1 });
        }
      }
    }

    if (onProgress) await onProgress(pages.length, Math.min(crawl.max_pages, pages.length + frontier.length));

    // Respiro entre lotes: el parseo (Cheerio) es CPU sincrónico y este crawl
    // corre dentro del web service; sin esta pausa el event loop no atiende
    // HTTP/health checks y DO puede matar el contenedor (incidente 2026-07-23).
    if (frontier.length > 0 && pages.length < crawl.max_pages) {
      await new Promise((r) => setTimeout(r, pauseMs));
    }
  }

  return { pages, base_url: baseUrl };
}

async function fetchAndAnalyze(
  url: string,
  depth: number,
  crawl: CrawlConfig,
  cookie: string | null
): Promise<CrawledPage | null> {
  const started = Date.now();
  try {
    const res = await fetchWithTimeout(
      url,
      {
        headers: {
          'user-agent': crawl.user_agent,
          accept: 'text/html',
          ...(cookie ? { cookie } : {}),
        },
        redirect: 'follow',
      },
      crawl.per_request_timeout_ms
    );
    const elapsed = Date.now() - started;
    const contentType = res.headers.get('content-type');
    const finalUrl = normalizeUrl(res.url || url) || url;

    // No-HTML: registrar snapshot mínimo con su status (para links rotos, etc.)
    if (contentType && !contentType.includes('text/html')) {
      return minimalPage(finalUrl, res.status, elapsed, classifyFetch(res.status), depth, contentType);
    }

    const html = await res.text();
    const analysis = analyzeHtml(html, finalUrl, res.status, elapsed, {
      canonical: parseLinkHeaderCanonical(res.headers.get('link')),
      xRobotsTag: res.headers.get('x-robots-tag'),
      contentType,
    });
    analysis.fetch_class = classifyFetch(res.status);
    return { ...analysis, crawl_depth: depth, in_sitemap: false, page_type: null };
  } catch {
    // Timeout / red / abort
    return minimalPage(url, null, Date.now() - started, 'error', depth, null);
  }
}

function classifyFetch(status: number): FetchClassValue {
  if (status === 403 || status === 429) return 'blocked';
  if (status >= 200 && status < 400) return 'ok';
  return 'error';
}

function minimalPage(
  url: string,
  status: number | null,
  elapsed: number,
  fetchClass: FetchClassValue,
  depth: number,
  contentType: string | null
): CrawledPage {
  return {
    url,
    status_code: status,
    fetch_class: fetchClass,
    response_time_ms: elapsed,
    content_type: contentType,
    canonical_url: null,
    canonical_header: null,
    robots_meta: null,
    x_robots_tag: null,
    is_indexable: false,
    title: null,
    meta_description: null,
    og_title: null,
    og_description: null,
    og_image: null,
    h1_count: 0,
    h2_count: 0,
    h3_count: 0,
    h4_count: 0,
    h5_count: 0,
    h6_count: 0,
    heading_order: [],
    word_count: 0,
    content_hash: null,
    images_total: 0,
    images_missing_alt: 0,
    internal_link_count: 0,
    external_link_count: 0,
    has_structured_data: false,
    structured_data_types: [],
    hreflang_tags: [],
    links: [],
    is_gated: false,
    crawl_depth: depth,
    in_sitemap: false,
    page_type: null,
  };
}

/** Extrae rel="canonical" de un header Link (RFC 8288), si está. */
function parseLinkHeaderCanonical(header: string | null): string | null {
  if (!header) return null;
  const m = header.match(/<([^>]+)>\s*;\s*rel\s*=\s*"?canonical"?/i);
  return m && m[1] ? m[1] : null;
}
