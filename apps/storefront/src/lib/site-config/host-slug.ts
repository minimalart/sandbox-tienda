import { resolveHostSlug } from "./resolve-site";

/**
 * Slug del sitio a partir de los HEADERS de la request, para los lugares que no
 * reciben `x-site-slug`.
 *
 * Existe porque el matcher del proxy excluye `sitemap.xml`, `robots.txt`, `llms.txt`,
 * `opengraph-image` y `twitter-image`: esas rutas tienen que leer el `Host` ellas
 * mismas o servirían el contenido del sitio principal en el host de cualquier tienda.
 *
 * Módulo aparte, y NO `server-only`: recibe un `Headers` en vez de llamar a
 * `headers()`, así queda testeable sin Next y `active-tenant.ts` lo puede traer con
 * import dinámico sólo cuando multi-host está activo.
 */

/**
 * DECISIÓN DE SEGURIDAD, la misma de `resolve-site.ts`: `x-forwarded-host` SÓLO fuera
 * de producción.
 *
 * Leerlo es lo que permite testear la resolución por host en un preview deploy — las
 * preview URLs multi-tenant de Vercel son Enterprise-only, así que forjar el header es
 * la única vía. **Pero también permitiría SPOOFEAR UN TENANT en producción** si el
 * proveedor no sobreescribe el header que manda el cliente, y no se asume que lo haga.
 *
 * Consecuencia asumida y explícita: la resolución por host en producción sólo se puede
 * testear en producción.
 */
export function readHostFromHeaders(h: Headers): string | null {
  if (process.env.VERCEL_ENV !== "production") {
    const forwarded = h.get("x-forwarded-host");
    if (forwarded) return forwarded;
  }
  return h.get("host");
}

export function readHostSlugFromHeaders(h: Headers): string | null {
  return resolveHostSlug(readHostFromHeaders(h));
}
