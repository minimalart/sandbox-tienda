'use client'

import type {
  RecurringFrequencyInterval,
  RecurringOrder,
} from '@lib/data/recurring-orders'
import {
  pauseRecurringOrder,
  regenerateRenewalLink,
  resumeRecurringOrder,
  skipNextRecurringDelivery,
  updateRecurringOrder,
} from '@lib/data/recurring-orders'
import { toast } from '@medusajs/ui'
import LocalizedClientLink from '@modules/common/components/localized-client-link'
import CancelSubscriptionModal from './cancel-modal'
import { ArrowLeft, CalendarClock, MapPin, PackageOpen } from 'lucide-react'
import ProductImage from '@modules/common/components/product-image'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { formatDate, frequencyLabel, STATUS_LABELS } from './helpers'
import PaymentMethodEditor from './payment-method-editor'

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

const CYCLE_LABELS: Record<string, { label: string; className: string }> = {
  scheduled: { label: 'Programada', className: 'bg-gray-100 text-gray-600' },
  forecasted: { label: 'Proyectada', className: 'bg-gray-100 text-gray-600' },
  quoted: { label: 'Cotizada', className: 'bg-indigo-50 text-indigo-700' },
  inventory_reserved: { label: 'Stock reservado', className: 'bg-indigo-50 text-indigo-700' },
  awaiting_authorization: { label: 'Falta autorizar', className: 'bg-amber-50 text-amber-700' },
  awaiting_charge: { label: 'Próximo cobro', className: 'bg-blue-50 text-blue-700' },
  paid: { label: 'Pagada', className: 'bg-green-50 text-green-700' },
  order_created: { label: 'Pedido creado', className: 'bg-green-50 text-green-700' },
  retrying_stock: { label: 'Esperando stock', className: 'bg-amber-50 text-amber-700' },
  past_due: { label: 'Pago rechazado', className: 'bg-red-50 text-red-700' },
  refunded: { label: 'Reembolsada', className: 'bg-purple-50 text-purple-700' },
  canceled: { label: 'Cancelada', className: 'bg-gray-100 text-gray-600' },
  processing: { label: 'En proceso', className: 'bg-blue-50 text-blue-700' },
  pending_payment: { label: 'Esperando pago', className: 'bg-blue-50 text-blue-700' },
  success: { label: 'Entregada', className: 'bg-green-50 text-green-700' },
  failed: { label: 'Fallida', className: 'bg-red-50 text-red-700' },
  skipped: { label: 'Omitida', className: 'bg-gray-100 text-gray-600' },
}

/**
 * Detalle de una compra recurrente: estado + acciones (pausar/reanudar/omitir/
 * cancelar), frecuencia editable, items y el historial de renovaciones con el
 * link de pago cuando hay una entrega pendiente.
 */
export default function SubscriptionDetail({
  recurringOrder: ro,
  mercadoPagoPublicKey,
}: {
  recurringOrder: RecurringOrder
  mercadoPagoPublicKey?: string | null
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [editingAddress, setEditingAddress] = useState(false)
  const [quantities, setQuantities] = useState<Record<string, number>>(
    Object.fromEntries((ro.items ?? []).map((item) => [item.id, item.quantity])),
  )
  const [addressDraft, setAddressDraft] = useState({
    first_name: ro.shipping_address?.first_name ?? '',
    last_name: ro.shipping_address?.last_name ?? '',
    address_1: ro.shipping_address?.address_1 ?? '',
    address_2: ro.shipping_address?.address_2 ?? '',
    city: ro.shipping_address?.city ?? '',
    province: ro.shipping_address?.province ?? '',
    postal_code: ro.shipping_address?.postal_code ?? '',
    country_code: ro.shipping_address?.country_code ?? 'ar',
    phone: ro.shipping_address?.phone ?? '',
  })
  const status = STATUS_LABELS[ro.status] ?? STATUS_LABELS.active
  const availableFrequencies = ro.available_offers?.length
    ? ro.available_offers.map((offer) => ({
        key: offer.id,
        label:
          offer.label ||
          frequencyLabel(offer.frequency_interval, offer.frequency_count),
        interval: offer.frequency_interval,
        count: offer.frequency_count,
      }))
    : FREQUENCIES
  const currentFrequencyKey =
    availableFrequencies.find(
      (f) => f.interval === ro.frequency_interval && f.count === ro.frequency_count,
    )?.key ?? null

  const run = async (
    key: string,
    fn: () => Promise<{ error?: string; authorization_url?: string }>,
    okMessage: string,
  ) => {
    setBusy(key)
    const result = await fn()
    setBusy(null)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success(okMessage)
    if (result.authorization_url) {
      window.location.assign(result.authorization_url)
      return
    }
    router.refresh()
  }

  const address = ro.shipping_address
  const pendingCycle = (ro.cycles ?? []).find(
    (c) => c.status === 'pending_payment' && c.confirmation_url,
  )
  const authorizationCycle = (ro.cycles ?? []).find(
    (c) => c.status === 'awaiting_authorization' && c.confirmation_url,
  )
  const authorizationUrl =
    authorizationCycle?.confirmation_url ?? ro.provider_state?.authorization_url

  return (
    <div className='space-y-6'>
      <div>
        <LocalizedClientLink
          className='mb-3 inline-flex items-center gap-1 text-gray-500 text-sm hover:text-[--primary-color]'
          href='/account/subscriptions'
        >
          <ArrowLeft className='h-4 w-4' /> Mis compras recurrentes
        </LocalizedClientLink>
        <div className='flex flex-wrap items-center gap-3'>
          <h2 className='font-semibold text-base/7 text-gray-900'>
            Compra recurrente
          </h2>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-semibold text-xs ${status.className}`}
          >
            {status.label}
          </span>
        </div>
        <p className='mt-1 text-gray-500 text-sm/6'>
          {frequencyLabel(ro.frequency_interval, ro.frequency_count)}
          {ro.status === 'active' && ro.next_execution_at
            ? ` · Próxima entrega: ${formatDate(ro.next_execution_at)}`
            : ''}
          {ro.skip_next_cycle ? ' · La próxima entrega se va a omitir' : ''}
        </p>
      </div>

      {ro.payment_mode === 'mercadopago_auto' && mercadoPagoPublicKey &&
        ro.status !== 'cancelled' && ro.status !== 'completed' && (
          <PaymentMethodEditor
            publicKey={mercadoPagoPublicKey}
            recurringOrderId={ro.id}
          />
        )}

      {pendingCycle?.confirmation_url && (
        <a
          className='block w-full rounded-xl bg-[--primary-color] px-4 py-3 text-center font-semibold text-sm text-white transition-opacity hover:opacity-90'
          href={pendingCycle.confirmation_url}
        >
          Confirmar y pagar la entrega pendiente
        </a>
      )}

      {authorizationUrl && (
        <div className='rounded-2xl border border-amber-200 bg-amber-50 p-4'>
          <p className='font-semibold text-amber-900 text-sm'>
            Falta confirmar el nuevo calendario de cobros
          </p>
          <p className='mt-1 text-amber-800 text-sm'>
            Mercado Pago necesita tu autorización para aplicar el cambio sin cobrar una entrega omitida.
          </p>
          <a
            className='mt-3 inline-flex rounded-xl bg-amber-900 px-4 py-2 font-semibold text-sm text-white'
            href={authorizationUrl}
          >
            Autorizar en Mercado Pago
          </a>
        </div>
      )}

      {/* Acciones */}
      <div className='flex flex-wrap gap-2'>
        {ro.status === 'active' && (
          <>
            <button
              className='rounded-xl border border-gray-300 px-4 py-2 font-semibold text-gray-700 text-sm transition-colors hover:border-[--primary-color] hover:text-[--primary-color] disabled:opacity-50'
              disabled={busy !== null}
              onClick={() =>
                run('pause', () => pauseRecurringOrder(ro.id), 'Suscripción pausada.')
              }
              type='button'
            >
              {busy === 'pause' ? 'Pausando…' : 'Pausar'}
            </button>
            {!ro.skip_next_cycle && (
              <button
                className='rounded-xl border border-gray-300 px-4 py-2 font-semibold text-gray-700 text-sm transition-colors hover:border-[--primary-color] hover:text-[--primary-color] disabled:opacity-50'
                disabled={busy !== null}
                onClick={() =>
                  run(
                    'skip',
                    () => skipNextRecurringDelivery(ro.id),
                    'La próxima entrega se va a omitir.',
                  )
                }
                type='button'
              >
                {busy === 'skip' ? 'Guardando…' : 'Omitir próxima entrega'}
              </button>
            )}
          </>
        )}
        {(ro.status === 'paused' || ro.status === 'failed') && (
          <button
            className='rounded-xl bg-[--primary-color] px-4 py-2 font-semibold text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-50'
            disabled={busy !== null}
            onClick={() =>
              run('resume', () => resumeRecurringOrder(ro.id), 'Suscripción reanudada.')
            }
            type='button'
          >
            {busy === 'resume' ? 'Reanudando…' : 'Reanudar'}
          </button>
        )}
        {ro.status !== 'cancelled' && ro.status !== 'completed' && (
          <button
            className='rounded-xl border border-red-200 px-4 py-2 font-semibold text-red-600 text-sm transition-colors hover:bg-red-50 disabled:opacity-50'
            disabled={busy !== null}
            onClick={() => setCancelOpen(true)}
            type='button'
          >
            Cancelar suscripción
          </button>
        )}
      </div>

      <CancelSubscriptionModal
        onClose={() => setCancelOpen(false)}
        open={cancelOpen}
        recurringOrder={ro}
      />

      {/* Frecuencia */}
      {ro.status !== 'cancelled' && ro.status !== 'completed' && (
        <div className='rounded-2xl border border-gray-200 bg-white p-4 sm:p-5'>
          <h3 className='flex items-center gap-2 font-semibold text-gray-900 text-sm'>
            <CalendarClock className='h-4 w-4 text-gray-400' /> Frecuencia
          </h3>
          <div className='mt-3 flex gap-2'>
            {availableFrequencies.map((f) => (
              <button
                className={`flex-1 rounded-xl border px-3 py-2 font-medium text-sm transition-colors disabled:opacity-50 ${
                  currentFrequencyKey === f.key
                    ? 'border-[--primary-color] bg-[--mc-green-soft] text-[--primary-color]'
                    : 'border-gray-200 text-gray-700 hover:border-[--primary-color]'
                }`}
                disabled={busy !== null || currentFrequencyKey === f.key}
                key={f.key}
                onClick={() =>
                  run(
                    `freq-${f.key}`,
                    () =>
                      updateRecurringOrder(ro.id, {
                        frequency_interval: f.interval,
                        frequency_count: f.count,
                      }),
                    'Frecuencia actualizada.',
                  )
                }
                type='button'
              >
                {busy === `freq-${f.key}` ? 'Guardando…' : f.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Items */}
      <div className='rounded-2xl border border-gray-200 bg-white p-4 sm:p-5'>
        <div className='flex items-center justify-between gap-3'>
          <h3 className='flex items-center gap-2 font-semibold text-gray-900 text-sm'>
            <PackageOpen className='h-4 w-4 text-gray-400' /> Productos
          </h3>
          {ro.status !== 'cancelled' && ro.status !== 'completed' && (
            <button
              className='rounded-lg border border-gray-200 px-3 py-1.5 font-semibold text-gray-700 text-xs hover:border-[--primary-color]'
              disabled={busy !== null}
              onClick={() =>
                run(
                  'items',
                  () => updateRecurringOrder(ro.id, {
                    items: (ro.items ?? []).map((item) => ({
                      id: item.id,
                      variant_id: item.variant_id,
                      quantity: quantities[item.id] ?? item.quantity,
                    })),
                  }),
                  'Cantidades actualizadas.',
                )
              }
              type='button'
            >
              {busy === 'items' ? 'Guardando…' : 'Guardar cantidades'}
            </button>
          )}
        </div>
        <ul className='mt-3 divide-y divide-gray-100'>
          {(ro.items ?? []).map((item) => (
            <li className='flex items-center gap-3 py-2.5' key={item.id}>
              <ProductImage
                alt={item.product_snapshot?.title ?? 'Producto'}
                className='h-12 w-12 rounded-lg border border-gray-100 object-cover'
                height={48}
                src={item.product_snapshot?.thumbnail}
                width={48}
              />
              <div className='min-w-0 flex-1'>
                <p className='truncate font-medium text-gray-900 text-sm'>
                  {item.product_snapshot?.handle ? (
                    <LocalizedClientLink
                      className='hover:text-[--primary-color]'
                      href={`/products/${item.product_snapshot.handle}`}
                    >
                      {item.product_snapshot?.title ?? 'Producto'}
                    </LocalizedClientLink>
                  ) : (
                    (item.product_snapshot?.title ?? 'Producto')
                  )}
                </p>
                {item.product_snapshot?.variant_title &&
                  item.product_snapshot.variant_title !== 'Default variant' && (
                    <p className='text-gray-500 text-xs'>
                      {item.product_snapshot.variant_title}
                    </p>
                  )}
              </div>
              {ro.status !== 'cancelled' && ro.status !== 'completed' ? (
                <div className='flex shrink-0 items-center rounded-lg border border-gray-200'>
                  <button
                    aria-label={`Reducir cantidad de ${item.product_snapshot?.title ?? 'producto'}`}
                    className='h-8 w-8 text-gray-600 disabled:opacity-40'
                    disabled={(quantities[item.id] ?? item.quantity) <= 1 || busy !== null}
                    onClick={() => setQuantities((current) => ({
                      ...current,
                      [item.id]: Math.max(1, (current[item.id] ?? item.quantity) - 1),
                    }))}
                    type='button'
                  >−</button>
                  <span className='min-w-7 text-center text-gray-700 text-sm'>
                    {quantities[item.id] ?? item.quantity}
                  </span>
                  <button
                    aria-label={`Aumentar cantidad de ${item.product_snapshot?.title ?? 'producto'}`}
                    className='h-8 w-8 text-gray-600 disabled:opacity-40'
                    disabled={busy !== null}
                    onClick={() => setQuantities((current) => ({
                      ...current,
                      [item.id]: (current[item.id] ?? item.quantity) + 1,
                    }))}
                    type='button'
                  >+</button>
                </div>
              ) : (
                <span className='shrink-0 text-gray-500 text-sm'>×{item.quantity}</span>
              )}
            </li>
          ))}
        </ul>
        <p className='mt-2 text-gray-400 text-xs'>
          Cada entrega usa los precios y promociones vigentes al momento de
          generarse.
        </p>
      </div>

      {/* Dirección */}
      <div className='rounded-2xl border border-gray-200 bg-white p-4 sm:p-5'>
        <div className='flex items-center justify-between gap-3'>
          <h3 className='flex items-center gap-2 font-semibold text-gray-900 text-sm'>
            <MapPin className='h-4 w-4 text-gray-400' /> Dirección de entrega
          </h3>
          {ro.status !== 'cancelled' && ro.status !== 'completed' && (
            <button
              className='rounded-lg border border-gray-200 px-3 py-1.5 font-semibold text-gray-700 text-xs hover:border-[--primary-color]'
              onClick={() => setEditingAddress((value) => !value)}
              type='button'
            >
              {editingAddress ? 'Cerrar' : 'Editar'}
            </button>
          )}
        </div>
        {editingAddress ? (
          <div className='mt-3 grid gap-3 sm:grid-cols-2'>
            {([
              ['first_name', 'Nombre'], ['last_name', 'Apellido'],
              ['address_1', 'Calle y número'], ['address_2', 'Piso / departamento'],
              ['city', 'Ciudad'], ['province', 'Provincia'],
              ['postal_code', 'Código postal'], ['phone', 'Teléfono'],
            ] as const).map(([field, label]) => (
              <label className='text-gray-600 text-xs' key={field}>
                {label}
                <input
                  className='mt-1 h-10 w-full rounded-xl border border-gray-300 px-3 text-gray-900 text-sm'
                  onChange={(event) => setAddressDraft((current) => ({
                    ...current,
                    [field]: event.target.value,
                  }))}
                  value={addressDraft[field]}
                />
              </label>
            ))}
            <button
              className='sm:col-span-2 rounded-xl bg-[--primary-color] px-4 py-2.5 font-semibold text-sm text-white disabled:opacity-50'
              disabled={busy !== null || !addressDraft.address_1.trim()}
              onClick={() =>
                run(
                  'address',
                  () => updateRecurringOrder(ro.id, { shipping_address: addressDraft }),
                  'Dirección actualizada.',
                ).then(() => setEditingAddress(false))
              }
              type='button'
            >
              {busy === 'address' ? 'Guardando…' : 'Guardar dirección'}
            </button>
          </div>
        ) : (
          <>
            <p className='mt-2 text-gray-700 text-sm'>
              {[address?.address_1, address?.address_2].filter(Boolean).join(' ')}
            </p>
            <p className='text-gray-500 text-sm'>
              {[address?.city, address?.province, address?.postal_code]
                .filter(Boolean)
                .join(', ')}
            </p>
          </>
        )}
      </div>

      {/* Historial de renovaciones */}
      <div className='rounded-2xl border border-gray-200 bg-white p-4 sm:p-5'>
        <h3 className='font-semibold text-gray-900 text-sm'>Historial de entregas</h3>
        {(ro.cycles ?? []).length ? (
          <ul className='mt-3 divide-y divide-gray-100'>
            {(ro.cycles ?? []).map((cycle) => {
              const cycleStatus = CYCLE_LABELS[cycle.status] ?? CYCLE_LABELS.scheduled
              return (
                <li
                  className='flex flex-wrap items-center justify-between gap-2 py-2.5'
                  key={cycle.id}
                >
                  <div>
                    <p className='font-medium text-gray-900 text-sm'>
                      {formatDate(cycle.scheduled_at)}
                    </p>
                    {cycle.status === 'failed' && cycle.last_error === 'payment_link_expired' && (
                      <button
                        className='font-semibold text-[--primary-color] text-xs hover:underline disabled:opacity-50'
                        disabled={busy !== null}
                        onClick={() =>
                          run(
                            `regen-${cycle.id}`,
                            async () => {
                              const result = await regenerateRenewalLink(ro.id, cycle.id)
                              if (result.confirmation_url) {
                                window.location.href = result.confirmation_url
                              }
                              return result
                            },
                            'Link nuevo generado.',
                          )
                        }
                        type='button'
                      >
                        {busy === `regen-${cycle.id}`
                          ? 'Generando…'
                          : 'El link venció — generar uno nuevo'}
                      </button>
                    )}
                  </div>
                  <div className='flex items-center gap-2'>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-semibold text-xs ${cycleStatus.className}`}
                    >
                      {cycleStatus.label}
                    </span>
                    {cycle.status === 'pending_payment' && cycle.confirmation_url && (
                      <a
                        className='font-semibold text-[--primary-color] text-xs hover:underline'
                        href={cycle.confirmation_url}
                      >
                        Pagar
                      </a>
                    )}
                    {cycle.generated_order_id && (
                      <LocalizedClientLink
                        className='font-semibold text-[--primary-color] text-xs hover:underline'
                        href={`/account/orders/details/${cycle.generated_order_id}`}
                      >
                        Ver pedido
                      </LocalizedClientLink>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className='mt-2 text-gray-500 text-sm'>Todavía no hay entregas.</p>
        )}
      </div>
    </div>
  )
}
