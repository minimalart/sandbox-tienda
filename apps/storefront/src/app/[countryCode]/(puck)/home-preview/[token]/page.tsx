import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { fetchLandingPreview } from '@lib/landing-preview';
import HomeRenderer from '@modules/home/components/home-renderer';
import { BannersProvider } from '@lib/context/banners-context';
import { getDemoHomeBanners, getHomeBanners } from '@lib/data/banners';
import '@modules/home-campaign/campaign-theme.css';
import '@modules/home-technology/tech-theme.css';
import PreviewBridge from '@modules/common/components/puck-preview-bridge';
import { getActiveTenant } from '@lib/site-config/active-tenant';
import { tenantForClient } from '@lib/site-config/tenant-for-client';
import { templateWrapperClass } from '@lib/site-config/template-helpers';
import { TenantProvider } from '@lib/site-config/context';
import { ChannelProvider } from '@lib/context/channel-context';
import { AddToCartAnimationProvider } from '@lib/context/add-to-cart-animation';
import PageLayout from '../../../(main)/layout';

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false }, referrer: 'no-referrer' as const };

export default async function PuckPreviewPage({ params }: { params: Promise<{ token: string; countryCode: string }> }) {
  const { token, countryCode } = await params;
  if ((await headers()).get('x-puck-preview') !== token) notFound();
  const preview = await fetchLandingPreview(token, 'home');
  if (!preview) notFound();
  const content = <HomeRenderer content={preview.puck_data.content} countryCode={countryCode} />;
  if (preview.mode === 'page') return (
    <PreviewBridge token={token} origin={preview.parent_origin}>
      <PageLayout params={Promise.resolve({ countryCode })} preview>{content}</PageLayout>
    </PreviewBridge>
  );
  const tenant = await getActiveTenant();
  const banners = preview.site_slug ? await getDemoHomeBanners() : await getHomeBanners();
  // These are the same visual contexts as the storefront, without cart hydration
  // or tracking. Product cards render normally but cannot purchase in the editor.
  return <TenantProvider tenant={tenantForClient(tenant)} siteSlug={preview.site_slug || undefined} sitePrefix={preview.site_slug ? `/tienda/${preview.site_slug}` : ''}>
    <ChannelProvider salesChannelId={tenant.medusa.salesChannelId} customerGroupId={tenant.medusa.customerGroupId}>
      <AddToCartAnimationProvider><BannersProvider initialBanners={banners}>
        <PreviewBridge token={token} origin={preview.parent_origin}><div className={templateWrapperClass(tenant.template)}>{content}</div></PreviewBridge>
      </BannersProvider></AddToCartAnimationProvider>
    </ChannelProvider>
  </TenantProvider>;
}
