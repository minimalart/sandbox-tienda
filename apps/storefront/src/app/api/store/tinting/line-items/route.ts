import { addTintedCartLineItem } from '@lib/repositories/cart.repository'
import { NextResponse } from 'next/server'

/**
 * Agrega al carrito una base entonada. Corre en el server porque necesita la
 * cookie del carrito y la publishable key; el cliente sólo manda variante, color
 * y cantidad — nunca el precio ni el código de fórmula.
 */
export async function POST(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as {
    variantId?: unknown
    colorCode?: unknown
    collection?: unknown
    quantity?: unknown
    countryCode?: unknown
  }

  const variantId = typeof body.variantId === 'string' ? body.variantId : ''
  const colorCode = typeof body.colorCode === 'string' ? body.colorCode : ''
  const countryCode = typeof body.countryCode === 'string' ? body.countryCode : ''
  const quantity = Number(body.quantity ?? 1)

  if (!variantId || !colorCode || !countryCode) {
    return NextResponse.json(
      { message: 'variantId, colorCode y countryCode son obligatorios.' },
      { status: 400 },
    )
  }
  // La API del ERP cotiza por envases enteros; un decimal acá terminaría en un
  // 400 del ERP con un mensaje que no le sirve a nadie.
  if (!Number.isInteger(quantity) || quantity < 1) {
    return NextResponse.json(
      { message: 'La cantidad tiene que ser un número entero de envases.' },
      { status: 400 },
    )
  }

  const result = await addTintedCartLineItem(countryCode, {
    variant_id: variantId,
    color_code: colorCode,
    collection: typeof body.collection === 'string' ? body.collection : null,
    quantity,
  })

  if (!result.success) {
    return NextResponse.json({ message: result.error }, { status: 422 })
  }
  return NextResponse.json({ cart: result.cart })
}
