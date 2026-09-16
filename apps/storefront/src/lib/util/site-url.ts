import { isSitesHubHost, sitesHubOrigin, publicSiteUrl, normalizeSiteSuffix } from "@lib/site-config/site-hosts";
import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { SITE_PATH_SEGMENT, normalizeHost } from "@lib/site-config/resolve-site";
import { isLoopbackOrigin, preferPublicOrigin } from "./canonical-base";
import { getBaseURL } from "./env";

/**
 * Origen (esquema + host) de la request ACTUAL, para canonicals y JSON-LD.
 *
 * `getBaseURL()` (`lib/util/env.ts`) es una constante de build —
 * `NEXT_PUBLIC_BASE_URL` — sin ninguna noción de request. Se queda como está y sigue
 * siendo correcta para el sitio principal, pero con varias tiendas alcanzables en
 * hosts distintos deja de servir para los canonicals: cada PDP de cada tienda emitía
 * un canonical apuntando al host PRINCIPAL, donde ese producto puede no existir.
 *
 * Eso no es una feature nueva: es un BUG VIVO del esquema de URLs actual. Hoy el
 * canonical de `…/tienda/moda/products/x` ya apunta a `…/products/x`.
 *
 * ⚠ TODO ACÁ ES NO-OP MIENTRAS NO HAYA MULTI-HOST. Sin `NEXT_PUBLIC_SITE_HOST_SUFFIX`
 * seteado, `getCanonicalOrigin()` devuelve exactamente `getBaseURL()`. Eso es lo que
 * permite mergear el SEO ANTES de prender los subdominios y activarlos después con
 * una variable de entorno, sin coordinar dos deploys no atómicos.
 */

const stripTrailingSlash = (url: string): string => url.replace(/\/+$/, "");

/**
 * Host de la request, leído de los headers.
 *
 * DECISIÓN DE SEGURIDAD, la misma que en `resolve-site.ts`: `x-forwarded-host` sólo
 * fuera de producción. Leerlo es lo que permite testear multi-host en un preview
 * (las preview URLs multi-tenant de Vercel son Enterprise-only), pero también
 * permitiría SPOOFEAR un tenant en producción si el proveedor no sobreescribe el
 * header del cliente. No se asume que lo haga.
 */
export const getRequestHost = cache(async (): Promise<string | null> => {
  try {
    const h = await headers();
    if (process.env.VERCEL_ENV !== "production") {
      const forwarded = h.get("x-forwarded-host");
      if (forwarded) return normalizeHost(forwarded);
    }
    return normalizeHost(h.get("host"));
  } catch {
    return null;
  }
});

/**
 * Origen de la request tal como llegó. Útil para links que tienen que quedarse en el
 * host que el usuario está usando (no necesariamente el canónico).
 */
export const getRequestOrigin = cache(async (): Promise<string> => {
  const host = await getRequestHost();
  if (!host) return stripTrailingSlash(getBaseURL());
  // localhost sin TLS en dev; todo lo demás es https.
  const scheme = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  return `${scheme}://${host}`;
});

/**
 * La base configurada (`NEXT_PUBLIC_BASE_URL`), con un piso: si quedó apuntando a la
 * máquina local, gana el host real por el que llegó la request.
 *
 * `NEXT_PUBLIC_BASE_URL` es una constante de BUILD y nadie la ve fallar: no hay warning
 * ni 500. En desdeelsur quedó con la URL del BACKEND (`http://localhost:9000`) y el
 * sitio publicó `canonical`, `robots.txt`, `sitemap.xml`, `llms.txt` y las OG images en
 * localhost durante semanas, respondiendo 200 todo el tiempo. La regla y su fundamento
 * viven en `canonical-base.ts`, que es puro y testeado.
 *
 * ⚠ EL GUARD NO ES COSMÉTICO. Los headers se leen SÓLO cuando la base ya es loopback.
 * Con la variable bien puesta —o sea, en toda instalación sana— este camino no toca
 * `headers()`, así que `robots.txt` y cualquier página que hoy se prerenderice siguen
 * siendo estáticas exactamente como antes. Leerlos incondicionalmente acá volvería
 * dinámica media app por un fallo que no está ocurriendo.
 */
const resolveConfiguredBase = async (): Promise<string> => {
  const configured = stripTrailingSlash(getBaseURL());
  if (!isLoopbackOrigin(configured)) return configured;
  return preferPublicOrigin(configured, await getRequestOrigin());
};

/**
 * Origen CANÓNICO del sitio activo: el que va en `<link rel="canonical">`,
 * `metadataBase` y el JSON-LD.
 *
 * Un sitio puede ser alcanzable en hasta tres hosts (su subdominio, el host principal
 * con `/tienda/<slug>`, y una URL de preview). Elegir UNO es lo que evita que Google
 * indexe contenido duplicado y termine des-indexando las tiendas.
 *
 * Hoy, sin multi-host, devuelve `getBaseURL()` — o sea el comportamiento actual, sin
 * cambios. Cuando la Fase 6 prenda `NEXT_PUBLIC_SITE_HOST_SUFFIX`, el canónico de una
 * tienda pasa a ser `<slug>.<sufijo>`.
 */
export const getCanonicalOrigin = cache(async (): Promise<string> => {
  const suffix = normalizeSiteSuffix(process.env.NEXT_PUBLIC_SITE_HOST_SUFFIX);
  const base = await resolveConfiguredBase();
  if (!suffix) return base;

  // Import dinámico: `active-tenant` es server-only y arrastra el fetch del tenant.
  // Traerlo sólo cuando multi-host está activo mantiene este módulo liviano.
  const { getActiveSiteSlug, getActiveTenant } = await import(
    "@lib/site-config/active-tenant"
  );
  const slug = await getActiveSiteSlug();
  if (!slug) return base;

  // La tienda elige su forma canónica (columna `canonical_form`, publicada como
  // `canonicalForm`). Con 'path' el canónico es el HOST PRINCIPAL: la URL completa la
  // arma el caller con `getCanonicalPath()`.
  //
  // El tenant ya está cargado en esta request (el layout lo resolvió), así que leerlo
  // NO agrega I/O. Es por eso que esta decisión vive acá y no en `proxy.ts`: ahí
  // habría que ir a la base en cada navegación.
  const tenant = await getActiveTenant();
  if (tenant.canonicalForm === "path") return sitesHubOrigin(suffix, base) ?? base;
  return publicSiteUrl({ slug, canonical_form: "host" }, { baseUrl: base, hostSuffix: suffix });
});

/**
 * Prefijo de path que va DENTRO del canonical.
 *
 * Vale `''` cuando la forma canónica es el subdominio (el host ya identifica el
 * sitio) y `/tienda/<slug>` cuando es la ruta. Los canonicals se arman
 * `${await getCanonicalOrigin()}${await getCanonicalPath()}/products/x`.
 */
export const getCanonicalPath = cache(async (): Promise<string> => {
  const { getActiveSiteSlug, getActiveTenant } = await import(
    "@lib/site-config/active-tenant"
  );
  const slug = await getActiveSiteSlug();
  if (!slug) return "";

  // SIN multi-host el prefijo NO es opcional: la única forma alcanzable de la tienda es
  // `/tienda/<slug>`, así que ese prefijo ES su URL canónica. Devolver `''` acá era el
  // bug que hacía que cada PDP de cada tienda canonicalizara al sitio PRINCIPAL, donde
  // ese producto puede no existir (auditoría del 19/08: 57 de 57 páginas).
  if (!normalizeSiteSuffix(process.env.NEXT_PUBLIC_SITE_HOST_SUFFIX)) return `/${SITE_PATH_SEGMENT}/${slug}`;

  const tenant = await getActiveTenant();
  return tenant.canonicalForm === "path" ? `/${SITE_PATH_SEGMENT}/${slug}` : "";
});

/**
 * URL canónica ABSOLUTA de una ruta lógica del sitio activo (sin `[countryCode]` y sin
 * el prefijo de tienda: los pone esta funcion).
 *
 * Es el único camino que deberían usar las páginas para su `alternates.canonical`. Antes
 * convivian tres formas — string relativo (que el prefijo de tienda se come),
 * `getCanonicalOrigin()+getCanonicalPath()` a mano, y nada (que heredaba el `'/'` del
 * root layout y canonicalizaba la página a la home) — y las tres estaban mal en algún
 * caso.
 *
 * `path` se normaliza: `'/'` y `''` dan la home del sitio. No acepta query string: una
 * faceta (`/store?brand=x`) canonicaliza a su ruta base, nunca a sí misma.
 */
export const canonicalUrl = async (path: string): Promise<string> => {
  const [origin, prefix] = await Promise.all([getCanonicalOrigin(), getCanonicalPath()]);
  const clean = (path.split("?")[0] ?? "").split("/").filter(Boolean).join("/");
  const url = `${origin}${prefix}${clean ? `/${clean}` : ""}`;
  return url === origin ? `${origin}/` : url;
};

/**
 * ¿El host de esta request es el canónico del sitio activo?
 *
 * Lo usan `robots` (para `Disallow: /` en hosts no canónicos) y el 308 de la Fase 6.
 * Con multi-host apagado siempre es `true`: no hay host no canónico posible.
 */
export const isCanonicalHost = cache(async (): Promise<boolean> => {
  if (!normalizeSiteSuffix(process.env.NEXT_PUBLIC_SITE_HOST_SUFFIX)) return true;
  const [host, canonical] = await Promise.all([getRequestHost(), getCanonicalOrigin()]);
  if (!host) return true;
  try {
    return new URL(canonical).hostname === host;
  } catch {
    return true;
  }
});

/**
 * ¿Esta request está en la forma canónica del sitio (host Y path)?
 *
 * Más estricto que `isCanonicalHost()`: una tienda con `canonical_form: 'path'`
 * alcanzada por su SUBDOMINIO tiene el host "correcto" según el origen canónico
 * (que es el principal) pero igual está en la forma no canónica. `robots` usa esto
 * para el `noindex`.
 */
export const isCanonicalForm = cache(async (): Promise<boolean> => {
  if (!normalizeSiteSuffix(process.env.NEXT_PUBLIC_SITE_HOST_SUFFIX)) return true;
  const { getActiveSiteSlug, getActiveTenant } = await import(
    "@lib/site-config/active-tenant"
  );
  const slug = await getActiveSiteSlug();
  if (!slug) return isCanonicalHost();

  const [tenant, host] = await Promise.all([getActiveTenant(), getRequestHost()]);
  if (!host) return true;

  const suffix = normalizeSiteSuffix(process.env.NEXT_PUBLIC_SITE_HOST_SUFFIX);
  const onSubdomain = host === `${slug}${suffix}`;
  // 'host' → canónico sólo en el subdominio. 'path' → canónico sólo FUERA de él.
  return tenant.canonicalForm === "path" ? isSitesHubHost(host, suffix) : onSubdomain;
});
