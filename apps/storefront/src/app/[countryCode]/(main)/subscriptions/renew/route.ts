import { NextResponse, type NextRequest } from 'next/server'
import { retrieveCart } from '@lib/repositories/cart.repository'
import { setCartId } from '@lib/data/cookies'

/**
 * GET /[countryCode]/subscriptions/renew?cart_id=...&cycle_id=... — el link de
 * pago de una renovación de compra recurrente.
 *
 * Es el destino de los emails/WhatsApp que manda el módulo backend
 * `recurring-order`: el carrito de la renovación ya viene armado (items +
 * dirección + envío del canal), así que se restaura por id (cookie
 * `_medusa_cart_id`) y se redirige directo al paso de pago del checkout.
 * Si el carrito ya no existe o ya se convirtió en orden (pagó desde otro
 * dispositivo), cae en "Mis compras recurrentes".
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ countryCode: string }> },
) {
  const { countryCode } = await params
  const cartId = request.nextUrl.searchParams.get('cart_id')?.trim()

  if (cartId) {
    // retrieveCart devuelve null si el carrito no existe o ya es una orden.
    const cart = await retrieveCart(cartId)
    if (cart) {
      await setCartId(cartId)
      return NextResponse.redirect(
        new URL(`/${countryCode}/checkout?step=payment`, request.url),
      )
    }
  }

  const fallback = new URL(`/${countryCode}/account/subscriptions`, request.url)
  fallback.searchParams.set('expired', '1')
  return NextResponse.redirect(fallback)
}
