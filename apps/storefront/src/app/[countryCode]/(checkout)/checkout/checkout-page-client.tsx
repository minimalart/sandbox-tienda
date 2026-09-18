'use client'

import { useTenant } from '@lib/site-config/context'
import { recipientWording } from '@lib/site-config/template-helpers'

import { lineItemToGA4Item, trackBeginCheckout } from '@lib/analytics/gtag'
import { isMercadoPago, isMercadoPagoApi } from '@lib/constants'
import { useCartStore } from '@lib/stores/cart.store'
import { getCartCheckoutEligibility } from '@lib/util/cart-checkout'
import { useMinimumPurchaseAmount } from '@lib/hooks/use-minimum-purchase'
import { isLineItemInStock } from '@lib/util/is-line-item-in-stock'
import isAddressComplete from '@lib/util/validate-address'
import type { HttpTypes } from '@medusajs/types'
import CheckoutCarousel from '@modules/checkout/components/checkout-carousel'
import { submitMpApiBrick } from '@modules/checkout/components/payment-mercadopago-brick/bridge'
import PaymentWrapper from '@modules/checkout/components/payment-wrapper'
import CheckoutSummary from '@modules/checkout/templates/checkout-summary'
import { useRouter } from 'next/navigation'
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import CheckoutFormClient from './checkout-form-client'
import { useCheckoutPolicy, checkoutRequest } from '@lib/hooks/use-checkout-policy'

/* ── Skeleton blocks ────────────────────────────────── */

function SkeletonPulse({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-gray-200 ${className ?? ''}`}
    />
  )
}

function CheckoutSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-7xl px-4 pt-8 pb-40 sm:px-6 lg:pb-24 lg:px-8">
        <div className="mx-auto max-w-2xl lg:max-w-none">
          {/* Carousel skeleton */}
          <div className="mb-6">
            <SkeletonPulse className="mx-auto mb-3 h-5 w-64" />
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <SkeletonPulse
                  className="h-14 w-[22%] min-w-[140px] shrink-0"
                  key={i}
                />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_380px] lg:gap-x-12 xl:gap-x-16">
            {/* Left: steps skeleton */}
            <div className="flex flex-col gap-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  className="rounded-xl border border-gray-200 bg-white p-5"
                  key={i}
                >
                  <div className="flex items-center gap-3">
                    <SkeletonPulse className="h-7 w-7 rounded-full" />
                    <SkeletonPulse className="h-4 w-32" />
                  </div>
                  {i === 1 && (
                    <div className="mt-4 space-y-3">
                      <SkeletonPulse className="h-10 w-full" />
                      <SkeletonPulse className="h-10 w-full" />
                      <SkeletonPulse className="h-10 w-2/3" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Right: summary skeleton */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <SkeletonPulse className="mb-4 h-5 w-28" />
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div className="flex items-center gap-3" key={i}>
                    <SkeletonPulse className="h-12 w-12 rounded-lg" />
                    <div className="flex-1 space-y-1.5">
                      <SkeletonPulse className="h-3 w-3/4" />
                      <SkeletonPulse className="h-3 w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 space-y-2 border-gray-100 border-t pt-4">
                <div className="flex justify-between">
                  <SkeletonPulse className="h-3 w-16" />
                  <SkeletonPulse className="h-3 w-20" />
                </div>
                <div className="flex justify-between">
                  <SkeletonPulse className="h-4 w-12" />
                  <SkeletonPulse className="h-4 w-24" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

/* ── Order placement helper ─────────────────────────── */

type PaymentSession = {
  provider_id: string
  status: string
  data?: Record<string, unknown>
}
type RedirectResult = { type: 'external' | 'internal'; url: string } | null

async function placeOrderAndRedirect(
  session: PaymentSession | undefined,
  clearCart: () => void,
): Promise<RedirectResult> {
  if (isMercadoPagoApi(session?.provider_id)) {
    // MercadoPago Checkout API: the embedded Payment Brick renders inline with
    // MP's own button hidden, so "Finalizar compra" is the single CTA. Trigger
    // the Brick's submit here — it tokenizes, POSTs the payment and redirects to
    // /checkout/success itself. If the form is invalid or fails, it surfaces the
    // error inline and we stay on the page.
    await submitMpApiBrick()
    return null
  }

  if (isMercadoPago(session?.provider_id)) {
    // MercadoPago Checkout Express: do NOT place the order here. Redirect to the
    // hosted checkout; order creation happens on the return pages
    // (/checkout/success|pending) via the placeOrder action. The backend
    // webhook captures the payment once MP confirms.
    const initPoint = session?.data?.init_point as string | undefined
    if (initPoint) {
      return { type: 'external', url: initPoint }
    }
    return null
  }

  const res = await fetch('/api/store/cart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'placeOrder' }),
  })
  const result = await res.json()
  if (result.success && result.type === 'order' && result.redirectUrl) {
    clearCart()
    return { type: 'internal', url: result.redirectUrl }
  }
  console.error('Order placement failed:', result.message)
  return null
}

/* ── Main component ─────────────────────────────────── */

type CheckoutPageClientProps = {
  googleMapsApiKey: string
  initialCustomer: HttpTypes.StoreCustomer | null
  /** Canal del demo activo (resuelto server-side). Prioritario sobre el del
   *  carrito para scopear el cross-sell al sales channel correcto. */
  demoSalesChannelId?: string
}

export default function CheckoutPageClient({
  googleMapsApiKey,
  initialCustomer,
  demoSalesChannelId,
}: CheckoutPageClientProps) {
  const tenant = useTenant();
  const wording = (text: string) => recipientWording(text, tenant.template);
  const [cart, setCart] = useState<HttpTypes.StoreCart | null>(null)
  const [loading, setLoading] = useState(true)
  const [entered, setEntered] = useState(false)
  const [isPlacingOrder, setIsPlacingOrder] = useState(false)
  // Ref-based re-entry guard: React state updates are batched, so a rapid
  // double-click can fire handlePlaceOrder twice before `isPlacingOrder`
  // flips to true. A ref is a pointer — always reads the latest value.
  const isPlacingRef = useRef(false)
  const router = useRouter()
  const clearCart = useCartStore((s) => s.clearCart)
  const hydrateCart = useCartStore((s) => s.hydrate)
  const items = cart?.items ?? []
  const hasOutOfStockItems = items.some((item) => !isLineItemInStock(item))
  const backendMinimumPurchase = useMinimumPurchaseAmount()
  const checkoutEligibility = useMemo(
    () =>
      getCartCheckoutEligibility({
        items,
        hasOutOfStockItems,
        cartPromotions: cart?.promotions,
        minimumPurchaseAmount: backendMinimumPurchase ?? undefined,
      }),
    [items, hasOutOfStockItems, cart?.promotions, backendMinimumPurchase],
  )

  const fetchCart = useCallback(async () => {
    try {
      const response = await fetch('/api/store/cart')
      const data = await response.json()
      setCart(data.cart)
      hydrateCart(data.cart ?? null)
      return data.cart
    } catch (error) {
      console.error('Error fetching cart:', error)
      setCart(null)
      return null
    } finally {
      setLoading(false)
    }
  }, [hydrateCart])

  useEffect(() => {
    let mounted = true
    const loadCart = async () => {
      if (mounted) {
        await fetchCart()
      }
    }
    loadCart()
    return () => {
      mounted = false
    }
  }, [fetchCart])

  // Mirror store cart changes back into local state (e.g. when the drawer
  // updates quantities or removes items, checkout totals should reflect it)
  useEffect(() => {
    const unsubscribe = useCartStore.subscribe((state) => {
      const storeCart = state.cart
      if (storeCart) {
        setCart((prev) => (prev === storeCart ? prev : storeCart))
      }
    })
    return unsubscribe
  }, [])

  // Trigger slide-in animation after cart loads
  useEffect(() => {
    if (!loading && cart) {
      requestAnimationFrame(() => setEntered(true))
    }
  }, [loading, cart])

  // GA4: begin_checkout. Una sola vez, cuando el carrito con items ya cargó.
  const beganCheckoutRef = useRef(false)
  useEffect(() => {
    if (beganCheckoutRef.current || !cart?.items?.length) {
      return
    }
    beganCheckoutRef.current = true
    trackBeginCheckout({
      items: cart.items.map(lineItemToGA4Item),
      currency: cart.region?.currency_code,
      value: typeof cart.total === 'number' ? cart.total : undefined,
    })
  }, [cart])

  const handleCartUpdate = useCallback(
    async (updatedCart?: HttpTypes.StoreCart | null) => {
      if (updatedCart !== undefined) {
        setCart(updatedCart)
        hydrateCart(updatedCart ?? null)
        return updatedCart
      }
      try {
        const response = await fetch('/api/store/cart')
        const data = await response.json()
        if (data.cart) {
          setCart(data.cart)
          hydrateCart(data.cart)
        }
        return data.cart
      } catch (error) {
        console.error('Error updating cart:', error)
        return cart
      }
    },
    [cart, hydrateCart],
  )

  const checkout = useCheckoutPolicy(cart)
  const [checkoutError, setCheckoutError] = useState('')
  useEffect(() => { if (checkout.state?.cart_changed) void handleCartUpdate(); }, [checkout.state?.revision, checkout.state?.cart_changed])
  // Derive step completion from cart
  const allStepsComplete = useMemo(() => {
    if (!cart) {
      return false
    }
    const hasEmail = !!cart.email
    const hasAddress = isAddressComplete(cart.shipping_address)
    const hasShipping = (cart.shipping_methods?.length ?? 0) > 0
    const hasPayment = !!cart.payment_collection?.payment_sessions?.find(
      (s: PaymentSession) => s.status === 'pending',
    )
    if (checkout.loading || checkout.error) return false
    if (checkout.state?.configured) return checkout.state.flow.ready && (hasPayment || Number(cart.total) === 0)
    return hasEmail && hasAddress && hasShipping && hasPayment
  }, [cart, checkout.state, checkout.loading, checkout.error])

  const handlePlaceOrder = useCallback(async () => {
    if (!cart) {
      return
    }
    if (!checkoutEligibility.canCheckout) {
      console.warn(
        '[handlePlaceOrder] blocked because the cart does not meet checkout requirements',
      )
      return
    }
    // Pointer-based re-entry guard. Beats React state races.
    if (isPlacingRef.current) {
      console.warn(
        '[handlePlaceOrder] ignored re-entry while order is being placed',
      )
      return
    }
    isPlacingRef.current = true
    setIsPlacingOrder(true)
    setCheckoutError('')
    let redirecting = false
    try {
      if (checkout.state?.configured) await checkoutRequest({ action: 'prepare', revision: checkout.state.revision })
      const session = cart.payment_collection?.payment_sessions?.find(
        (s: PaymentSession) => s.status === 'pending',
      ) as PaymentSession | undefined

      const redirect = await placeOrderAndRedirect(session, clearCart)
      if (redirect) {
        redirecting = true
        if (redirect.type === 'external') {
          document.cookie =
            `mp_payment_pending=${Date.now()}; path=/; max-age=3600; SameSite=Lax`

          const onPageShow = (e: PageTransitionEvent) => {
            if (e.persisted) {
              window.removeEventListener('pageshow', onPageShow)
              window.location.replace(window.location.href)
            }
          }
          window.addEventListener('pageshow', onPageShow)

          window.location.href = redirect.url
        } else {
          router.push(redirect.url)
        }
      }
    } catch (error) {
      setCheckoutError((error as Error).message || 'No se pudo completar la compra. Revisá los datos y volvé a intentar.')
    } finally {
      // Only release the guard if we aren't navigating away — otherwise a
      // very fast user could click again during bfcache window and re-enter.
      if (!redirecting) {
        isPlacingRef.current = false
        setIsPlacingOrder(false)
      }
    }
  }, [cart, checkoutEligibility.canCheckout, clearCart, router, checkout.state])

  if (loading || (cart && !checkout.state && checkout.loading)) {
    return <CheckoutSkeleton />
  }

  if (!cart) {
    return (
      <div className="min-h-screen bg-gray-50">
        <main className="mx-auto max-w-7xl px-4 pt-16 pb-24 sm:px-6 lg:px-8">
          <p className="py-20 text-gray-600">
            No se encontró el carrito. Por favor, volvé a la tienda.
          </p>
        </main>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen bg-gray-50 transition-all duration-500 ease-out"
      style={{
        opacity: entered ? 1 : 0,
        transform: entered ? 'translateX(0)' : 'translateX(60px)',
      }}
    >
      <main className="mx-auto max-w-7xl px-4 pt-8 pb-40 sm:px-6 lg:pb-24 lg:px-8">
        <div className="mx-auto max-w-2xl lg:max-w-none">
          {/* Product carousel. Cada tienda puede apagarlo desde su pestana
              Checkout (policy.suggestions). Sin politica configurada, o con una
              sesion pinneada antes de que existiera el flag, se muestra. */}
          {checkout.state?.policy?.suggestions?.enabled !== false && (
            <CheckoutCarousel
              countryCode={
                cart.shipping_address?.country_code ||
                cart.region?.countries?.[0]?.iso_2 ||
                'ar'
              }
              salesChannelId={demoSalesChannelId ?? cart.sales_channel_id ?? undefined}
            />
          )}

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_380px] lg:gap-x-12 xl:gap-x-16">
            {/* Left: checkout steps */}
            <div className="min-w-0">
              <PaymentWrapper cart={cart} key={cart.id}>
                <Suspense
                  fallback={
                    <div className="flex flex-col gap-4">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div
                          className="rounded-xl border border-gray-200 bg-white p-5"
                          key={i}
                        >
                          <div className="flex items-center gap-3">
                            <SkeletonPulse className="h-7 w-7 rounded-full" />
                            <SkeletonPulse className="h-4 w-32" />
                          </div>
                          {i === 1 && (
                            <div className="mt-4 space-y-3">
                              <SkeletonPulse className="h-10 w-full" />
                              <SkeletonPulse className="h-10 w-full" />
                              <SkeletonPulse className="h-10 w-2/3" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  }
                >
                  <CheckoutFormClient
                    checkout={checkout.state}
                    checkoutLoading={checkout.loading}
                    onCheckoutUpdate={checkout.setState}
                    cart={cart}
                    customer={initialCustomer}
                    googleMapsApiKey={googleMapsApiKey}
                    onCartUpdate={handleCartUpdate}
                  />
                </Suspense>
              </PaymentWrapper>
            </div>

            {/* Right: order summary (sticky) */}
            <div className="lg:sticky lg:top-24 lg:self-start">
              {(checkout.error || checkoutError) && <div role="alert" className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{wording(checkout.error || checkoutError)}<button type="button" className="ml-2 underline" onClick={() => checkout.refresh()}>Volver a intentar</button></div>}
              <CheckoutSummary
                checkoutEligibility={checkoutEligibility}
                allStepsComplete={allStepsComplete}
                cart={cart}
                isPlacingOrder={isPlacingOrder}
                key={`summary-${cart.id}-${cart.updated_at}`}
                onPlaceOrder={handlePlaceOrder}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
