import 'server-only';
import { cache } from 'react';
import { fetchSiteConfig } from './active-tenant';
import { sitesHubOrigin, isSitesHubHost, publicSiteUrl } from './site-hosts';
import { getRequestHost } from '@lib/util/site-url';
import { getBaseURL } from '@lib/util/env';

export type PublicSiteListing = {
  slug: string; name: string; canonical_form: 'host' | 'path'; logo: string | null; template_code: string;
};
export const listPublicSites = cache(async (): Promise<PublicSiteListing[]> => {
  const data = await fetchSiteConfig<{ sites: PublicSiteListing[] }>('', 'public-sites', true);
  if (!data || !Array.isArray(data.sites)) throw new Error('No se pudo cargar el índice de tiendas.');
  return data.sites;
});
export const getSitesHubRequestOrigin = cache(async (): Promise<string | null> => {
  const suffix = process.env.NEXT_PUBLIC_SITE_HOST_SUFFIX;
  if (!suffix || !isSitesHubHost(await getRequestHost(), suffix)) return null;
  return sitesHubOrigin(suffix, getBaseURL());
});
export const publicListingUrl = (site: PublicSiteListing): string => publicSiteUrl(site, {
  baseUrl: getBaseURL(), hostSuffix: process.env.NEXT_PUBLIC_SITE_HOST_SUFFIX ?? '',
});
