import {
  retrieveCart,
  addCartLineItem,
  updateCartLineItem,
  removeCartLineItem,
  updateCart,
  updateCartAddresses,
  addGuestCartAddress,
  selectGuestCartAddress,
  removeGuestCartAddress,
  setCartShippingMethod,
  initiateCartPayment,
  completeCart,
  applyCartPromotions,
  applyCartGiftCard,
  applyCartStoreCredit,
  removeCartGiftCard,
} from '@lib/repositories/cart.repository'
import { resolveCartGiftCardCode } from '@lib/server/gift-card-cart'
import { getCartId, removeCartId } from '@lib/data/cookies'
import { validateCorporateCart } from '@lib/data/corporate'
import { getProductsByIds } from '@lib/data/products'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const cart = await retrieveCart()
    return NextResponse.json({ cart })
  } catch (error) {
    console.error('[API] Failed to fetch cart:', error)
    return NextResponse.json(
      { message: 'Unable to fetch cart', cart: null },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { action } = body

    // Add item to cart
    if (action === 'add') {
      const { variantId, quantity, countryCode, productId, metadata } = body
      if (!variantId || !countryCode) {
        return NextResponse.json(
          { message: 'variantId and countryCode are required' },
          { status: 400 },
        )
      }
      const result = await addCartLineItem(countryCode, {
        variant_id: variantId,
        quantity: quantity || 1,
        metadata,
      })

      // Retry with correct variant when Typesense has a stale variant ID
      if (!result.success && productId) {
        try {
          const [product] = await getProductsByIds({
            productIds: [productId],
            countryCode,
          })
          if (product?.variants) {
            const correctVariant = product.variants[0]
            if (correctVariant?.id && correctVariant.id !== variantId) {
              const retryResult = await addCartLineItem(countryCode, {
                variant_id: correctVariant.id,
                quantity: quantity || 1,
                metadata,
              })
              return NextResponse.json({
                cart: retryResult.cart,
                success: retryResult.success,
                message: retryResult.error,
              })
            }
          }
        } catch (retryError) {
          console.error('[API] Variant resolution retry failed:', retryError)
        }
      }

      return NextResponse.json({
        cart: result.cart,
        success: result.success,
        message: result.error,
      })
    }

    // Add multiple items at once (Shop by Look). Agrega los válidos y reporta
    // por ítem cuáles fallaron (error parcial), sin abortar todo el lote.
    if (action === 'addMany') {
      const { items, countryCode } = body as {
        items?: Array<{
          variantId?: string
          quantity?: number
          metadata?: Record<string, unknown>
        }>
        countryCode?: string
      }
      if (!Array.isArray(items) || items.length === 0 || !countryCode) {
        return NextResponse.json(
          { message: 'items and countryCode are required' },
          { status: 400 },
        )
      }

      const results: Array<{
        variantId: string
        success: boolean
        message?: string
      }> = []
      let lastCart = null

      for (const item of items) {
        if (!item.variantId) {
          results.push({
            variantId: '',
            success: false,
            message: 'missing variantId',
          })
          continue
        }
        const result = await addCartLineItem(countryCode, {
          variant_id: item.variantId,
          quantity: item.quantity && item.quantity > 0 ? item.quantity : 1,
          metadata: item.metadata,
        })
        if (result.cart) lastCart = result.cart
        results.push({
          variantId: item.variantId,
          success: result.success,
          message: result.error,
        })
      }

      const succeeded = results.filter((r) => r.success).length
      const failed = results.filter((r) => !r.success)

      return NextResponse.json({
        success: succeeded > 0,
        added: succeeded,
        failed: failed.length,
        results,
        cart: lastCart ?? (await retrieveCart()),
      })
    }

    // Update line item quantity
    if (action === 'update') {
      const { lineId, quantity } = body
      if (!lineId || quantity === undefined) {
        return NextResponse.json(
          { message: 'lineId and quantity are required' },
          { status: 400 },
        )
      }
      const result = await updateCartLineItem(lineId, quantity)
      return NextResponse.json({
        cart: result.cart,
        success: result.success,
        message: result.error,
      })
    }

    // Delete line item
    if (action === 'delete') {
      const { lineId } = body
      if (!lineId) {
        return NextResponse.json(
          { message: 'lineId is required' },
          { status: 400 },
        )
      }
      const result = await removeCartLineItem(lineId)
      return NextResponse.json({
        cart: result.cart,
        success: result.success,
        message: result.error,
      })
    }

    // Update email only
    if (action === 'updateEmail') {
      const { email } = body
      if (!email) {
        return NextResponse.json(
          { message: 'email is required' },
          { status: 400 },
        )
      }
      const result = await updateCartAddresses({ email })
      return NextResponse.json({
        cart: result.cart,
        success: result.success,
        message: result.error,
      })
    }

    // Update personal info (email + name)
    if (action === 'updatePersonalInfo') {
      const { email, first_name, last_name } = body
      if (!email || !first_name || !last_name) {
        return NextResponse.json(
          { message: 'email, first_name and last_name are required' },
          { status: 400 },
        )
      }
      const result = await updateCartAddresses({
        email,
        first_name,
        last_name,
      })
      return NextResponse.json({
        cart: result.cart,
        success: result.success,
        message: result.error,
      })
    }

    // Update addresses
    if (action === 'updateAddresses') {
      const { shipping_address, billing_address, email, shipping_coords } = body
      if (!shipping_address) {
        return NextResponse.json(
          { message: 'shipping_address is required' },
          { status: 400 },
        )
      }
      const result = await updateCartAddresses({
        shipping_address,
        billing_address,
        email,
        shipping_coords,
      })
      return NextResponse.json({
        cart: result.cart,
        success: result.success,
        message: result.error,
      })
    }

    if (action === 'addGuestAddress') {
      const { address } = body
      if (!address || typeof address !== 'object') {
        return NextResponse.json(
          { message: 'address object is required' },
          { status: 400 },
        )
      }

      const result = await addGuestCartAddress(address)
      return NextResponse.json({
        cart: result.cart,
        success: result.success,
        message: result.error,
      })
    }

    if (action === 'selectGuestAddress') {
      const { addressId } = body
      if (!addressId || typeof addressId !== 'string') {
        return NextResponse.json(
          { message: 'addressId is required' },
          { status: 400 },
        )
      }

      const result = await selectGuestCartAddress(addressId)
      return NextResponse.json({
        cart: result.cart,
        success: result.success,
        message: result.error,
      })
    }

    if (action === 'removeGuestAddress') {
      const { addressId } = body
      if (!addressId || typeof addressId !== 'string') {
        return NextResponse.json(
          { message: 'addressId is required' },
          { status: 400 },
        )
      }

      const result = await removeGuestCartAddress(addressId)
      return NextResponse.json({
        cart: result.cart,
        success: result.success,
        message: result.error,
      })
    }

    // Set shipping method
    if (action === 'setShippingMethod') {
      const { shippingMethodId, data } = body
      if (!shippingMethodId) {
        return NextResponse.json(
          { message: 'shippingMethodId is required' },
          { status: 400 },
        )
      }
      const result = await setCartShippingMethod(shippingMethodId, data)
      return NextResponse.json({
        cart: result.cart,
        success: result.success,
        message: result.error,
      })
    }

    // Initiate payment session
    if (action === 'initiatePayment') {
      const { provider_id, origin } = body
      if (!provider_id) {
        return NextResponse.json(
          { message: 'provider_id is required' },
          { status: 400 },
        )
      }
      const result = await initiateCartPayment(provider_id, origin)
      return NextResponse.json({
        cart: result.cart,
        success: result.success,
        message: result.error,
      })
    }

    // Place order
    if (action === 'placeOrder') {
      // Guard de reglas corporativas (min/máx + métodos permitidos). Autoritativo.
      const cartId = await getCartId()
      if (cartId) {
        const check = await validateCorporateCart(cartId)
        if (!check.ok) {
          return NextResponse.json({
            success: false,
            type: 'cart',
            message:
              check.violations.map((v) => v.message).join(' ') ||
              'El carrito no cumple las reglas de tu empresa.',
          })
        }
      }

      // Guard Factura A: si pidió invoice_a, debe haber snapshot fiscal.
      {
        const current = await retrieveCart()
        const meta = (current?.metadata ?? {}) as Record<string, unknown>
        if (meta.invoice_type === 'invoice_a' && !meta.billing_snapshot) {
          return NextResponse.json({
            success: false,
            type: 'cart',
            message:
              'Para Factura A faltan los datos fiscales. Volvé al paso de datos y completalos.',
          })
        }
      }

      const result = await completeCart()

      if (result.success && result.type === 'order' && result.order) {
        return NextResponse.json({
          success: true,
          type: 'order',
          order: result.order,
          redirectUrl: `/order/${result.order.id}/confirmed`,
        })
      }

      return NextResponse.json({
        success: false,
        type: 'cart',
        cart: result.cart,
        message: result.error || 'Order could not be completed',
      })
    }

    // Update cart metadata (e.g. shipping method type, pickup branch)
    if (action === 'updateMetadata') {
      const { metadata } = body
      if (!metadata || typeof metadata !== 'object') {
        return NextResponse.json(
          { message: 'metadata object is required' },
          { status: 400 },
        )
      }
      const result = await updateCart({ metadata })
      return NextResponse.json({
        cart: result.cart,
        success: result.success,
        message: result.error,
      })
    }

    // Apply promotions. Acepta `code` (string) o `codes` (string[]).
    // Cuando se pasa `codes`, reemplaza toda la lista (usado para remover uno).
    if (action === 'applyPromotion') {
      const { code, codes } = body
      const list: string[] = Array.isArray(codes)
        ? codes
        : code
          ? [code]
          : []
      if (list.length === 0 && !Array.isArray(codes)) {
        return NextResponse.json(
          { message: 'code or codes is required' },
          { status: 400 },
        )
      }
      const result = await applyCartPromotions(list)
      return NextResponse.json({
        cart: result.cart,
        success: result.success,
        message: result.error,
      })
    }

    // Apply a gift card to the cart (loyalty-plugin).
    if (action === 'applyGiftCard') {
      const { code } = body
      if (!code || typeof code !== 'string') {
        return NextResponse.json(
          { message: 'code is required' },
          { status: 400 },
        )
      }
      const result = await applyCartGiftCard(code)
      return NextResponse.json({
        cart: result.cart,
        success: result.success,
        message: result.error,
      })
    }

    // Remove a gift card from the cart (loyalty-plugin).
    if (action === 'removeGiftCard') {
      const { applicationId } = body
      if (!applicationId || typeof applicationId !== 'string' || applicationId.length > 160) {
        return NextResponse.json(
          { message: 'applicationId is required' },
          { status: 400 },
        )
      }
      const code = await resolveCartGiftCardCode(applicationId)
      if (!code) return NextResponse.json({ message: 'Gift card application not found' }, { status: 404 })
      const result = await removeCartGiftCard(code)
      return NextResponse.json({
        cart: result.cart,
        success: result.success,
        message: result.error,
      })
    }

    if (action === 'applyStoreCredit') {
      const result = await applyCartStoreCredit()
      return NextResponse.json({
        cart: result.cart,
        success: result.success,
        message: result.error,
      })
    }

    if (action === 'clearCart') {
      await removeCartId()
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ message: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('[API] Cart operation failed:', error)
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : 'Unable to process cart operation',
        success: false,
      },
      { status: 500 },
    )
  }
}
