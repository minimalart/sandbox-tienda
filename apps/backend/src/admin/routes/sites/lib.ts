import type { DemoStoreStatus } from '../../hooks/api';

import { publicSiteUrl, type PublicSite, type SiteOrigins } from '../../../lib/multistore/site-hosts';

export const SITE_PATH_PREFIX = 'tienda';
export const buildPublicUrlFrom = (site: PublicSite, options: SiteOrigins): string => publicSiteUrl(site, options);
export const formatPublicUrlFrom = (site: PublicSite, options: SiteOrigins): string => {
  if (site.is_main) return '/';
  const url = new URL(publicSiteUrl(site, options));
  return url.pathname === '/' ? url.host : url.pathname;
};

/** ISO-2 country → ISO-4217 currency, for sensible currency defaults. */
const COUNTRY_CURRENCY: Record<string, string> = {
  ar: 'ars',
  br: 'brl',
  cl: 'clp',
  co: 'cop',
  mx: 'mxn',
  pe: 'pen',
  uy: 'uyu',
  us: 'usd',
  es: 'eur',
  fr: 'eur',
  de: 'eur',
  it: 'eur',
  pt: 'eur',
  nl: 'eur',
  gb: 'gbp',
};

export const currencyForCountry = (countryCode: string): string | null =>
  COUNTRY_CURRENCY[countryCode.trim().toLowerCase()] ?? null;

export const STATUS_COLOR: Record<DemoStoreStatus, 'green' | 'orange' | 'red' | 'grey' | 'blue'> = {
  draft: 'grey',
  provisioning: 'blue',
  importing: 'orange',
  ready: 'green',
  failed: 'red',
};

export const STATUS_LABEL_KEY: Record<DemoStoreStatus, string> = {
  draft: 'STATUS_DRAFT',
  provisioning: 'STATUS_PROVISIONING',
  importing: 'STATUS_IMPORTING',
  ready: 'STATUS_READY',
  failed: 'STATUS_FAILED',
};
