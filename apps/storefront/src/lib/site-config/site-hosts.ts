/** Pure URL contract, mirrored in storefront/site-config/site-hosts.ts. */
export function normalizeSiteSuffix(raw: string | null | undefined): string {
  const host = (raw ?? '').trim().toLowerCase().replace(/^\./, '').replace(/\.$/, '');
  if (!host) return '';
  if (host.length > 253 || !host.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) return '';
  return `.${host}`;
}

export function sitesHubOrigin(suffix: string | null | undefined, baseUrl: string): string | null {
  const normalized = normalizeSiteSuffix(suffix);
  if (!normalized) return null;
  const base = new URL(baseUrl);
  return `${base.protocol}//${normalized.slice(1)}${base.port ? `:${base.port}` : ''}`;
}

export function isSitesHubHost(host: string | null | undefined, suffix: string | null | undefined): boolean {
  const apex = normalizeSiteSuffix(suffix).slice(1);
  const normalized = (host ?? '').toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
  return Boolean(apex && (normalized === apex || normalized === `www.${apex}`));
}

export type PublicSite = { slug: string; is_main?: boolean | null; canonical_form?: 'host' | 'path' | null };
export type SiteOrigins = { baseUrl: string; hostSuffix: string; sitesBaseUrl?: string };

export function publicSiteUrl(site: PublicSite, options: SiteOrigins): string {
  const base = options.baseUrl.replace(/\/+$/, '');
  if (site.is_main) return base;
  const suffix = normalizeSiteSuffix(options.hostSuffix);
  if (suffix && (site.canonical_form ?? 'host') === 'host') {
    const origin = new URL(base);
    return `${origin.protocol}//${site.slug}${suffix}${origin.port ? `:${origin.port}` : ''}`;
  }
  const hub = options.sitesBaseUrl ?? sitesHubOrigin(suffix, base) ?? base;
  return `${hub.replace(/\/+$/, '')}/tienda/${site.slug}`;
}
