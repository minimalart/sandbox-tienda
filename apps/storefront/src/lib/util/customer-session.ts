import { resolveSiteFromParts, type SiteResolution } from '../site-config/resolve-site';
import { stripSitePrefix } from '../site-config/site-path';

export type CustomerSession = { site: string | null; mode: 'b2c' | 'b2b' };
export const SESSION_HEADER = 'x-storefront-session';

export function sessionCookieName(session: CustomerSession, kind = 'jwt'): string {
  // Separate main from a site literally named "main", without ambiguous separators.
  const site = session.site ? `site-${encodeURIComponent(session.site)}` : 'main';
  return `_mercatto_${session.mode}_${site}_${kind}`;
}

export function sessionForPath(pathname: string, site: string | null): CustomerSession {
  const path = stripSitePrefix(pathname);
  return { site, mode: /^\/(?:api\/)?b2b(?:\/|$)/.test(path) ? 'b2b' : 'b2c' };
}

/** Same-origin referrer keeps API calls tied to their tab, not the last site's cookie. */
export function resolveCustomerSession(
  url: string,
  referer: string | null,
  host: string | null,
  fallbackSite: SiteResolution,
  pagePath?: string | null
): { session: CustomerSession; site: SiteResolution } {
  const current = new URL(url);
  let site = fallbackSite;
  let pathname = current.pathname;
  if (pathname.startsWith('/api/')) {
    try {
      const source =
        pagePath?.startsWith('/') && !pagePath.startsWith('//')
          ? new URL(pagePath, current.origin)
          : new URL(referer ?? '');
      if (source.origin === current.origin) {
        site = resolveSiteFromParts({ host, pathname: source.pathname, cookieSlug: fallbackSite.slug });
        pathname = source.pathname;
      }
    } catch {
      /* Missing referrer: use the resolved request site. */
    }
    if (/^\/api\/b2b(?:\/|$)/.test(current.pathname)) pathname = '/b2b';
  }
  return { session: sessionForPath(pathname, site.slug), site };
}

export function browserCustomerSession(): CustomerSession {
  const url = new URL(window.location.href);
  const cookieSlug = document.cookie.split('; ').find(value => value.startsWith('_site_slug='))?.split('=')[1]
    || document.cookie.split('; ').find(value => value.startsWith('_demo_slug='))?.split('=')[1];
  const site = resolveSiteFromParts({ host: url.host, pathname: url.pathname, cookieSlug });
  return sessionForPath(url.pathname, site.slug);
}

/** Internal headers are always overwritten by the proxy; never accept a legacy JWT. */
export function applyCustomerSessionHeaders(
  original: Headers,
  session: CustomerSession,
  readCookie: (name: string) => string | undefined
): Headers {
  const headers = new Headers(original);
  headers.set(SESSION_HEADER, JSON.stringify(session));
  headers.delete('x-medusa-jwt');
  const token = readCookie(sessionCookieName(session));
  if (token) headers.set('x-medusa-jwt', token);
  return headers;
}
