import { getTenant } from '@lib/site-config/resolver';
import { randomBytes, createHash } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getAdminSDK } from '@lib/config';
import { getAuthHeaders, getCartId, getB2BCartId, getCustomerSession } from '@lib/data/cookies';

export async function POST(request: Request) {
  const context = await getCustomerSession();
  const cartId = context.mode === 'b2b' ? await getB2BCartId() : await getCartId();
  if (!cartId) return NextResponse.json({ message: 'Carrito no encontrado.' }, { status: 404 });
  const jar = await cookies();
  const name = `_checkout_${createHash('sha256').update(JSON.stringify([context.mode, context.site, cartId])).digest('hex').slice(0, 24)}`;
  let token = jar.get(name)?.value;
  if (!token) {
    token = randomBytes(32).toString('hex');
    jar.set(name, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: 90 * 86400 });
  }
  try {
    const body = await request.json();
    if (process.env.MEDUSA_ADMIN_API_KEY) {
      await getAdminSDK().client.fetch('/admin/sites/checkout-context', { method: 'POST', body: { cart_id: cartId, site_slug: context.site, mode: context.mode, access_token: token }, cache: 'no-store' });
    }
    const tenant = await getTenant();
    const response = await fetch(new URL('/store/carts/' + encodeURIComponent(cartId) + '/checkout', process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || 'http://localhost:9000'), { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json', 'x-publishable-api-key': tenant.medusa.publishableKey || process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || '', ...await getAuthHeaders(), 'x-checkout-access': token }, cache: 'no-store' });
    if (response.status === 404) return NextResponse.json({ configured: false });
    const result = await response.json();
    return NextResponse.json(result, { status: response.status, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (e) {
    const error = e as { status?: number; message?: string };
    // The multistore extension is optional. Only a missing route disables it.
    if (error.status === 404) return NextResponse.json({ configured: false });
    return NextResponse.json({ message: error.message ?? 'No se pudo actualizar el checkout.' }, { status: error.status && error.status >= 400 && error.status < 600 ? error.status : 400, headers: { 'Cache-Control': 'private, no-store' } });
  }
}
