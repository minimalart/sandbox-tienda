import type { CrawledPage } from '../crawler/types';
import type { EngineFinding } from './types';

/**
 * Páginas mínimas para que el SEO score signifique algo. Con una sola página
 * (típicamente la raíz, cuando el crawl no encontró por dónde seguir) no hay
 * arquitectura que medir y el promedio por página es ruido.
 */
export const MIN_PAGES_FOR_SCORE = 2;

/** Hosts que jamás son la URL pública de una tienda. */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);

/**
 * Chequeos de salud del CRAWL, no del sitio.
 *
 * Corren SIEMPRE, con independencia de los toggles de motores, porque son lo
 * único que distingue "el sitio no tiene problemas" de "no se pudo mirar el
 * sitio". Sin ellos una auditoría contra una tienda con la contraseña puesta
 * termina con 1 página y 0 hallazgos, y `computeSeoScore` —que arranca en 100 y
 * RESTA penalidades— publica un 100 perfecto sobre una pantalla de login.
 *
 * Son de severidad `critical` a propósito: no describen una oportunidad de
 * mejora, describen que el número de arriba no se puede usar.
 */
export function runCrawlHealthChecks(pages: CrawledPage[]): EngineFinding[] {
  const out: EngineFinding[] = [];
  const site = (type: string, details: Record<string, unknown>): void => {
    out.push({ engine: 'crawl', type, severity: 'critical', entity_type: 'site', details });
  };

  if (pages.length === 0) {
    site('empty-crawl', {});
    return out;
  }

  // Site gate: el crawler recibió la pantalla de contraseña en vez del sitio.
  //
  // Desde que `lib/gate-access.ts` firma la llave del gate, esto ya no significa
  // "la tienda tiene contraseña" —eso es normal y se cruza sin problema— sino que
  // la llave NO sirvió: la palabra cambió, el gate lo puso otro módulo, o la
  // auditoría corre contra un host donde la cookie no aplica. O sea que sigue
  // siendo exactamente el hallazgo que hay que emitir, con más información atrás.
  //
  // Se reporta una sola vez (es una condición del sitio, no de cada página) y corta
  // el resto: todo lo demás que se mida acá describe el gate, no la tienda.
  const gated = pages.filter((p) => p.is_gated);
  if (gated.length > 0) {
    site('site-gated', { url: gated[0]?.url ?? null, gated_pages: gated.length, pages_crawled: pages.length });
    return out;
  }

  if (pages.length < MIN_PAGES_FOR_SCORE) {
    // El caso típico: la raíz respondió, pero el sitemap no aportó URLs y el HTML
    // servido no trae enlaces `<a href>` que seguir (nav renderizada en cliente,
    // sitemap declarado en otro host, redirect a un origen distinto).
    site('crawl-dead-end', { url: pages[0]?.url ?? null, pages_crawled: pages.length });
  }

  // Canonical apuntando a un host local: no es una preferencia de canonicalización,
  // es la URL pública mal configurada en el storefront (`NEXT_PUBLIC_BASE_URL`), y
  // se lleva puestos también el sitemap y el `robots.txt`. Google indexa —o deja de
  // indexar— según ese valor, así que vale por sí solo aunque el crawl haya andado.
  for (const p of pages) {
    if (isLocalUrl(p.canonical_url) || isLocalUrl(p.canonical_header)) {
      out.push({
        engine: 'crawl',
        type: 'local-canonical',
        severity: 'critical',
        entity_type: 'page',
        page_url: p.url,
        details: { canonical: p.canonical_url ?? p.canonical_header },
      });
    }
  }

  return out;
}

/**
 * ¿El crawl da para calcular un score? Cuando no, el score se guarda en `null`
 * en vez de en 100: un score vacío tiene que verse vacío.
 */
export function isCrawlUsable(pages: CrawledPage[]): boolean {
  return pages.length >= MIN_PAGES_FOR_SCORE && !pages.some((p) => p.is_gated);
}

/** Motivo legible de por qué la auditoría no publica score. */
export function unscorableReason(pages: CrawledPage[], enginesRan: boolean): string | null {
  if (!enginesRan) {
    return 'No corrió ningún motor de análisis (Técnico y Arquitectura están apagados en Configuración), así que no hay hallazgos que puedan bajar el score. Prendelos y volvé a correr la auditoría.';
  }
  if (pages.length === 0) return 'El crawl no pudo leer ninguna página del storefront.';
  if (pages.some((p) => p.is_gated)) {
    return 'El storefront está detrás de la página de contraseña (site gate) y la llave que firmó la auditoría no la abrió: el crawler sólo ve la pantalla de acceso. Revisá que la contraseña de esa tienda siga siendo la configurada en Preferencias → Acceso.';
  }
  if (pages.length < MIN_PAGES_FOR_SCORE) {
    return `El crawl terminó con ${pages.length} página(s): no se descubrieron enlaces internos ni URLs de sitemap del mismo origen. Revisá el sitemap y la URL pública del storefront.`;
  }
  return null;
}

function isLocalUrl(value: string | null): boolean {
  if (!value) return false;
  try {
    return LOCAL_HOSTS.has(new URL(value).hostname);
  } catch {
    return false;
  }
}
