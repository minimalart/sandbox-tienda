import type { DemoStoreLike, DemoTemplate } from './types';
import { buildBaseAssets } from './shared';

const DEFAULT_CAMPAIGN_ILLUSTRATION = '/images/campaign-default-illustration.png';

/**
 * Landing minimalista para tiendas institucionales/educativas: un hero de
 * campaña + grid único de kits/productos + footer con datos de la institución.
 * A diferencia de los verticales (technology/fashion/…) no monta rails de
 * banners/blog/videos/brands: el catálogo es acotado y el foco está en un
 * lineup fijo por ciclo. `buildAssets` declara la ilustración genérica y cada
 * demo puede pisarla vía `assets.campaign` o desde su documento Puck.
 *
 * El footer del vertical se ARMA en `buildTenantConfig` (`templates/index.ts`)
 * desde `content.contact` (email/phone/address), `content.footer`
 * (description/copyright) y `content.campaign.footer` (poweredBy/
 * backgroundColor — únicos overrides propios del template).
 */
export const campaignTemplate: DemoTemplate = {
  code: 'campaign',
  name: 'Landing institucional (Campaña)',
  tenant_template: 'campaign',
  vertical: 'campaign',
  // Foto real de Unsplash (útiles escolares sobre un escritorio). La anterior era
  // un id inventado que devolvía 404 y la card del wizard mostraba el alt roto.
  preview_image:
    'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1200&q=80',
  buildAssets: (demo: DemoStoreLike) => ({
    ...buildBaseAssets(demo),
    campaign: {
      hero: { image: DEFAULT_CAMPAIGN_ILLUSTRATION },
    },
  }),
};
