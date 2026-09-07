import { NextRequest, NextResponse } from 'next/server';
import { getMedusaSDK } from '@lib/config';
import { getOrSetCart, retrieveCart } from '@lib/data/cart';
import { getAuthHeaders, getCacheTag } from '@lib/data/cookies';
import { revalidateTag } from 'next/cache';

/** Uses the existing cart/cookie/channel lifecycle. The plugin validates and adds atomically. */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Solicitud inválida.' }, { status: 400 });
  }
  if (
    !body ||
    typeof body.configurator_id !== 'string' ||
    typeof body.countryCode !== 'string' ||
    !/^[a-z]{2}$/i.test(body.countryCode) ||
    !body.snapshot ||
    typeof body.snapshot !== 'object'
  ) {
    return NextResponse.json({ message: 'Faltan datos del diseño.' }, { status: 400 });
  }
  try {
    const cart = await getOrSetCart(body.countryCode);
    const sdk = await getMedusaSDK();
    const result = await sdk.client.fetch<{ added: boolean; items_count: number }>(
      '/store/space-designer/line-items',
      {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: {
          cart_id: cart.id,
          configurator_id: body.configurator_id,
          template_id: typeof body.template_id === 'string' ? body.template_id : undefined,
          snapshot: body.snapshot,
        },
      }
    );
    const cartTag = await getCacheTag('carts');
    if (cartTag) revalidateTag(cartTag, 'max');
    return NextResponse.json({ ...result, cart: await retrieveCart(cart.id) });
  } catch (error) {
    const status = (error as { status?: number })?.status;
    return NextResponse.json(
      {
        message:
          status && status < 500
            ? (error as Error).message
            : 'No pudimos agregar el diseño al carrito. Intentá de nuevo.',
      },
      { status: status && status >= 400 && status < 500 ? status : 502 }
    );
  }
}
