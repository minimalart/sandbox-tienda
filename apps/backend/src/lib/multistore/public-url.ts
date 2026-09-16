import { readForeignSetting } from '../../modules/app-settings/foreign';
import { normalizeSiteSuffix, publicSiteUrl, sitesHubOrigin, type PublicSite } from './site-hosts';

export function storefrontOrigins(fallbackBase = 'http://localhost:3000') {
  const base = (readForeignSetting('extension:multistore', 'MULTISTORE_PUBLIC_BASE_URL', {
    envFallback: ['MULTISTORE_PUBLIC_BASE_URL', 'STOREFRONT_URL'],
  }) || fallbackBase).replace(/\/+$/, '');
  const hostSuffix = normalizeSiteSuffix(readForeignSetting('extension:multistore', 'MULTISTORE_SITE_HOST_SUFFIX', {
    envFallback: ['MULTISTORE_SITE_HOST_SUFFIX'],
  }));
  return { base, hostSuffix, sitesBase: sitesHubOrigin(hostSuffix, base) ?? base };
}

export function siteStorefrontUrl(site: PublicSite, fallbackBase?: string): string {
  const { base, hostSuffix, sitesBase } = storefrontOrigins(fallbackBase);
  return publicSiteUrl(site, { baseUrl: base, hostSuffix, sitesBaseUrl: sitesBase });
}
