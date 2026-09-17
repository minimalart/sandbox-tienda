import { NextResponse, type NextRequest } from 'next/server';
import { fetchPrivacyConfiguration } from '@lib/data/privacy';
import { getActiveSiteSlug } from '@lib/site-config/active-tenant';
export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get('slug');
  if (slug && !/^[a-z0-9-]{1,100}$/.test(slug))
    return NextResponse.json({ error: 'Invalid site' }, { status: 400 });
  const config = await fetchPrivacyConfiguration(
    slug || (await getActiveSiteSlug()),
    slug ? `/demo/${slug}` : ''
  );
  return NextResponse.json(config, { headers: { 'Cache-Control': 'no-store' } });
}
