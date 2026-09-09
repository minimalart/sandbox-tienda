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
  } catch (error) {
    /**
     * `order_id: null` se mantiene: para el que hace polling, "todavía no está"
     * y "no pude preguntar" se manejan igual — sigue intentando.
     *
     * Lo que NO se mantiene es tragarse el error sin dejar rastro. Este `catch`
     * vacío escondió durante meses que la ruta del backend no existía: devolvía
     * un 400 ("Unrecognized fields: 'cart_id'") en CADA intento de CADA compra,
     * el proxy lo convertía en un null indistinguible de "el webhook todavía no
     * terminó", y el único síntoma visible era el cartel de los 60 segundos.
     * Un error que no se loguea no es un error manejado.
     */
    console.error(
      `[orders/by-cart] backend lookup failed for cart ${cartId}:`,
      error instanceof Error ? error.message : error,
    )
    return NextResponse.json({ order_id: null })
  }
}
