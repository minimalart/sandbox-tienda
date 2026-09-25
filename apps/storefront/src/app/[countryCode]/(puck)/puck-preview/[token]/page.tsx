import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { fetchLandingPreview } from '@lib/landing-preview';
import LandingRenderer from '@modules/landing-page/components/landing-renderer';
import PreviewBridge from '@modules/landing-page/components/preview-bridge';
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
  const preview = await fetchLandingPreview(token);
  if (!preview) notFound();
  const content = <LandingRenderer content={preview.puck_data.content} countryCode={countryCode} previewLanguage={preview.language} />;
  if (preview.mode === 'page') return (
    <PreviewBridge token={token} origin={preview.parent_origin}>
      <PageLayout params={Promise.resolve({ countryCode })} preview>{content}</PageLayout>
    </PreviewBridge>
  );
  const tenant = await getActiveTenant();
  // These are the same visual contexts as the storefront, without cart hydration
  // or tracking. Product cards render normally but cannot purchase in the editor.
  return <TenantProvider tenant={tenantForClient(tenant)} siteSlug={preview.site_slug || undefined} sitePrefix={preview.site_slug ? `/tienda/${preview.site_slug}` : ''}>
    <ChannelProvider salesChannelId={tenant.medusa.salesChannelId} customerGroupId={tenant.medusa.customerGroupId}>
      <AddToCartAnimationProvider>
        <PreviewBridge token={token} origin={preview.parent_origin}><div className={templateWrapperClass(tenant.template)}>{content}</div></PreviewBridge>
      </AddToCartAnimationProvider>
    </ChannelProvider>
  </TenantProvider>;
}
