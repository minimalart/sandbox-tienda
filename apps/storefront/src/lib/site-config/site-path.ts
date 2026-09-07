import { LEGACY_SITE_PATH_SEGMENT, SITE_PATH_SEGMENT } from "./resolve-site";

/**
 * Helpers de rutas para las sesiones de sitio (antes `demo-path.ts`).
 *
 * Módulo NEUTRO (sin `"use client"`) a propósito: lo usan tanto los componentes
 * cliente (`site-config-context`) como los server components y las server actions que
 * hacen `redirect()`. Importarlos desde un módulo `"use client"` en el server
 * devolvería referencias de cliente, no funciones ejecutables.
 *
 * ⚠ CAMBIO DE CONTRATO: antes estos helpers recibían el SLUG y armaban el prefijo
 * adentro. Ahora reciben el PREFIJO ya resuelto.
 *
 * No es cosmético, es el mecanismo central del proyecto: cuando el sitio se resuelve
 * por SUBDOMINIO, el prefijo es `''` y los ~34 call sites se vuelven **no-op gratis**,
 * sin tocar ninguno. Con el contrato viejo (slug → prefijo) habría que haber
 * modificado los 34 para que dejaran de prefijar bajo host.
 */

/**
 * Antepone el prefijo del sitio a una ruta interna.
 *
 * No-op cuando el prefijo está vacío (sitio principal, o sitio resuelto por host),
 * cuando el href no es interno (externo, ancla, `mailto:`) o cuando ya lo tiene.
 */
export const withSitePrefix = (href: string, pathPrefix?: string | null): string => {
  if (!pathPrefix || !href.startsWith("/")) return href;
  if (href === pathPrefix || href.startsWith(`${pathPrefix}/`)) return href;
  return `${pathPrefix}${href === "/" ? "" : href}`;
};

/**
 * Código de país de los paths (`/ar/...`). Se compara EXACTO contra el env, nunca con
 * un `[a-z]{2}` genérico — ver el footgun documentado en `stripSitePrefix`.
 */
const countryPathSegment = (): string =>
  (
    process.env.NEXT_PUBLIC_COUNTRY_CODE ||
    process.env.NEXT_PUBLIC_DEFAULT_REGION ||
    "ar"
  ).toLowerCase();

/**
 * Home del sitio DEDUCIDA DEL PATHNAME, preservando país y prefijo de tienda.
 *
 * Existe para el único consumidor que no puede usar `useSiteHref()` ni los headers:
 * `app/global-error.tsx` reemplaza el root layout, así que corre FUERA de todos los
 * providers y no tiene contexto de tenant. No es un reemplazo del contexto — quien
 * pueda usar el hook, debe usar el hook.
 *
 * Devuelve la home del sitio principal cuando el path no lleva prefijo de tienda (y
 * también bajo resolución por host, donde el prefijo es `''` por diseño).
 */
export const siteHomeFromPathname = (pathname: string): string => {
  const countryPrefix = `/${countryPathSegment()}`;
  let base = "";
  let rest = pathname;
  if (
    rest.toLowerCase() === countryPrefix ||
    rest.toLowerCase().startsWith(`${countryPrefix}/`)
  ) {
    base = countryPrefix;
    rest = rest.slice(countryPrefix.length);
  }

  // Se aceptan las dos formas: un link viejo `/demo/<slug>` que todavía no pasó por el
  // 308 tiene que llevar igual a la home de SU tienda, no a la del sitio principal.
  for (const segment of [SITE_PATH_SEGMENT, LEGACY_SITE_PATH_SEGMENT]) {
    const match = new RegExp(`^/${segment}/([^/]+)`).exec(rest);
    if (match) return `${base}/${SITE_PATH_SEGMENT}/${match[1]}`;
  }

  return base || "/";
};

/**
 * Ruta lógica de un pathname: le saca el prefijo del sitio y el del país, para poder
 * compararla contra hrefs limpios como `/account/orders` (highlighting de links,
 * pestañas activas).
 *
 * Dentro de un sitio la URL puede llevar el prefijo o no: los links lo ponen, pero
 * cualquier redirect o link viejo cae en la URL limpia y el proxy sostiene la sesión
 * con la cookie. Normalizar el pathname cubre los dos casos.
 *
 * ⚠ Acá se MATÓ un footgun vivo. Antes el prefijo de país se sacaba con
 * `/^\/[a-z]{2}(?=\/|$)/i`, que se come CUALQUIER primer segmento de dos letras — no
 * sólo `ar`. Una tienda con slug `bo` habría tenido el highlighting de links roto en
 * silencio. Ahora se compara EXACTO contra `NEXT_PUBLIC_COUNTRY_CODE`, y el backend
 * además rechaza slugs de menos de 3 caracteres (cinturón y tiradores).
 */
export const stripSitePrefix = (pathname: string, pathPrefix?: string | null): string => {
  let path = pathname;

  const countryPrefix = `/${countryPathSegment()}`;
  if (path.toLowerCase() === countryPrefix || path.toLowerCase().startsWith(`${countryPrefix}/`)) {
    path = path.slice(countryPrefix.length);
  }

  if (pathPrefix && (path === pathPrefix || path.startsWith(`${pathPrefix}/`))) {
    path = path.slice(pathPrefix.length);
  } else {
    // Sin prefijo conocido (o distinto del de la request), se saca cualquiera de las
    // DOS formas: la URL puede venir de un link viejo `/demo/<slug>` que todavía no
    // pasó por el 308.
    for (const segment of [SITE_PATH_SEGMENT, LEGACY_SITE_PATH_SEGMENT]) {
      const match = new RegExp(`^/${segment}/[^/]+`).exec(path);
      if (match) {
        path = path.slice(match[0].length);
        break;
      }
    }
  }

  return path || "/";
};
