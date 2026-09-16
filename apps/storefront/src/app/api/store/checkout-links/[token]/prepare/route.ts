import {
  retrieveCart,
  addCartLineItem,
  addGuestCartAddress,
  updateCart,
  updateCartAddresses,
  applyCartPromotions,
  type CartAddress,
} from '@lib/repositories/cart.repository'
import { sdk } from '@lib/config'
import { NextResponse } from 'next/server'

// Never cached: this handler mutates the cart on every valid open.
export const dynamic = 'force-dynamic'

type CheckoutLinkAddress = {
  first_name?: string
  last_name?: string
  address_1?: string
  address_2?: string
  company?: string
  postal_code?: string
  city?: string
  country_code?: string
  province?: string
  phone?: string
}

type CheckoutLinkPayload = {
  items: { variant_id: string; quantity: number }[]
  country_code: string
  region_id: string | null
  sales_channel_id: string | null
  email: string | null
  shipping_address: CheckoutLinkAddress | null
  promo_codes: string[]
}

async function resolveCheckoutLink(
  token: string,
): Promise<CheckoutLinkPayload | null> {
  try {
    const { checkout_link } = await sdk.client.fetch<{
      checkout_link: CheckoutLinkPayload
    }>(`/store/checkout-links/${encodeURIComponent(token)}`, {
      method: 'GET',
      cache: 'no-store',
    })
    return checkout_link ?? null
  } catch {
    return null
  }
}

/**
 * Builds the cart from a resolved checkout link entirely on the server, sets the
 * cart cookie and redirects into the standard B2C checkout.
 *
 * This replaces the old client-side loader (the "Preparando tu compra…" screen)
 * that fired a chain of `/api/store/cart` fetches one after another from the
 * browser. Here every mutation runs in-process against Medusa (no browser
 * round-trips, no hydration), so the customer lands on checkout almost directly.
 *
 * Idempotency: the cart is tagged with the link token, so a reload / back
 * navigation skips the rebuild and goes straight to checkout. On any failure we
 * bounce back to `/c/{token}` with an error flag so the page renders a friendly
 * message inside the site layout.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const fallbackCountry = new URL(request.url).searchParams.get('cc') || ''

  const expiredUrl = new URL(
    `/c/${encodeURIComponent(token)}?e=expired`,
    request.url,
  )
  const errorUrl = new URL(
    `/c/${encodeURIComponent(token)}?e=error`,
    request.url,
  )

  const payload = await resolveCheckoutLink(token)
  if (!payload) {
    return NextResponse.redirect(expiredUrl)
  }

  // The link's country drives currency/region on the cart-building flow.
  const countryCode = payload.country_code || fallbackCountry
  if (!countryCode) {
    return NextResponse.redirect(errorUrl)
  }

  const checkoutUrl = new URL('/checkout?step=payment', request.url)

  try {
    // Idempotency guard: if the current cart was already built from this token
    // (reload / back button), skip the rebuild and go straight to checkout.
    try {
      const current = await retrieveCart()
      const meta = current?.metadata as Record<string, unknown> | undefined
      if (meta?.checkout_link_token === token) {
        return NextResponse.redirect(checkoutUrl)
      }
    } catch {
      // ignore — fall through and build the cart
    }

    // 1) Add every line item. The cart cookie set by the first add is visible to
    //    the following iterations within this same request.
    for (const item of payload.items) {
      const result = await addCartLineItem(countryCode, {
        variant_id: item.variant_id,
        quantity: item.quantity,
      })
      if (!result.success) {
        throw new Error(result.error || 'No se pudo agregar un producto')
      }
    }

    // 2) Preload customer data (address implies email when present).
    if (payload.shipping_address) {
      const shippingAddress = {
        ...payload.shipping_address,
        country_code: payload.shipping_address.country_code || countryCode,
      }
      await updateCartAddresses({
        shipping_address: shippingAddress as CartAddress,
        email: payload.email || undefined,
      })

      // El paso de dirección del checkout de INVITADOS no lee
      // `cart.shipping_address`: lista las direcciones guardadas en la metadata
      // del carrito (`addresses` + `selected_address_id`) y marca como elegida
      // la que matchea. Con sólo `shipping_address` seteada esa lista queda
      // vacía y el formulario aparece en blanco aunque el link traiga la
      // dirección. Se registra también ahí, ya seleccionada. Best-effort: si
      // falla, el carrito igual tiene la dirección para el resto del flujo.
      const guestResult = await addGuestCartAddress({
        id: `checkout-link-${token}`,
        first_name: shippingAddress.first_name || '',
        last_name: shippingAddress.last_name || '',
        address_1: shippingAddress.address_1 || '',
        address_2: shippingAddress.address_2 || '',
        postal_code: shippingAddress.postal_code || '',
        city: shippingAddress.city || '',
        country_code: shippingAddress.country_code || '',
        province: shippingAddress.province || '',
        phone: shippingAddress.phone || '',
        company: shippingAddress.company || '',
        address_name: '',
      })
      if (!guestResult.success) {
        console.warn(
          '[checkout-link build] Could not register guest address (non-blocking):',
          guestResult.error,
        )
      }
    } else if (payload.email) {
      await updateCartAddresses({ email: payload.email })
    }

    // 3) Apply promotions.
    if (payload.promo_codes?.length) {
      await applyCartPromotions(payload.promo_codes)
    }

    // 4) Tag the cart so it links back to this checkout link (idempotency +
    //    lets order completion mark single-use links as consumed).
    await updateCart({ metadata: { checkout_link_token: token } })

    return NextResponse.redirect(checkoutUrl)
  } catch (error) {
    console.error('[checkout-link build] Failed to prepare cart:', error)
    return NextResponse.redirect(errorUrl)
  }
}
