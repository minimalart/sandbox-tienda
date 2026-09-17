import 'server-only';
import { cache } from 'react';
import { sdk } from '@lib/config';
import { getActiveSiteSlug, getActiveSitePrefix } from '@lib/site-config/active-tenant';
import type { PrivacyConfiguration } from '@lib/consent/contract';

export async function fetchPrivacyConfiguration(
  slug: string | null,
  pathPrefix: string
): Promise<PrivacyConfiguration> {
  try {
    const result = await sdk.client.fetch<PrivacyConfiguration>('/store/marketing-privacy', {
      method: 'GET',
      cache: 'no-store',
      headers: slug ? { 'x-site-slug': slug } : {},
    });
    if (result.legacyAllowed && result.analyticsAvailable && !result.analytics) {
      const id = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
      if (id && /^G-[A-Za-z0-9]+$/.test(id))
        result.analytics = { enabled: true, measurementId: id, consentCategory: 'analytics' };
    }
    if (result.legacyAllowed && result.clarityAvailable && !result.clarity) {
      const projectId = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;
      if (projectId && /^[a-zA-Z0-9]{3,32}$/.test(projectId))
        result.clarity = { enabled: true, projectId, consentCategory: 'analytics' };
    }
    return {
      ...result,
      pathPrefix,
      analytics: result.analytics ? { ...result.analytics, pathPrefix } : null,
      clarity: result.clarity ? { ...result.clarity, pathPrefix } : null,
    };
  } catch {
    // A failed settings request is not evidence that consent is absent.
    return {
      siteId: slug ?? 'main',
      consent: null,
      analytics: null,
      legacyAllowed: false,
      analyticsAvailable: false,
      available: false,
      pathPrefix,
    };
  }
}
export const getPrivacyConfiguration = cache(async () =>
  fetchPrivacyConfiguration(await getActiveSiteSlug(), await getActiveSitePrefix())
);
