import { getFirstBannerForPlacement } from '@lib/banners';
import { BannersProvider } from '@lib/context/banners-context';
import { getHomeBanners } from '@lib/data/banners';
import { TenantProvider } from '@lib/site-config/context';
import { tenantForClient } from '@lib/site-config/tenant-for-client';
import {
  getActiveSitePrefix,
  getActiveSiteSlug,
  getActiveTenant,
} from '@lib/site-config/active-tenant';
import { contrastingPlainColor } from '@modules/layout/components/welcome-splash/plain-color';

// El splash vive en su PROPIO route group, separado de `(main)`, para NO heredar
// el chrome del home (header, nav, footer). Antes compartía el layout del home y
// éste se veía de fondo. Acá el fondo es un color pleno a pantalla completa y el
// color del splash aparece animado encima (ver splash-view).
export const dynamic = 'force-dynamic';

export default async function SplashLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // `getActiveTenant` y no `getTenant`: el splash de una tienda tiene que usar SU
  // branding, no el del sitio principal. Y se pasan slug + prefijo al provider —
  // antes este mount point no los pasaba, así que `useSiteHref()` no prefijaba dentro
  // del splash y sus links sacaban al usuario del sitio.
  const [tenant, siteSlug, sitePrefix, homeBanners] = await Promise.all([
    getActiveTenant(),
    getActiveSiteSlug(),
    getActiveSitePrefix(),
    getHomeBanners(),
  ]);
  const splashBanner = getFirstBannerForPlacement(homeBanners, 'welcome_splash');
  const plainColor = contrastingPlainColor(splashBanner?.card_color);

  return (
    <TenantProvider
      tenant={tenantForClient(tenant)}
      siteSlug={siteSlug ?? undefined}
      sitePrefix={sitePrefix}
    >
      <BannersProvider initialBanners={homeBanners}>
        <div
          className='fixed inset-0 overflow-hidden'
          style={{ backgroundColor: plainColor }}
        >
          {children}
        </div>
      </BannersProvider>
    </TenantProvider>
  );
}
