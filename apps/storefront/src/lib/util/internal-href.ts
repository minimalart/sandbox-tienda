/**
 * Un link a un host NUESTRO no es un link externo.
 *
 * Los hrefs de contenido (banners, tiles del home, FAQ, footer) los escribe una
 * persona en el admin, y los escribe copiando de la barra del navegador —
 * normalmente estando en el entorno de preview. Así quedaron guardados en
 * desdeelsur los CTAs del home y los bloques de categorías: absolutos, apuntando
 * a `https://desdeelsur.minimalart.studio/store?...`.
 *
 * Con la regla vieja — "empieza con http, entonces es externo"
 * (`hero-banners`: `href.startsWith("http")`) — el sitio de PRODUCCIÓN se llevaba
 * al visitante al dominio de preview: `<a target="_blank">` desde los banners y
 * navegación de documento completo desde las tiles. Es DESDEELSUR-61 / BUG-04, y
 * era crítico: el visitante salía del dominio que estaba comprando.
 *
 * El criterio de este módulo es el mismo que el de `canonical-base`: un valor mal
 * configurado en el contenido NUNCA le puede ganar al lugar donde el visitante
 * está. Si el host del href es uno de los nuestros, el link es interno y se
 * reduce a `path + query + hash`; así además vuelve a navegar del lado del
 * cliente en vez de recargar la página entera.
 *
 * Deliberadamente NO se mira `window.location`: el mismo href tiene que resolver
 * igual en el server y en el cliente o Next reporta mismatch de hidratación. Los
 * hosts propios se conocen sin request (ver `ownHostsFromEnv`).
 *
 * Es puro y sin imports del framework para poder testear la regla sin montar un
 * render.
 */

import { isLoopbackOrigin } from "./canonical-base";

/**
 * Dominio de preview de la plataforma. Cada storefront de Minimalart es
 * alcanzable en `<tienda>.minimalart.studio`, así que un href de contenido a ese
 * dominio es, por construcción, un link interno pegado desde el preview — nunca
 * un link externo legítimo (ninguna tienda linkea al preview de otra).
 */
const PLATFORM_PREVIEW_HOST = "minimalart.studio";

/** Esquemas que no son navegación web y hay que dejar intactos. */
const NON_WEB_SCHEMES = new Set(["mailto:", "tel:", "sms:", "whatsapp:"]);

/** ¿`hostname` es el dominio de preview de la plataforma o un subdominio suyo? */
function isPlatformPreviewHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === PLATFORM_PREVIEW_HOST || host.endsWith(`.${PLATFORM_PREVIEW_HOST}`)
  );
}

/**
 * Hosts propios conocidos sin mirar la request: la base pública configurada.
 *
 * Se descarta si quedó en loopback, que es el fallo que ya documenta
 * `canonical-base`: con `NEXT_PUBLIC_BASE_URL=http://localhost:9000` tomar su
 * host como "propio" convertiría cualquier link a localhost en interno.
 */
export function ownHostsFromEnv(baseUrl: string | undefined): string[] {
  if (!baseUrl || isLoopbackOrigin(baseUrl)) return [];
  try {
    return [new URL(baseUrl).host.toLowerCase()];
  } catch {
    return [];
  }
}

/**
 * Hosts propios de este deploy. `NEXT_PUBLIC_BASE_URL` es una constante de build,
 * así que vale lo mismo en el server y en el cliente: el href se reescribe igual
 * en los dos lados y no hay mismatch de hidratación.
 */
export function ownHosts(): string[] {
  return ownHostsFromEnv(process.env.NEXT_PUBLIC_BASE_URL);
}

/** `toInternalHref` con los hosts de este deploy ya resueltos. */
export function internalHref(href: string): string {
  return toInternalHref(href, ownHosts());
}

/** `isExternalHref` con los hosts de este deploy ya resueltos. */
export function isExternalLink(href: string): boolean {
  return isExternalHref(href, ownHosts());
}

/**
 * ¿Este href apunta a un host nuestro?
 *
 * Un href relativo devuelve `false`: no apunta a NINGÚN host, ya es interno y no
 * hay nada que reescribir. Usar `isExternalHref` para decidir target/rel.
 */
export function pointsToOwnHost(href: string, ownHosts: string[] = []): boolean {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return false; // relativo o basura: no hay host que comparar
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return false;

  const host = url.host.toLowerCase();
  return (
    isPlatformPreviewHost(url.hostname) ||
    ownHosts.some((own) => own.toLowerCase() === host)
  );
}

/**
 * Reduce un href absoluto a un host propio a su parte interna (`/store?q=x`).
 *
 * Todo lo demás vuelve TAL CUAL: los relativos ya están bien, los de otros hosts
 * son externos de verdad, y `mailto:`/`tel:` no son navegación. Ante un valor que
 * no parsea se devuelve el original — "arreglar" algo que no entendemos es peor
 * que dejarlo.
 */
export function toInternalHref(href: string, ownHosts: string[] = []): string {
  if (!pointsToOwnHost(href, ownHosts)) return href;

  const url = new URL(href);
  // `pathname` de una URL absoluta siempre trae al menos "/", pero el fallback
  // deja explícito que nunca devolvemos "" (un href vacío recarga la página).
  return `${url.pathname || "/"}${url.search}${url.hash}`;
}

/**
 * ¿Hay que abrir este href como externo (`target="_blank"`, `rel="noopener"`)?
 *
 * Sólo si es absoluto Y no es nuestro. Es el reemplazo directo del
 * `href.startsWith("http")` que causó BUG-04.
 */
export function isExternalHref(href: string, ownHosts: string[] = []): boolean {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return false; // relativo: interno
  }

  if (NON_WEB_SCHEMES.has(url.protocol)) return true;
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;

  return !pointsToOwnHost(href, ownHosts);
}
