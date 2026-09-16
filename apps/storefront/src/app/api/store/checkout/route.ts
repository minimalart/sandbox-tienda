import { getTenant } from '@lib/site-config/resolver';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getAdminSDK } from '@lib/config';
import { getAuthHeaders, getCartId, getB2BCartId, getCustomerSession } from '@lib/data/cookies';
import { checkoutCookieName, handleCheckoutSession } from '@lib/server/checkout-session';

export async function POST(request: Request) {
  const context = await getCustomerSession();
  const cartId = context.mode === 'b2b' ? await getB2BCartId() : await getCartId();
  if (!cartId) return NextResponse.json({ message: 'Carrito no encontrado.' }, { status: 404 });
  const jar = await cookies();
  const name = checkoutCookieName(context, cartId);
  try {
    const body = await request.json();
    const tenant = await getTenant();
    const authHeaders = await getAuthHeaders();
    const result = await handleCheckoutSession({
      existingToken: jar.get(name)?.value,
      bind: process.env.MEDUSA_ADMIN_API_KEY ? (token) => getAdminSDK().client.fetch('/admin/sites/checkout-context', {
        method: 'POST', body: { cart_id: cartId, site_slug: context.site, mode: context.mode, access_token: token }, cache: 'no-store',
      }) : undefined,
      request: (token) => fetch(new URL('/store/carts/' + encodeURIComponent(cartId) + '/checkout', process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || 'http://localhost:9000'), {
        method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json', 'x-publishable-api-key': tenant.medusa.publishableKey || process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || '', ...authHeaders, 'x-checkout-access': token }, cache: 'no-store',
      }),
    });
    const response = NextResponse.json(result.body, { status: result.status, headers: { 'Cache-Control': 'private, no-store' } });
    if (result.newToken) response.cookies.set(name, result.newToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: 90 * 86400 });
    return response;
  } catch (e) {
    const error = e as { status?: number; message?: string };
    // The multistore extension is optional. Only a missing route disables it.
    if (error.status === 404) return NextResponse.json({ configured: false });
    return NextResponse.json({ message: error.message ?? 'No se pudo actualizar el checkout.' }, { status: error.status && error.status >= 400 && error.status < 600 ? error.status : 400, headers: { 'Cache-Control': 'private, no-store' } });
  }
}
