'use client'

import { Dialog, DialogBackdrop, DialogPanel } from '@headlessui/react'
import { createRecurringOrder } from '@lib/data/recurring-orders'
import type {
  RecurringDiscount,
  RecurringFrequencyInterval,
  SubscriptionPlan,
  SubscriptionPlanOffer,
} from '@lib/data/recurring-orders'
import type { HttpTypes } from '@medusajs/types'
import LocalizedClientLink from '@modules/common/components/localized-client-link'
import type { SubscribeAddressOption } from '@modules/products/components/subscribe-action'
import { Check, Repeat } from 'lucide-react'
import { useParams } from 'next/navigation'
import { useState } from 'react'

const FREQUENCIES: {
  key: string
  label: string
  interval: RecurringFrequencyInterval
  count: number
}[] = [
  { key: 'weekly', label: 'Cada semana', interval: 'week', count: 1 },
  { key: 'biweekly', label: 'Cada 2 semanas', interval: 'week', count: 2 },
  { key: 'monthly', label: 'Cada mes', interval: 'month', count: 1 },
]

type MakeRecurringProps = {
  cart: HttpTypes.StoreCart
  isLoggedIn: boolean
  addresses: SubscribeAddressOption[]
  /** Productos elegibles según el scope del canal (all/selected). */
  eligibleProductIds: string[]
  /** Descuentos de suscripción por producto (% por frecuencia). */
  discounts?: Record<string, RecurringDiscount[]>
  plans?: SubscriptionPlan[]
  automaticPaymentsEnabled?: boolean
}

const offerKey = (offer: SubscriptionPlanOffer) => offer.id

function frequencyLabel(interval: RecurringFrequencyInterval, count: number) {
  if (interval === 'day') return count === 1 ? 'Cada día' : `Cada ${count} días`
  if (interval === 'week') return count === 1 ? 'Cada semana' : `Cada ${count} semanas`
  return count === 1 ? 'Cada mes' : `Cada ${count} meses`
}

/** % de un producto para una frecuencia exacta (0 = sin oferta). */
function discountFor(
  discounts: Record<string, RecurringDiscount[]> | undefined,
  productId: string | null | undefined,
  interval: RecurringFrequencyInterval,
  count: number,
): number {
  if (!productId) return 0
  return (
    discounts?.[productId]?.find((d) => d.interval === interval && d.count === count)
      ?.percentage ?? 0
  )
}

/**
 * "Convertir en compra recurrente" en el carrito: crea una suscripción con
 * TODOS los items actuales (el carrito sigue vivo para la compra de hoy).
 * Cada entrega llega después con un link para confirmar y pagar.
 */
export default function MakeRecurring({
  cart,
  isLoggedIn,
  addresses,
  eligibleProductIds,
  discounts,
  plans = [],
  automaticPaymentsEnabled = false,
}: MakeRecurringProps) {
  const countryCode = useParams().countryCode as string
  const [open, setOpen] = useState(false)
  const allLines = (cart.items ?? []).filter((item) => item.variant_id && item.product_id)
  const allProductIds = Array.from(new Set(allLines.map((item) => item.product_id as string)))
  const commonPlans = plans.filter((plan) =>
    allProductIds.every((productId) => plan.eligible_product_ids.includes(productId)),
  )
  const [selectedPlanId, setSelectedPlanId] = useState(commonPlans[0]?.id ?? '')
  const selectedPlan = commonPlans.find((plan) => plan.id === selectedPlanId) ?? commonPlans[0]
  const availableOffers = selectedPlan?.offers ?? []
  const [frequencyKey, setFrequencyKey] = useState(
    availableOffers[0] ? offerKey(availableOffers[0]) : 'weekly',
  )
  const [addressId, setAddressId] = useState(addresses[0]?.id ?? null)
  const [automaticPayment, setAutomaticPayment] = useState(
    automaticPaymentsEnabled && commonPlans.length > 0,
  )
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  // La canasta es atómica: sólo se ofrece si todas las líneas comparten un plan
  // V2 o, como fallback legado, todas son elegibles para manual_link.
  const legacyAllEligible =
    allProductIds.length > 0 &&
    allProductIds.every((productId) => eligibleProductIds.includes(productId))
  const lines = (selectedPlan || legacyAllEligible ? allLines : [])
    .map((i) => ({
      variant_id: i.variant_id as string,
      product_id: i.product_id as string,
      quantity: i.quantity,
      unit_price: (i as { unit_price?: number | null }).unit_price ?? null,
      title: i.product_title ?? i.title ?? 'Producto',
    }))
  const selectedOffer = availableOffers.find((offer) => offerKey(offer) === frequencyKey)
  const selectedFrequency = selectedOffer
    ? {
        key: selectedOffer.id,
        label: selectedOffer.label || frequencyLabel(selectedOffer.frequency_interval, selectedOffer.frequency_count),
        interval: selectedOffer.frequency_interval,
        count: selectedOffer.frequency_count,
      }
    : FREQUENCIES.find((frequency) => frequency.key === frequencyKey) ?? FREQUENCIES[0]
  const estimatedSavings = lines.reduce((sum, line) => {
    const pct = selectedOffer?.discount_type === 'percentage'
      ? selectedOffer.discount_value
      : discountFor(discounts, line.product_id, selectedFrequency.interval, selectedFrequency.count)
    if (!pct || line.unit_price == null) return sum
    return sum + (Number(line.unit_price) * line.quantity * pct) / 100
  }, 0)

  if (!lines.length) return null

  const close = () => {
    setOpen(false)
    setError(null)
  }

  const handleSubmit = async () => {
    if (!addressId) return
    if (selectedPlan && !termsAccepted) {
      setError('Necesitás aceptar los términos de la suscripción.')
      return
    }
    setSubmitting(true)
    setError(null)
    const result = await createRecurringOrder({
      items: lines.map(({ variant_id, quantity }) => ({ variant_id, quantity })),
      frequency_interval: selectedFrequency.interval,
      frequency_count: selectedFrequency.count,
      plan_id: selectedPlan?.id ?? null,
      offer_id: selectedOffer?.id ?? null,
      payment_mode:
        automaticPayment && selectedPlan ? 'mercadopago_auto' : 'manual_link',
      terms_accepted: selectedPlan ? termsAccepted : false,
      terms_version: '2026-09-04',
      country_code: countryCode,
      address_id: addressId,
      metadata: { origin: 'cart' },
    })
    setSubmitting(false)
    if ('error' in result && result.error) {
      setError(result.error)
      return
    }
    if ('authorization' in result && result.authorization?.url) {
      window.location.assign(result.authorization.url)
      return
    }
    setDone(true)
  }

  return (
    <div className='mt-4'>
      <button
        className='flex w-full items-center justify-center gap-2 rounded-md border border-[--primary-color] px-4 py-3 font-medium text-[--primary-color] text-sm transition-colors hover:bg-[--mc-green-soft]'
        onClick={() => setOpen(true)}
        type='button'
      >
        <Repeat className='h-4 w-4' strokeWidth={2} />
        Convertir en compra recurrente
      </button>

      <Dialog className='relative z-50' onClose={close} open={open}>
        <DialogBackdrop className='fixed inset-0 bg-black/30 transition-opacity' />
        <div className='fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4'>
          <DialogPanel className='w-full max-w-md rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl'>
            {done ? (
              <div className='flex flex-col items-center gap-3 text-center'>
                <span className='flex h-12 w-12 items-center justify-center rounded-full bg-[--mc-green-soft]'>
                  <Check className='h-6 w-6 text-[--primary-color]' strokeWidth={2.5} />
                </span>
                <h3 className='font-bold text-gray-900 text-xl'>¡Suscripción creada!</h3>
                <p className='text-gray-500 text-sm'>
                  Tu carrito quedó programado. La compra de hoy sigue en el carrito y
                  las próximas entregas se gestionan desde tu suscripción.
                </p>
                <LocalizedClientLink
                  className='mt-2 w-full rounded-xl bg-[--primary-color] px-4 py-3 font-semibold text-sm text-white transition-opacity hover:opacity-90'
                  href='/account/subscriptions'
                >
                  Ver mis compras recurrentes
                </LocalizedClientLink>
                <button
                  className='w-full rounded-xl border border-gray-200 px-4 py-2 font-medium text-gray-900 text-sm'
                  onClick={close}
                  type='button'
                >
                  Volver al carrito
                </button>
              </div>
            ) : !isLoggedIn ? (
              <div className='flex flex-col gap-3 text-center'>
                <h3 className='font-bold text-gray-900 text-xl'>Compra recurrente</h3>
                <p className='text-gray-500 text-sm'>
                  Iniciá sesión para programar la reposición automática de tu carrito.
                </p>
                <LocalizedClientLink
                  className='mt-2 w-full rounded-xl bg-[--primary-color] px-4 py-3 font-semibold text-sm text-white transition-opacity hover:opacity-90'
                  href='/account'
                >
                  Iniciar sesión
                </LocalizedClientLink>
                <button
                  className='w-full rounded-xl border border-gray-200 px-4 py-2 font-medium text-gray-900 text-sm'
                  onClick={close}
                  type='button'
                >
                  Ahora no
                </button>
              </div>
            ) : (
              <div className='flex flex-col gap-4'>
                <div>
                  <h3 className='font-bold text-gray-900 text-xl'>
                    Recibí este carrito cada tanto
                  </h3>
                  <p className='mt-1 text-gray-500 text-sm'>
                    Se crea una suscripción con los {lines.length} productos del
                    carrito y una frecuencia común. La compra de hoy sigue separada.
                  </p>
                </div>

                <ul className='max-h-28 overflow-y-auto rounded-xl bg-gray-50 px-3 py-2 text-gray-700 text-sm'>
                  {lines.map((l) => (
                    <li className='flex justify-between gap-2 py-0.5' key={l.variant_id}>
                      <span className='truncate'>{l.title}</span>
                      <span className='shrink-0 text-gray-500'>×{l.quantity}</span>
                    </li>
                  ))}
                </ul>

                {commonPlans.length > 1 && (
                  <label className='text-gray-900 text-sm'>
                    <span className='mb-2 block font-semibold'>Plan</span>
                    <select
                      className='w-full rounded-xl border border-gray-200 bg-white px-3 py-2'
                      onChange={(event) => {
                        const nextPlan = commonPlans.find((plan) => plan.id === event.target.value)
                        setSelectedPlanId(event.target.value)
                        setFrequencyKey(nextPlan?.offers[0]?.id ?? 'weekly')
                      }}
                      value={selectedPlan?.id ?? ''}
                    >
                      {commonPlans.map((plan) => (
                        <option key={plan.id} value={plan.id}>{plan.name}</option>
                      ))}
                    </select>
                  </label>
                )}

                <div>
                  <span className='mb-2 block font-semibold text-gray-900 text-sm'>
                    Frecuencia
                  </span>
                  <div className='flex gap-2'>
                    {(availableOffers.length
                      ? availableOffers.map((offer) => ({
                          key: offer.id,
                          label: offer.label || frequencyLabel(offer.frequency_interval, offer.frequency_count),
                          interval: offer.frequency_interval,
                          count: offer.frequency_count,
                        }))
                      : FREQUENCIES
                    ).map((f) => (
                      <button
                        className={`flex-1 rounded-xl border px-3 py-2 font-medium text-sm transition-colors ${
                          frequencyKey === f.key
                            ? 'border-[--primary-color] bg-[--mc-green-soft] text-[--primary-color]'
                            : 'border-gray-200 text-gray-700 hover:border-[--primary-color]'
                        }`}
                        key={f.key}
                        onClick={() => setFrequencyKey(f.key)}
                        type='button'
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                  {estimatedSavings > 0 && (
                    <p className='mt-2 font-semibold text-[--primary-color] text-xs'>
                      Ahorrás aprox.{' '}
                      {new Intl.NumberFormat('es-AR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }).format(estimatedSavings)}{' '}
                      por entrega con esta frecuencia.
                    </p>
                  )}
                </div>

                {selectedPlan && automaticPaymentsEnabled && (
                  <label className='flex items-start gap-3 rounded-xl border border-gray-200 p-3 text-sm'>
                    <input
                      checked={automaticPayment}
                      className='mt-0.5 h-4 w-4 accent-[--primary-color]'
                      onChange={(event) => setAutomaticPayment(event.target.checked)}
                      type='checkbox'
                    />
                    <span>
                      <strong className='block text-gray-900'>Cobro automático con Mercado Pago</strong>
                      <span className='text-gray-500'>Te vamos a llevar a Mercado Pago para autorizar los próximos cobros.</span>
                    </span>
                  </label>
                )}

                {selectedPlan && (
                  <label className='flex items-start gap-3 rounded-xl bg-gray-50 p-3 text-gray-600 text-xs'>
                    <input
                      checked={termsAccepted}
                      className='mt-0.5 h-4 w-4 accent-[--primary-color]'
                      onChange={(event) => setTermsAccepted(event.target.checked)}
                      type='checkbox'
                    />
                    <span>
                      Acepto crear una suscripción de {selectedPlan.name} con entregas {frequencyLabel(selectedFrequency.interval, selectedFrequency.count).toLowerCase()} y entiendo que puedo administrarla desde mi cuenta.
                    </span>
                  </label>
                )}

                <div>
                  <span className='mb-2 block font-semibold text-gray-900 text-sm'>
                    Dirección de entrega
                  </span>
                  {addresses.length ? (
                    <div className='flex max-h-40 flex-col gap-2 overflow-y-auto'>
                      {addresses.map((a) => (
                        <button
                          className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                            addressId === a.id
                              ? 'border-[--primary-color] bg-[--mc-green-soft]'
                              : 'border-gray-200 hover:border-[--primary-color]'
                          }`}
                          key={a.id}
                          onClick={() => setAddressId(a.id)}
                          type='button'
                        >
                          <span className='block font-semibold text-gray-900 text-sm'>
                            {a.label}
                          </span>
                          <span className='block text-gray-500 text-xs'>{a.detail}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className='text-gray-500 text-sm'>
                      No tenés direcciones guardadas.{' '}
                      <LocalizedClientLink
                        className='font-semibold text-[--primary-color] hover:underline'
                        href='/account/addresses'
                      >
                        Agregá una dirección
                      </LocalizedClientLink>{' '}
                      y volvé a intentarlo.
                    </p>
                  )}
                </div>

                {error && (
                  <p className='rounded-xl bg-red-50 px-3 py-2 text-red-600 text-sm'>{error}</p>
                )}

                <div className='flex flex-col gap-2'>
                  <button
                    className='w-full rounded-xl bg-[--primary-color] px-4 py-3 font-semibold text-sm text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50'
                    disabled={submitting || !addressId || Boolean(selectedPlan && !termsAccepted)}
                    onClick={handleSubmit}
                    type='button'
                  >
                    {submitting
                      ? 'Creando…'
                      : automaticPayment && selectedPlan
                        ? 'Continuar a Mercado Pago'
                        : 'Crear compra recurrente'}
                  </button>
                  <button
                    className='w-full rounded-xl border border-gray-200 px-4 py-2 font-medium text-gray-900 text-sm'
                    onClick={close}
                    type='button'
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </DialogPanel>
        </div>
      </Dialog>
    </div>
  )
}
