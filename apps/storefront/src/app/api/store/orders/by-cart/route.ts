import { sdk } from '@lib/config'
import { NextResponse } from 'next/server'

/**
 * Proxies to the backend custom route:
 *   GET /store/orders/by-cart?cart_id=<id>
 *
 * Returns { order_id: string | null }. The storefront uses this for polling
 * on /checkout/success and /checkout/pending while the MP webhook completes
 * the cart on the backend.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const cartId = url.searchParams.get('cart_id')

  if (!cartId) {
    return NextResponse.json(
      { message: 'cart_id is required', order_id: null },
      { status: 400 },
    )
  }

  try {
    const result = await sdk.client.fetch<{ order_id: string | null }>(
      `/store/orders/by-cart?cart_id=${encodeURIComponent(cartId)}`,
      { method: 'GET' },
    )
    return NextResponse.json({ order_id: result.order_id ?? null })
  } catch {
    return NextResponse.json({ order_id: null })
  }
}
