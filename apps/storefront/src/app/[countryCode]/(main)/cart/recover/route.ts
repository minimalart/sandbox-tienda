import { NextResponse, type NextRequest } from 'next/server'
import { retrieveCart } from '@lib/repositories/cart.repository'
import { setCartId } from '@lib/data/cookies'

/**
 * GET /[countryCode]/cart/recover?cart_id=... — restaura un carrito abandonado.
 *
 * Es el destino de los links de recuperación que envía la extensión backend
 * `abandoned-cart` (email/WhatsApp). Valida el carrito por id (retrieveCart
 * devuelve null si no existe o ya se convirtió en orden — y en ese caso limpia
 * la cookie), setea la cookie `_medusa_cart_id` y redirige al carrito. Si el id
 * falta o el carrito ya no es recuperable, redirige igual al carrito (vacío).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ countryCode: string }> },
) {
  const { countryCode } = await params
  const cartId = request.nextUrl.searchParams.get('cart_id')?.trim()

  let recovered = false
  if (cartId) {
    const cart = await retrieveCart(cartId)
    if (cart) {
      await setCartId(cartId)
      recovered = true
    }
  }

  const target = new URL(`/${countryCode}/cart`, request.url)
  if (recovered) target.searchParams.set('recovered', '1')
  return NextResponse.redirect(target)
}
