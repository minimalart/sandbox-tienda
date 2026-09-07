import type { DemoStoreLike, DemoTemplate } from './types';
import { buildBaseAssets } from './shared';

/**
 * Landing minimalista para tiendas institucionales/educativas: un hero de
 * campaña + grid único de kits/productos + footer con datos de la institución.
 * A diferencia de los verticales (technology/fashion/…) no monta rails de
 * banners/blog/videos/brands: el catálogo es acotado y el foco está en un
 * lineup fijo por ciclo. `buildAssets` deja `campaign: {}` para que el merge
 * del storefront use `campaignConfig` de default y cada demo pueda pisar
 * campos vía `assets.campaign`.
 */
export const campaignTemplate: DemoTemplate = {
  code: 'campaign',
  name: 'Landing institucional (Campaña)',
  tenant_template: 'campaign',
  vertical: 'campaign',
  preview_image:
    'https://images.unsplash.com/photo-1581091012184-7c8a3a3a3a3a?auto=format&fit=crop&w=1200&q=80',
  buildAssets: (demo: DemoStoreLike) => ({
    ...buildBaseAssets(demo),
    campaign: {},
  }),
};
