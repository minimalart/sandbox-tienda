'use client'

import { Dialog, DialogBackdrop, DialogPanel } from '@headlessui/react'
import { createRecurringOrder } from '@lib/data/recurring-orders'
import type {
  RecurringDiscount,
  RecurringFrequencyInterval,
  SubscriptionPlan,
} from '@lib/data/recurring-orders'
import LocalizedClientLink from '@modules/common/components/localized-client-link'
import { Check, Minus, Plus, Repeat } from 'lucide-react'
import { useParams } from 'next/navigation'
import { useState } from 'react'

/** Dirección serializable que el wrapper server resuelve del customer. */
export type SubscribeAddressOption = {
  id: string
  label: string
  detail: string
}

/** Config server-resuelta que habilita el bloque Suscribirse en la PDP. */
export type SubscriptionActionConfig = {
  enabled: boolean
  isLoggedIn: boolean
  addresses: SubscribeAddressOption[]
  /** Descuentos de suscripción de ESTE producto (% por frecuencia), si hay oferta. */
  discounts?: RecurringDiscount[]
  plans?: SubscriptionPlan[]
  automaticPaymentsEnabled?: boolean
}

/** % de descuento para una frecuencia exacta (0 = sin oferta). */
function discountFor(
  discounts: RecurringDiscount[] | undefined,
  interval: RecurringFrequencyInterval,
  count: number,
): number {
  return (
    discounts?.find((d) => d.interval === interval && d.count === count)?.percentage ?? 0
  )
}

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

type SubscribeActionProps = {
  productTitle: string
  variantId: string | null
  disabled?: boolean
  config: SubscriptionActionConfig
}

/**
 * "Suscribirse" en la PDP: crea una compra recurrente del producto con la
 * frecuencia y dirección elegidas. El cobro de cada entrega llega después por
 * email/WhatsApp con un link de pago (modo confirmación manual).
 */
export default function SubscribeAction({
  productTitle,
  variantId,
  disabled,
  config,
}: SubscribeActionProps) {
  const countryCode = useParams().countryCode as string
  const [open, setOpen] = useState(false)
  const [frequencyKey, setFrequencyKey] = useState(
    config.plans?.[0]?.offers[0]?.id ?? 'weekly',
  )
  const [planId, setPlanId] = useState(config.plans?.[0]?.id ?? null)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [automaticPayment, setAutomaticPayment] = useState(
    Boolean(config.automaticPaymentsEnabled && config.plans?.length),
  )
  const [quantity, setQuantity] = useState(1)
  const [addressId, setAddressId] = useState(config.addresses[0]?.id ?? null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  if (!config.enabled) return null

  const selectedPlan = config.plans?.find((plan) => plan.id === planId) ?? config.plans?.[0]
  const frequencies = selectedPlan?.offers.length
    ? selectedPlan.offers.map((offer) => ({
        key: offer.id,
        label:
          offer.label ||
          (offer.frequency_interval === 'month'
            ? offer.frequency_count === 1 ? 'Cada mes' : `Cada ${offer.frequency_count} meses`
            : offer.frequency_interval === 'week'
              ? offer.frequency_count === 1 ? 'Cada semana' : `Cada ${offer.frequency_count} semanas`
              : offer.frequency_count === 1 ? 'Cada día' : `Cada ${offer.frequency_count} días`),
        interval: offer.frequency_interval,
        count: offer.frequency_count,
        percentage: offer.discount_type === 'percentage' ? Number(offer.discount_value) : 0,
      }))
    : FREQUENCIES.map((frequency) => ({ ...frequency, percentage: discountFor(config.discounts, frequency.interval, frequency.count) }))
  const selectedFrequency =
    frequencies.find((frequency) => frequency.key === frequencyKey) ?? frequencies[0]

  // Mejor % entre las frecuencias ofrecidas: gancho del botón de la PDP.
  const bestDiscount = Math.max(
    0,
    ...frequencies.map((frequency) => frequency.percentage),
  )

  const close = () => {
    setOpen(false)
    setError(null)
    if (done) {
      setDone(false)
      setQuantity(1)
    }
  }

  const handleSubmit = async () => {
    if (!variantId || !addressId) return
    const frequency = selectedFrequency
    setSubmitting(true)
    setError(null)
    const result = await createRecurringOrder({
      items: [{ variant_id: variantId, quantity }],
      frequency_interval: frequency.interval,
      frequency_count: frequency.count,
      plan_id: selectedPlan?.id ?? null,
      offer_id: selectedPlan ? frequency.key : null,
      payment_mode: automaticPayment && selectedPlan ? 'mercadopago_auto' : 'manual_link',
      terms_accepted: selectedPlan ? termsAccepted : false,
      terms_version: '2026-09-04',
      country_code: countryCode,
      address_id: addressId,
      metadata: { origin: 'pdp' },
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
    <>
      <button
        className='mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-[--primary-color] px-4 py-3 font-semibold text-[--primary-color] text-sm transition-colors hover:bg-[--mc-green-soft] disabled:cursor-not-allowed disabled:opacity-50'
        disabled={disabled}
        onClick={() => setOpen(true)}
        type='button'
      >
        <Repeat className='h-4 w-4' strokeWidth={2} />
        {bestDiscount > 0
          ? `Suscribite y ahorrá ${bestDiscount}%`
          : 'Suscribirse y recibirlo siempre'}
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
                  Antes de cada entrega te mandamos un link para confirmar y pagar.
                  Podés pausarla o cancelarla cuando quieras.
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
                  Seguir comprando
                </button>
              </div>
            ) : !config.isLoggedIn ? (
              <div className='flex flex-col gap-3 text-center'>
                <h3 className='font-bold text-gray-900 text-xl'>Suscribite a {productTitle}</h3>
                <p className='text-gray-500 text-sm'>
                  Iniciá sesión para programar la reposición automática de tus productos.
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
                  <h3 className='font-bold text-gray-900 text-xl'>Compra recurrente</h3>
                  <p className='mt-1 text-gray-500 text-sm'>
                    Elegí cada cuánto querés recibir <b>{productTitle}</b>. Vas a ver
                    el precio, la próxima fecha y las condiciones antes de confirmar.
                  </p>
                </div>

                {(config.plans?.length ?? 0) > 1 && (
                  <div>
                    <label className='mb-2 block font-semibold text-gray-900 text-sm' htmlFor='subscription-plan'>Plan</label>
                    <select
                      className='w-full rounded-xl border border-gray-200 px-3 py-2 text-sm'
                      id='subscription-plan'
                      value={selectedPlan?.id}
                      onChange={(event) => {
                        const next = config.plans?.find((plan) => plan.id === event.target.value)
                        setPlanId(event.target.value)
                        setFrequencyKey(next?.offers[0]?.id ?? 'weekly')
                      }}
                    >
                      {config.plans?.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
                    </select>
                  </div>
                )}

                <div>
                  <span className='mb-2 block font-semibold text-gray-900 text-sm'>
                    Frecuencia
                  </span>
                  <div className='flex gap-2'>
                    {frequencies.map((f) => {
                      const pct = f.percentage
                      return (
                        <button
                          className={`relative flex-1 rounded-xl border px-3 py-2 font-medium text-sm transition-colors ${
                            frequencyKey === f.key
                              ? 'border-[--primary-color] bg-[--mc-green-soft] text-[--primary-color]'
                              : 'border-gray-200 text-gray-700 hover:border-[--primary-color]'
                          }`}
                          key={f.key}
                          onClick={() => setFrequencyKey(f.key)}
                          type='button'
                        >
                          {f.label}
                          {pct > 0 && (
                            <span className='mt-0.5 block font-bold text-[--primary-color] text-xs'>
                              -{pct}%
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                  {selectedFrequency?.percentage > 0 && (
                    <p className='mt-2 text-gray-500 text-xs'>
                      El descuento se aplica automáticamente en cada entrega, sobre
                      los precios vigentes.
                    </p>
                  )}
                  {selectedPlan && (
                    <p className='mt-2 rounded-xl bg-gray-50 px-3 py-2 text-gray-600 text-xs'>
                      {selectedPlan.price_policy === 'fixed' ? 'Precio contratado' : 'Precio vigente al preparar cada entrega'}
                      {' · '}Próxima entrega en {selectedFrequency.count} {selectedFrequency.interval === 'month' ? 'mes(es)' : selectedFrequency.interval === 'week' ? 'semana(s)' : 'día(s)'}
                      {selectedPlan.minimum_cycles > 0 ? ` · Permanencia mínima: ${selectedPlan.minimum_cycles} ciclos` : ''}
                    </p>
                  )}
                </div>

                {selectedPlan && config.automaticPaymentsEnabled && (
                  <label className='flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 p-3 text-sm'>
                    <input
                      checked={automaticPayment}
                      className='mt-0.5 h-4 w-4 accent-[--primary-color]'
                      onChange={(event) => setAutomaticPayment(event.target.checked)}
                      type='checkbox'
                    />
                    <span><b>Cobro automático con Mercado Pago</b><span className='mt-0.5 block text-gray-500 text-xs'>Podés pausar o cancelar desde tu cuenta. Si cambiás la frecuencia, Mercado Pago te pedirá confirmar la nueva agenda.</span></span>
                  </label>
                )}

                <div>
                  <span className='mb-2 block font-semibold text-gray-900 text-sm'>
                    Cantidad por entrega
                  </span>
                  <div className='flex w-fit items-center gap-4 rounded-xl border border-gray-200 px-3 py-2'>
                    <button
                      aria-label='Restar uno'
                      className='text-gray-500 disabled:opacity-30'
                      disabled={quantity <= 1}
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      type='button'
                    >
                      <Minus className='h-4 w-4' />
                    </button>
                    <span className='min-w-6 text-center font-semibold text-gray-900'>
                      {quantity}
                    </span>
                    <button
                      aria-label='Sumar uno'
                      className='text-gray-500'
                      onClick={() => setQuantity((q) => q + 1)}
                      type='button'
                    >
                      <Plus className='h-4 w-4' />
                    </button>
                  </div>
                </div>

                <div>
                  <span className='mb-2 block font-semibold text-gray-900 text-sm'>
                    Dirección de entrega
                  </span>
                  {config.addresses.length ? (
                    <div className='flex max-h-40 flex-col gap-2 overflow-y-auto'>
                      {config.addresses.map((a) => (
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

                {selectedPlan && (
                  <label className='flex cursor-pointer items-start gap-3 text-gray-600 text-xs'>
                    <input
                      checked={termsAccepted}
                      className='mt-0.5 h-4 w-4 accent-[--primary-color]'
                      onChange={(event) => setTermsAccepted(event.target.checked)}
                      type='checkbox'
                    />
                    <span>Acepto la frecuencia, la política de precio y los términos de la suscripción. Puedo cancelarla sin trabas desde mi cuenta.</span>
                  </label>
                )}

                <div className='flex flex-col gap-2'>
                  <button
                    className='w-full rounded-xl bg-[--primary-color] px-4 py-3 font-semibold text-sm text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50'
                    disabled={submitting || !variantId || !addressId || Boolean(selectedPlan && !termsAccepted)}
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
    </>
  )
}
