import type { CatalogadorConfig } from '../config';
import { getCatalogadorSettings } from '../settings';
import { safeFetchText, SsrfError } from './ssrf';
import { isValidBarcode } from './barcode';

/**
 * Enriquecimiento externo (PRD §13 / §22.4): consulta por barcode y scraping
 * controlado. Los datos encontrados NUNCA se aplican directo: sólo se devuelven
 * como CONTEXTO para que la IA genere una propuesta revisable (PRD §13.2).
 *
 * Los secretos (API keys) NO viven en `CatalogadorConfig`: se resuelven por
 * `app-settings` (fila cifrada en DB > env > default) vía
 * `getCatalogadorSettings()`, que es sincrónico a propósito — estas funciones ya
 * están dentro de un fetch con AbortController y no reciben el contenedor.
 */
export type ExternalContext = {
  summary: string | null;
  sources: Array<{ type: 'barcode' | 'scraping'; ref: string; ok: boolean; note?: string }>;
  used_barcode: boolean;
  used_scraping: boolean;
  /** Cuántas páginas web devolvieron contenido útil (para ponderar confianza). */
  page_hits: number;
  /**
   * URLs de imágenes REALES encontradas en la web (Tavily `include_images`). Se
   * usan como base/referencia para imágenes cuando el producto no tiene ninguna
   * foto propia — nunca se alucina desde el título.
   */
  image_candidates: string[];
  warnings: string[];
};

type ScrapeResult = { snippets: string[]; sources: ExternalContext['sources']; warnings: string[]; images: string[] };

/** Sanea HTML a texto plano acotado antes de pasarlo al LLM (evita inyección). */
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 2000);
}

/**
 * Extrae URLs de imagen de una respuesta JSON arbitraria de un proveedor de
 * barcode (recorrido recursivo acotado). Acepta strings http(s) cuyo path
 * termina en extensión de imagen, o bajo claves que sugieren imagen
 * (`image`, `images`, `image_url`, `thumbnail`, `photo`, `picture`, …).
 * Exportada para tests.
 */
export function extractImageUrls(value: unknown, limit = 6): string[] {
  const found: string[] = [];
  const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif)(\?|#|$)/i;
  const IMAGE_KEY = /(image|img|photo|picture|thumbnail)/i;
  let visited = 0;
  const walk = (node: unknown, keyHint: boolean, depth: number): void => {
    if (found.length >= limit || depth > 6 || visited > 500) return;
    visited++;
    if (typeof node === 'string') {
      const url = node.trim();
      if (!/^https?:\/\//i.test(url)) return;
      if ((keyHint || IMAGE_EXT.test(url)) && !found.includes(url)) found.push(url);
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) walk(item, keyHint, depth + 1);
      return;
    }
    if (node && typeof node === 'object') {
      for (const [key, val] of Object.entries(node as Record<string, unknown>)) {
        walk(val, IMAGE_KEY.test(key), depth + 1);
      }
    }
  };
  walk(value, false, 0);
  return found;
}

/**
 * Consulta por barcode contra un proveedor genérico configurado en los ajustes
 * de la extensión (`CATALOGADOR_BARCODE_API_URL` con `{code}` +
 * `CATALOGADOR_BARCODE_API_KEY`).
 * Sin garantía de match (PRD §5). Devuelve un resumen textual (más las URLs de
 * imagen que traiga la respuesta, para usarlas como referencia) o null.
 */
async function lookupBarcode(
  barcode: string,
  timeoutMs: number
): Promise<{ text: string; ok: boolean; images: string[] } | null> {
  const { barcodeApiUrl: template, barcodeApiKey: apiKey } = getCatalogadorSettings();
  if (!template) return null;
  const url = template.replace('{code}', encodeURIComponent(barcode));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
    });
    if (!res.ok) return { text: '', ok: false, images: [] };
    const json = (await res.json().catch(() => null)) as unknown;
    if (!json) return { text: '', ok: false, images: [] };
    // Resumen genérico: aplanamos campos de texto útiles que suelen venir.
    const text = JSON.stringify(json).slice(0, 1500);
    return { text, ok: true, images: extractImageUrls(json) };
  } catch {
    return { text: '', ok: false, images: [] };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Scraping/búsqueda web controlada. La HERRAMIENTA la define
 * `config.external.scraping_provider`:
 *  - 'tavily' (recomendado): API de búsqueda de Tavily, que busca y devuelve el
 *    contenido ya extraído; restringe a los dominios permitidos con
 *    `include_domains`. Requiere `CATALOGADOR_TAVILY_API_KEY`.
 *  - 'http': fetch directo endurecido anti-SSRF de un template de búsqueda por
 *    dominio (`CATALOGADOR_SCRAPE_SEARCH_TEMPLATE` con `{domain}`/`{query}`).
 */
async function scrapeControlled(query: string, config: CatalogadorConfig): Promise<ScrapeResult> {
  const ext = config.external;
  if (ext.scraping_provider === 'tavily') {
    return scrapeTavily(query, config);
  }
  return scrapeHttp(query, config);
}

/** Tavily Search API — busca y devuelve contenido; respeta include_domains. */
async function scrapeTavily(query: string, config: CatalogadorConfig): Promise<ScrapeResult> {
  const ext = config.external;
  const sources: ExternalContext['sources'] = [];
  const warnings: string[] = [];
  const snippets: string[] = [];
  const images: string[] = [];

  const { tavilyApiKey: apiKey } = getCatalogadorSettings();
  if (!apiKey) {
    warnings.push('Scraping (tavily) habilitado pero falta CATALOGADOR_TAVILY_API_KEY.');
    return { snippets, sources, warnings, images };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ext.timeout_ms);
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: 'basic',
        max_results: Math.max(1, ext.max_pages_per_product),
        include_answer: false,
        include_images: true,
        ...(ext.allowed_domains.length ? { include_domains: ext.allowed_domains } : {}),
        ...(ext.blocked_domains.length ? { exclude_domains: ext.blocked_domains } : {}),
      }),
    });
    if (!res.ok) {
      warnings.push(`Tavily respondió ${res.status}`);
      sources.push({ type: 'scraping', ref: 'tavily', ok: false, note: `HTTP ${res.status}` });
      return { snippets, sources, warnings, images };
    }
    const data = (await res.json().catch(() => null)) as {
      results?: Array<{ title?: string; url?: string; content?: string }>;
      // Con include_images Tavily devuelve strings o { url, description }.
      images?: Array<string | { url?: string }>;
    } | null;
    for (const r of data?.results ?? []) {
      const text = htmlToText(r.content ?? '');
      if (text) snippets.push(`[${r.url ?? 'tavily'}] ${text}`);
      sources.push({ type: 'scraping', ref: r.url ?? 'tavily', ok: Boolean(text) });
    }
    for (const img of data?.images ?? []) {
      const url = typeof img === 'string' ? img : img?.url;
      if (url && /^https?:\/\//i.test(url)) images.push(url);
    }
  } catch (e) {
    warnings.push(`Tavily: ${e instanceof Error ? e.message : 'fetch falló'}`);
    sources.push({ type: 'scraping', ref: 'tavily', ok: false });
  } finally {
    clearTimeout(timer);
  }
  return { snippets, sources, warnings, images };
}

/** Fetch directo endurecido anti-SSRF (provider 'http'). */
async function scrapeHttp(query: string, config: CatalogadorConfig): Promise<ScrapeResult> {
  const ext = config.external;
  const sources: ExternalContext['sources'] = [];
  const warnings: string[] = [];
  const snippets: string[] = [];
  const images: string[] = [];

  const { scrapeSearchTemplate: template } = getCatalogadorSettings();
  if (!template || ext.allowed_domains.length === 0) {
    if (!template) warnings.push('Scraping (http) sin CATALOGADOR_SCRAPE_SEARCH_TEMPLATE.');
    return { snippets, sources, warnings, images };
  }

  const domains = ext.allowed_domains.slice(0, ext.max_pages_per_product);
  for (const domain of domains) {
    const target = template
      .replace('{domain}', encodeURIComponent(domain))
      .replace('{query}', encodeURIComponent(query));
    try {
      const html = await safeFetchText(target, {
        allowedDomains: ext.allowed_domains,
        blockedDomains: ext.blocked_domains,
        timeoutMs: ext.timeout_ms,
        userAgent: ext.user_agent,
      });
      const text = htmlToText(html);
      if (text) snippets.push(`[${domain}] ${text}`);
      sources.push({ type: 'scraping', ref: domain, ok: Boolean(text) });
    } catch (e) {
      const note = e instanceof SsrfError ? e.message : 'fetch falló';
      warnings.push(`Scraping ${domain}: ${note}`);
      sources.push({ type: 'scraping', ref: domain, ok: false, note });
    }
  }
  return { snippets, sources, warnings, images };
}

/** Orquesta barcode + scraping según config; devuelve contexto para la IA. */
export async function gatherExternalContext(opts: {
  config: CatalogadorConfig;
  barcode: string | null;
  title: string;
}): Promise<ExternalContext | null> {
  const { config, title } = opts;
  const ext = config.external;
  if (!ext.barcode_enabled && !ext.scraping_enabled) return null;

  const sources: ExternalContext['sources'] = [];
  const warnings: string[] = [];
  const parts: string[] = [];
  const images: string[] = [];
  let usedBarcode = false;
  let usedScraping = false;
  let pageHits = 0;

  // Validar el código antes de gastar llamadas: un SKU o código interno (no
  // EAN/UPC/GTIN con dígito de control válido) se trata como "sin barcode".
  const barcode = opts.barcode && isValidBarcode(opts.barcode) ? opts.barcode : null;
  if (opts.barcode && !barcode) {
    warnings.push(`El código "${opts.barcode}" no es un barcode válido (EAN/UPC/GTIN); se ignora.`);
  }

  if (ext.barcode_enabled && barcode) {
    const r = await lookupBarcode(barcode, ext.timeout_ms);
    if (r) {
      sources.push({ type: 'barcode', ref: barcode, ok: r.ok });
      if (r.ok && r.text) {
        parts.push(`Datos por barcode (${barcode}): ${r.text}`);
        usedBarcode = true;
      }
      // Las imágenes del proveedor de barcode van PRIMERO: son las de mayor
      // probabilidad de corresponder exactamente al producto.
      for (const img of r.images) if (!images.includes(img)) images.push(img);
    }
  }

  if (ext.scraping_enabled) {
    // Dos intentos: (1) el barcode exacto entre comillas — la búsqueda más
    // específica; (2) sólo si no hubo resultados, barcode + título. Sin barcode
    // válido se busca por título como antes.
    const attempts = barcode ? [`"${barcode}"`, `"${barcode}" ${title}`] : [title];
    for (const query of attempts) {
      const s = await scrapeControlled(query, config);
      sources.push(...s.sources);
      warnings.push(...s.warnings);
      for (const img of s.images) if (!images.includes(img)) images.push(img);
      if (s.snippets.length) {
        parts.push(...s.snippets);
        pageHits += s.snippets.length;
        usedScraping = true;
        break; // el primer intento con resultados alcanza
      }
    }
  }

  return {
    summary: parts.length ? parts.join('\n') : null,
    sources,
    used_barcode: usedBarcode,
    used_scraping: usedScraping,
    page_hits: pageHits,
    image_candidates: images.slice(0, 6),
    warnings,
  };
}
