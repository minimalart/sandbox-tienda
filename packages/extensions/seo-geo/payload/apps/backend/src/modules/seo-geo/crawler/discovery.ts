import robotsParser from 'robots-parser';
import { XMLParser } from 'fast-xml-parser';
import { fetchWithTimeout } from './concurrency';
import { normalizeUrl } from './url-utils';

export type DiscoveryResult = {
  /** URLs semilla (raíz + entradas del sitemap) para arrancar el crawl. */
  seeds: string[];
  /** Set de URLs presentes en el sitemap (para el flag in_sitemap). */
  sitemapUrls: Set<string>;
  /** Instancia de robots (o null si no hay/robots inaccesible = todo permitido). */
  robots: ReturnType<typeof robotsParser> | null;
};

const SITEMAP_MAX_DEPTH = 3;
const SITEMAP_MAX_DOCS = 50;

/**
 * Descubre el punto de partida del crawl (PRD §6): lee robots.txt (para respetar
 * disallow y obtener sitemaps declarados) y expande los sitemaps recursivamente.
 * Portado del `discovery.ts` de open-seo (MIT): robots-parser + fast-xml-parser
 * con índice de sitemaps recursivo acotado por profundidad y cantidad.
 */
export async function discover(
  baseUrl: string,
  opts: {
    userAgent: string;
    timeoutMs: number;
    respectRobots: boolean;
    useSitemap: boolean;
    /** Cookie del site gate, si la tienda auditada tiene contraseña. */
    cookie?: string | null;
  }
): Promise<DiscoveryResult> {
  const origin = new URL(baseUrl).origin;
  const seeds = new Set<string>();
  const root = normalizeUrl(baseUrl);
  if (root) seeds.add(root);

  let robots: ReturnType<typeof robotsParser> | null = null;
  const declaredSitemaps: string[] = [];

  if (opts.respectRobots) {
    const robotsUrl = `${origin}/robots.txt`;
    try {
      const res = await fetchWithTimeout(robotsUrl, { headers: headersOf(opts) }, opts.timeoutMs);
      if (res.ok) {
        const body = await res.text();
        robots = robotsParser(robotsUrl, body);
        for (const sm of robots.getSitemaps()) declaredSitemaps.push(sm);
      }
    } catch {
      // robots inaccesible = se asume todo permitido
    }
  }

  const sitemapUrls = new Set<string>();
  if (opts.useSitemap) {
    const toVisit = declaredSitemaps.length ? declaredSitemaps : [`${origin}/sitemap.xml`];
    await expandSitemaps(toVisit, opts, sitemapUrls);
    for (const u of sitemapUrls) seeds.add(u);
  }

  return { seeds: [...seeds], sitemapUrls, robots };
}

async function expandSitemaps(
  sitemaps: string[],
  opts: { userAgent: string; timeoutMs: number; cookie?: string | null },
  out: Set<string>,
  depth = 0,
  seen = new Set<string>()
): Promise<void> {
  if (depth > SITEMAP_MAX_DEPTH || seen.size > SITEMAP_MAX_DOCS) return;
  const parser = new XMLParser({ ignoreAttributes: false });

  for (const sm of sitemaps) {
    if (seen.has(sm) || seen.size > SITEMAP_MAX_DOCS) continue;
    seen.add(sm);
    try {
      const res = await fetchWithTimeout(sm, { headers: headersOf(opts) }, opts.timeoutMs);
      if (!res.ok) continue;
      const xml = await res.text();
      const doc = parser.parse(xml);

      // Índice de sitemaps → recursión
      const indexEntries = toArray(doc?.sitemapindex?.sitemap);
      const childSitemaps = indexEntries.map((e) => (e?.loc ? String(e.loc) : '')).filter(Boolean);
      if (childSitemaps.length) {
        await expandSitemaps(childSitemaps, opts, out, depth + 1, seen);
      }

      // urlset → URLs de contenido
      const urlEntries = toArray(doc?.urlset?.url);
      for (const e of urlEntries) {
        const loc = e?.loc ? String(e.loc) : '';
        const n = normalizeUrl(loc);
        if (n) out.add(n);
      }
    } catch {
      // sitemap inaccesible o inválido: se ignora
    }
  }
}

/** User-agent del bot + la cookie del gate cuando hay. */
function headersOf(opts: { userAgent: string; cookie?: string | null }): Record<string, string> {
  return { 'user-agent': opts.userAgent, ...(opts.cookie ? { cookie: opts.cookie } : {}) };
}

function toArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}
