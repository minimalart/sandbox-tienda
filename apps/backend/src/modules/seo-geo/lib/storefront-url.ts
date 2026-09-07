/**
 * Resuelve la URL pública del storefront desde el backend en runtime, con la
 * misma lógica que `GET /admin/store-config/storefront-url`: STOREFRONT_URL
 * explícita → primer origin público de STORE_CORS (prefiere https) → fallback
 * local. Es lo que el crawler recorre cuando la auditoría no fija `base_url`.
 */
const isLocal = (u: string): boolean => /\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$)/i.test(u);
const isNonStorefront = (u: string): boolean => /medusajs\.com/i.test(u);

export function resolveStorefrontUrl(): string {
  const origins = (process.env.STORE_CORS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const publicOrigins = origins.filter((o) => !isLocal(o) && !isNonStorefront(o));
  const fromCors = publicOrigins.find((o) => o.startsWith('https://')) || publicOrigins[0] || origins[0];
  const raw = process.env.STOREFRONT_URL?.trim() || process.env.NEXT_PUBLIC_BASE_URL?.trim() || fromCors || 'http://localhost:3000';
  return raw.replace(/\/+$/, '');
}

/**
 * La URL de UNA tienda, que es lo que hay que crawlear cuando la auditoría tiene
 * canal. `resolveStorefrontUrl()` a secas devuelve la raíz de la instancia: usarla
 * para las N tiendas haría N crawls IDÉNTICOS del storefront de la principal y cada
 * uno se guardaría con el canal de otra tienda. O sea, N auditorías distintas con las
 * mismas páginas adentro — el peor resultado posible, porque parece que funcionó.
 *
 * La ruta pública NO es configurable (el certificado es un wildcard), así que se
 * deriva del slug: `/tienda/<slug>`, y la raíz para la principal. Es la MISMA
 * convención que `GET /admin/store-config/storefront-url` y que
 * `modules/store-config/site-gate.ts`; se repite el literal en vez de importarlo
 * porque los tres viven en módulos distintos y ninguno depende de los otros dos.
 */
export function resolveSiteStorefrontUrl(site: { slug: string; is_main: boolean }): string {
  const base = resolveStorefrontUrl();
  return site.is_main ? base : `${base}/tienda/${site.slug}`;
}
