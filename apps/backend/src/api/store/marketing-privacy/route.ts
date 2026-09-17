import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { resolveSite } from '../../../lib/multistore/resolve-site';
import { findDescriptor } from '../../../modules/app-settings/descriptors';
import { resolveSettingFor } from '../../../modules/app-settings/service';
import {
  publicConsent,
  publicAnalytics,
  publicClarity,
} from '../../../lib/marketing-privacy-public';

/** Core seam: the descriptor registry, not imports into optional modules. */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const slug =
    typeof req.headers['x-site-slug'] === 'string' ? req.headers['x-site-slug'] : undefined;
  const resolution = await resolveSite(req.scope, { slug, allowMainFallback: true });
  if (resolution.status === 'unknownSite') return res.status(404).json({ message: 'Unknown site' });
  if (slug && resolution.status === 'registryAbsent')
    return res.status(404).json({ message: 'Unknown site' });
  const site = 'site' in resolution ? resolution.site : null;
  const consentDescriptor = findDescriptor('extension:consent-management', 'CONFIG');
  const analyticsDescriptor = findDescriptor('extension:ga4', 'STOREFRONT_CONFIG');
  const clarityDescriptor = findDescriptor('extension:clarity', 'CONFIG');
  const [consent, analytics, clarity] = await Promise.all([
    consentDescriptor ? resolveSettingFor(req.scope, consentDescriptor, resolution) : null,
    analyticsDescriptor ? resolveSettingFor(req.scope, analyticsDescriptor, resolution) : null,
    clarityDescriptor ? resolveSettingFor(req.scope, clarityDescriptor, resolution) : null,
  ]);
  res.setHeader('Cache-Control', 'no-store');
  if (
    (consent && consentDescriptor?.refine?.(consent)) ||
    (analytics && analyticsDescriptor?.refine?.(analytics)) ||
    (clarity && clarityDescriptor?.refine?.(clarity))
  ) {
    return res.status(503).json({ message: 'Invalid privacy configuration' });
  }
  return res.json({
    siteId: site?.id ?? 'main',
    consent: publicConsent(consent),
    analytics: publicAnalytics(analytics),
    clarity: publicClarity(clarity),
    clarityAvailable: Boolean(clarityDescriptor),
    legacyAllowed: !site || site.is_main,
    analyticsAvailable: Boolean(analyticsDescriptor),
    available: true,
  });
}
