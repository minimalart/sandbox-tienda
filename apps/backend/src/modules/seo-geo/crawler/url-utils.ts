/** Utilidades de URL para el crawler (normalización + same-origin). */

/** Normaliza una URL para dedupe: sin fragmento, sin trailing slash (salvo raíz),
 * host en minúsculas, sin parámetros de tracking comunes. Devuelve null si no es
 * http(s) o no parsea. */
export function normalizeUrl(raw: string, base?: string): string | null {
  let u: URL;
  try {
    u = base ? new URL(raw, base) : new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;

  u.hash = '';
  u.hostname = u.hostname.toLowerCase();

  // Quitar parámetros de tracking que no cambian el contenido
  const drop = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid'];
  for (const p of drop) u.searchParams.delete(p);

  let out = u.toString();
  // Sin trailing slash salvo la raíz
  if (u.pathname !== '/' && out.endsWith('/')) out = out.slice(0, -1);
  return out;
}

/** ¿Dos URLs comparten origin (protocolo+host+puerto)? */
export function isSameOrigin(a: string, b: string): boolean {
  try {
    const ua = new URL(a);
    const ub = new URL(b);
    return ua.origin === ub.origin;
  } catch {
    return false;
  }
}

/**
 * Segmentos de path de una URL, sin el segmento de país (`/ar/...`).
 *
 * El storefront sirve la misma tienda con y sin ese prefijo, así que compararlo
 * crudo haría que `/ar/tienda/norte` y `/tienda/norte` se lean como dos sitios.
 */
export function pathSegments(url: string): string[] {
  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    return [];
  }
  const seg = path.split('/').filter(Boolean).map((s) => decodeURIComponent(s));
  return seg.length && /^[a-z]{2}$/.test(seg[0] ?? '') ? seg.slice(1) : seg;
}

/**
 * ¿La URL pertenece al SITIO auditado, y no sólo a su host?
 *
 * `isSameOrigin` no alcanza: una tienda secundaria vive en `/tienda/<slug>` del
 * MISMO host que la principal, así que un crawl acotado por origin arranca en
 * `/tienda/norte` y termina recorriendo la tienda principal entera. La auditoría
 * se guarda igual, con el canal de Norte y las páginas de la principal adentro —
 * el peor resultado posible, porque parece que funcionó (lo mismo que
 * `resolveSiteStorefrontUrl` evita del lado de la URL base).
 *
 * La principal es el caso espejo: es TODO el host MENOS `/tienda/*`, porque cada
 * tienda secundaria tiene su propia auditoría y sus páginas no son suyas.
 */
export function isInSiteScope(url: string, baseUrl: string): boolean {
  if (!isSameOrigin(url, baseUrl)) return false;
  const base = pathSegments(baseUrl);
  const target = pathSegments(url);
  if (base.length === 0) return target[0] !== 'tienda';
  return base.every((s, i) => target[i] === s);
}

/** ¿Un href de <a> es crawleable? (descarta mailto/tel/js/fragmentos puros). */
export function isCrawlableHref(href: string): boolean {
  const h = href.trim();
  if (!h || h.startsWith('#')) return false;
  const lower = h.toLowerCase();
  return !(
    lower.startsWith('mailto:') ||
    lower.startsWith('tel:') ||
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('sms:')
  );
}

/**
 * Clasifica el tipo de página por su path (heurística storefront Next). Sirve
 * para agrupar hallazgos, para el presupuesto por tipo del crawler y para que el
 * motor de catálogo/GEO resuelva entidades.
 *
 * `baseUrl` es la raíz del sitio auditado y se descuenta antes de clasificar: sin
 * eso, TODA página de una tienda secundaria cae en 'other' —el primer segmento es
 * `tienda`— y ni el agrupado ni la cuota por tipo distinguen una ficha de la home.
 */
export function classifyPageType(url: string, baseUrl?: string): string {
  try {
    new URL(url);
  } catch {
    return 'other';
  }
  const seg = pathSegments(url);
  const base = baseUrl ? pathSegments(baseUrl) : [];
  const rest = base.every((s, i) => seg[i] === s) ? seg.slice(base.length) : seg;
  const head = rest[0];
  if (!head) return 'home';
  const map: Record<string, string> = {
    products: 'product',
    categories: 'category',
    collections: 'collection',
    blog: 'blog',
    store: 'store',
    l: 'landing',
    demo: 'demo',
    sucursales: 'cms',
    about: 'cms',
    contact: 'cms',
    catalogo: 'cms',
  };
  return map[head] ?? 'other';
}

/** Extrae el handle de producto de una URL /products/:handle (o null). */
export function productHandleFromUrl(url: string): string | null {
  try {
    const seg = new URL(url).pathname.split('/').filter(Boolean);
    const idx = seg.indexOf('products');
    const handle = idx >= 0 ? seg[idx + 1] : undefined;
    return handle ? decodeURIComponent(handle) : null;
  } catch {
    return null;
  }
}
