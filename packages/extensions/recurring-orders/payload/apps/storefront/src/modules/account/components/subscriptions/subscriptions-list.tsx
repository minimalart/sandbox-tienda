'use client'

import type { RecurringOrder } from '@lib/data/recurring-orders'
import LocalizedClientLink from '@modules/common/components/localized-client-link'
import { ChevronRight, Repeat } from 'lucide-react'
import { formatDate, frequencyLabel, STATUS_LABELS } from './helpers'

/**
 * Listado de "Mis compras recurrentes": una card por suscripción con estado,
 * frecuencia, próxima entrega y acceso al detalle. Si hay un pago pendiente,
 * el CTA lleva directo al link de confirmación.
 */
export default function SubscriptionsList({
  recurringOrders,
}: {
  recurringOrders: RecurringOrder[]
}) {
  if (!recurringOrders.length) {
    return (
      <div className='rounded-2xl border border-gray-200 bg-white p-8 text-center'>
        <span className='mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[--mc-green-soft]'>
          <Repeat className='h-6 w-6 text-[--primary-color]' strokeWidth={2} />
        </span>
        <h3 className='mt-3 font-semibold text-gray-900'>
          Todavía no tenés compras recurrentes
        </h3>
        <p className='mx-auto mt-1 max-w-sm text-gray-500 text-sm'>
          Suscribite a un producto desde su página, o convertí tu carrito en una
          compra recurrente, y recibilo sin tener que volver a pedirlo.
        </p>
        <LocalizedClientLink
          className='mt-4 inline-flex min-h-[40px] items-center rounded-xl bg-[--primary-color] px-4 py-2 font-semibold text-sm text-white'
          href='/store'
        >
          Explorar productos
        </LocalizedClientLink>
      </div>
    )
  }

  return (
    <div className='flex flex-col gap-4'>
      {recurringOrders.map((ro) => {
        const status = STATUS_LABELS[ro.status] ?? STATUS_LABELS.active
        const items = ro.items ?? []
        const pendingCycle = (ro.cycles ?? []).find(
          (c) => c.status === 'pending_payment' && c.confirmation_url,
        )
        const itemsSummary = items
          .map((i) => i.product_snapshot?.title ?? 'Producto')
          .slice(0, 3)
          .join(', ')
        return (
          <div
            className='rounded-2xl border border-gray-200 bg-white p-4 sm:p-5'
            key={ro.id}
          >
            <div className='flex items-start justify-between gap-3'>
              <div className='min-w-0'>
                <div className='flex flex-wrap items-center gap-2'>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-semibold text-xs ${status.className}`}
                  >
                    {status.label}
                  </span>
                  <span className='text-gray-500 text-xs'>
                    {frequencyLabel(ro.frequency_interval, ro.frequency_count)}
                  </span>
                </div>
                <p className='mt-2 truncate font-semibold text-gray-900 text-sm'>
                  {itemsSummary || 'Suscripción'}
                  {items.length > 3 ? ` y ${items.length - 3} más` : ''}
                </p>
                <p className='mt-0.5 text-gray-500 text-xs'>
                  {ro.status === 'pending_payment'
                    ? 'Hay una entrega esperando tu confirmación.'
                    : ro.status === 'active'
                      ? `Próxima entrega: ${formatDate(ro.next_execution_at)}`
                      : ro.last_execution_at
                        ? `Última entrega: ${formatDate(ro.last_execution_at)}`
                        : `Creada el ${formatDate(ro.created_at)}`}
                </p>
              </div>
              <LocalizedClientLink
                aria-label='Ver detalle'
                className='flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-50 hover:text-[--primary-color]'
                href={`/account/subscriptions/${ro.id}`}
              >
                <ChevronRight className='h-5 w-5' />
              </LocalizedClientLink>
            </div>

            {pendingCycle?.confirmation_url && (
              <a
                className='mt-3 block w-full rounded-xl bg-[--primary-color] px-4 py-2.5 text-center font-semibold text-sm text-white transition-opacity hover:opacity-90'
                href={pendingCycle.confirmation_url}
              >
                Confirmar y pagar esta entrega
              </a>
            )}
          </div>
        )
      })}
    </div>
  )
}
