'use client'

import { RadioGroup } from '@headlessui/react'
import type { HttpTypes } from '@medusajs/types'
import {
  isMercadoPagoApi as isMercadoPagoApiFunc,
  isStripe as isStripeFunc,
  paymentInfoMap,
} from '@lib/constants'
import { Text } from '@medusajs/ui'
import ErrorMessage from '@modules/checkout/components/error-message'
import PaymentContainer, {
  StripeCardContainer,
} from '@modules/checkout/components/payment-container'
import MercadoPagoBrick from '@modules/checkout/components/payment-mercadopago-brick'
import { validateMpApiBrick } from '@modules/checkout/components/payment-mercadopago-brick/bridge'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

type PaymentSession = { provider_id: string; status: string; id: string }
type PaymentMethod = { id: string }

type PaymentProps = {
  cart: HttpTypes.StoreCart
  availablePaymentMethods: PaymentMethod[]
  /** MP Checkout API public key for the active tenant (embedded Brick). */
  mercadopagoPublicKey?: string | null
  onCartUpdate?: (
    cart?: HttpTypes.StoreCart | null,
  ) => Promise<HttpTypes.StoreCart | null>
}

const Payment = ({
  cart,
  availablePaymentMethods,
  mercadopagoPublicKey,
  onCartUpdate,
}: PaymentProps) => {
  const sessions = (
    cart.payment_collection as Record<string, unknown> | undefined
  )?.payment_sessions as PaymentSession[] | undefined
  const activeSession = sessions?.find((s) => s.status === 'pending')

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [, setCardBrand] = useState<string | null>(null)
  const [cardComplete, setCardComplete] = useState(false)
  const effectiveSelectedMethod = activeSession?.provider_id || ''
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(
    effectiveSelectedMethod,
  )
  const pendingSelectionRef = useRef<string | null>(null)

  const searchParams = useSearchParams()
  const router = useRouter()

  const isOpen = searchParams.get('step')?.replace(/^edit-/, '') === 'payment'

  const currentSelectedMethod =
    selectedPaymentMethod ||
    activeSession?.provider_id ||
    pendingSelectionRef.current ||
    ''
  const isStripe = isStripeFunc(currentSelectedMethod)

  const visiblePaymentMethods = availablePaymentMethods || []
  const hasPaymentMethods = visiblePaymentMethods.length > 0

  useEffect(() => {
    if (activeSession?.provider_id) {
      setSelectedPaymentMethod(activeSession.provider_id)
      pendingSelectionRef.current = null
    } else if (pendingSelectionRef.current) {
      setSelectedPaymentMethod(pendingSelectionRef.current)
    }
  }, [activeSession?.provider_id])

  const setPaymentMethod = (method: string) => {
    setError(null)
    setSelectedPaymentMethod(method)
    pendingSelectionRef.current = method
  }

  const cartAny = cart as unknown as Record<string, unknown>
  const giftCards = cartAny?.gift_cards as unknown[] | undefined
  const paidByGiftcard = giftCards && giftCards.length > 0 && cart?.total === 0

  const initiatePaymentSession = useCallback(
    async (providerId: string) => {
      setIsLoading(true)
      try {
        const response = await fetch('/api/store/cart', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'initiatePayment',
            provider_id: providerId,
            origin: window.location.origin,
          }),
        })

        const result = await response.json()

        if (!response.ok || !result.success) {
          throw new Error(
            result.message || 'Error al inicializar el método de pago',
          )
        }

        if (onCartUpdate) {
          await onCartUpdate(result.cart)
        } else {
          router.refresh()
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error desconocido'
        setError(message)
      } finally {
        setIsLoading(false)
      }
    },
    [onCartUpdate, router],
  )

  useEffect(() => {
    setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // MercadoPago Checkout API "Confirmar datos de pago": validate the embedded
  // Brick form (MP highlights missing fields), and only if it's complete create
  // the payment session — which is what enables the summary's "Finalizar
  // compra". Mirrors Express's "Confirmar método de pago" gate.
  const confirmApiData = async () => {
    setError(null)
    const valid = await validateMpApiBrick()
    if (!valid) return
    await initiatePaymentSession(currentSelectedMethod)
  }

  const renderPaymentAction = () => {
    if (!currentSelectedMethod) {
      return null
    }

    // MercadoPago Checkout API: the embedded Payment Brick is the inline form
    // (rendered on selection, MP's own button hidden). The user loads their data
    // and clicks "Confirmar datos de pago"; that validates the form and creates
    // the session, which enables the summary's single CTA "Finalizar compra".
    if (isMercadoPagoApiFunc(currentSelectedMethod)) {
      const confirmed = activeSession?.provider_id === currentSelectedMethod
      return (
        <div>
          <MercadoPagoBrick cart={cart} publicKey={mercadopagoPublicKey ?? ''} />
          {confirmed ? (
            <p className='mt-4 text-sm text-green-600 font-medium'>
              ✓ Datos de pago confirmados. Hacé clic en &quot;Finalizar
              compra&quot; para pagar.
            </p>
          ) : (
            <button
              className='mt-4 w-full rounded-lg bg-[--primary-color] px-4 py-3 font-medium text-sm text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50'
              disabled={isLoading}
              onClick={confirmApiData}
              type='button'
            >
              {isLoading ? 'Validando...' : 'Confirmar datos de pago'}
            </button>
          )}
        </div>
      )
    }

    if (activeSession && currentSelectedMethod === activeSession.provider_id) {
      return (
        <p className='mt-4 text-sm text-green-600 font-medium'>
          ✓ Método de pago seleccionado. Hacé clic en &quot;Finalizar
          compra&quot; para continuar.
        </p>
      )
    }

    if (isStripeFunc(currentSelectedMethod)) {
      return (
        <button
          className='mt-4 w-full rounded-lg bg-[--primary-color] px-4 py-3 font-medium text-sm text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50'
          data-testid='submit-payment-button'
          disabled={
            isLoading ||
            (isStripe && !cardComplete) ||
            !(currentSelectedMethod || paidByGiftcard)
          }
          onClick={async () => {
            const activeProviderId = (
              activeSession as PaymentSession | undefined
            )?.provider_id
            if (
              activeProviderId !== selectedPaymentMethod &&
              selectedPaymentMethod
            ) {
              await initiatePaymentSession(selectedPaymentMethod)
            }
          }}
          type='button'
        >
          {isLoading ? 'Procesando...' : 'Confirmar método de pago'}
        </button>
      )
    }

    return (
      <button
        className='mt-4 w-full rounded-lg bg-[--primary-color] px-4 py-3 font-medium text-sm text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50'
        data-testid='submit-payment-button'
        disabled={isLoading || !currentSelectedMethod}
        onClick={() => initiatePaymentSession(currentSelectedMethod)}
        type='button'
      >
        {isLoading ? 'Procesando...' : 'Confirmar método de pago'}
      </button>
    )
  }

  return (
    <div>
      {isOpen && (
        <div>
          {!paidByGiftcard && hasPaymentMethods && (
            <RadioGroup
              onChange={(value: string) => setPaymentMethod(value)}
              value={currentSelectedMethod}
            >
              {visiblePaymentMethods.map((paymentMethod) => (
                <div key={paymentMethod.id}>
                  {isStripeFunc(paymentMethod.id) ? (
                    <StripeCardContainer
                      paymentInfoMap={paymentInfoMap}
                      paymentProviderId={paymentMethod.id}
                      selectedPaymentOptionId={selectedPaymentMethod}
                      setCardBrand={setCardBrand}
                      setCardComplete={setCardComplete}
                      setError={setError}
                    />
                  ) : (
                    <PaymentContainer
                      paymentInfoMap={paymentInfoMap}
                      paymentProviderId={paymentMethod.id}
                      selectedPaymentOptionId={selectedPaymentMethod}
                    />
                  )}
                </div>
              ))}
            </RadioGroup>
          )}

          {paidByGiftcard && (
            <div className='flex w-1/3 flex-col'>
              <Text className='txt-medium-plus mb-1 text-ui-fg-base'>
                Método de pago
              </Text>
              <Text
                className='txt-medium text-ui-fg-subtle'
                data-testid='payment-method-summary'
              >
                Tarjeta de regalo
              </Text>
            </div>
          )}

          {!paidByGiftcard && !hasPaymentMethods && (
            <Text className='txt-medium text-ui-fg-subtle'>
              No hay métodos de pago disponibles en este momento. Por favor,
              contactanos para completar tu compra.
            </Text>
          )}

          <ErrorMessage
            data-testid='payment-method-error-message'
            error={error}
          />

          {renderPaymentAction()}
        </div>
      )}
    </div>
  )
}

export default Payment
