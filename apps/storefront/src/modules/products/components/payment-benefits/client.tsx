'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useScrollLock } from '@lib/hooks/use-scroll-lock'
import { convertToLocale } from '@lib/util/money'
import type {
  PaymentMethodOption,
  PublicPaymentBenefit,
} from '@lib/data/payment-benefits'

type Props = {
  benefits: PublicPaymentBenefit[]
  methods: PaymentMethodOption[]
  amount?: number
  currencyCode: string
}

const SOURCE_LABEL: Record<string, string> = {
  mercadopago: 'Mercado Pago',
  modo: 'MODO',
  manual: '',
}

const TYPE_LABEL: Record<string, string> = {
  credit_card: 'Tarjetas de crédito',
  debit_card: 'Tarjetas de débito',
  prepaid_card: 'Tarjetas prepagas',
  ticket: 'Efectivo',
  atm: 'Cajero',
  bank_transfer: 'Transferencia / débito',
  account_money: 'Dinero en cuenta',
  digital_wallet: 'Billetera',
  digital_currency: 'Otros',
}

/** Logo (o pill con inicial si no hay imagen). */
const MethodLogo = ({ m, size = 'sm' }: { m: PaymentMethodOption; size?: 'sm' | 'md' }) => {
  const cls = size === 'md' ? 'h-7' : 'h-5'
  if (m.thumbnail_url) {
    return (
      <img
        src={m.thumbnail_url}
        alt={m.name}
        title={m.name}
        className={`${cls} w-auto rounded-[3px] object-contain`}
        loading="lazy"
      />
    )
  }
  return (
    <span
      title={m.name}
      className={`inline-flex ${size === 'md' ? 'h-7 px-2' : 'h-5 px-1.5'} items-center rounded-[3px] bg-gray-100 text-[10px] font-medium text-gray-500`}
    >
      {m.name.slice(0, 10)}
    </span>
  )
}

const PaymentBenefitsClient = ({ benefits, methods, amount, currencyCode }: Props) => {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  useScrollLock(open)

  const methodById = useMemo(() => {
    const map = new Map<string, PaymentMethodOption>()
    for (const m of methods) map.set(m.external_id, m)
    return map
  }, [methods])

  const creditCards = useMemo(
    () => methods.filter((m) => m.payment_type_id === 'credit_card'),
    [methods],
  )

  const fmt = (n: number) =>
    `$${convertToLocale({ amount: n, currency_code: currencyCode })}`

  /** Logos asociados a un beneficio (tarjeta puntual o el set de crédito). */
  const logosFor = (b: PublicPaymentBenefit): PaymentMethodOption[] => {
    const specific = b.conditions?.payment_method ?? b.conditions?.card_brand
    if (specific && methodById.has(specific)) return [methodById.get(specific)!]
    if (b.benefit_type === 'installments') return creditCards.slice(0, 5)
    return []
  }

  /** Título + subtítulo (con cálculo de cuota) por tipo de beneficio. */
  const render = (b: PublicPaymentBenefit): { main: string; sub?: string } => {
    switch (b.benefit_type) {
      case 'installments': {
        const n = b.max_installments ?? 0
        const main = n > 1 ? `${n} cuotas sin interés` : b.title
        const sub =
          n > 1 && amount && amount > 0 ? `de ${fmt(amount / n)}` : undefined
        return { main, sub }
      }
      case 'percentage_discount':
        return {
          main: b.discount_value != null ? `${b.discount_value}% OFF` : b.title,
          sub: b.title,
        }
      case 'fixed_discount':
        return {
          main: b.discount_value != null ? `${fmt(b.discount_value)} de descuento` : b.title,
          sub: b.title,
        }
      case 'refund':
        return {
          main: b.max_refund != null ? `Reintegro de hasta ${fmt(b.max_refund)}` : b.title,
          sub: b.title,
        }
      case 'cashback':
        return {
          main: b.discount_value != null ? `${b.discount_value}% de cashback` : b.title,
          sub: b.title,
        }
      default:
        return { main: b.title, sub: b.description ?? undefined }
    }
  }

  const grouped = useMemo(() => {
    const g = new Map<string, PaymentMethodOption[]>()
    for (const m of methods) {
      const key = m.payment_type_id ?? 'digital_currency'
      if (!g.has(key)) g.set(key, [])
      g.get(key)!.push(m)
    }
    return Array.from(g.entries())
  }, [methods])

  const BenefitRow = ({ b }: { b: PublicPaymentBenefit }) => {
    const { main, sub } = render(b)
    const logos = logosFor(b)
    const source = SOURCE_LABEL[b.source] ?? b.source
    return (
      <li className="flex items-start gap-2.5 py-2">
        <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
          <path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 011.4-1.4l3.3 3.3 6.8-6.8a1 1 0 011.4 0z" clipRule="evenodd" />
        </svg>
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-tight text-gray-900">
            <span className="font-semibold">{main}</span>
            {sub ? <span className="text-gray-600"> {sub}</span> : null}
          </p>
          {logos.length > 0 && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {logos.map((m) => (
                <MethodLogo key={m.external_id} m={m} />
              ))}
            </div>
          )}
          {source ? <p className="mt-0.5 text-[11px] text-gray-400">{source}</p> : null}
        </div>
      </li>
    )
  }

  const modal = open && mounted
    ? createPortal(
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center" role="dialog" aria-modal>
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative z-10 max-h-[85vh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">Medios de pago</h3>
              <button onClick={() => setOpen(false)} className="rounded-full p-1 text-gray-500 hover:bg-gray-100" aria-label="Cerrar">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              {grouped.map(([type, list]) => (
                <div key={type}>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
                    {TYPE_LABEL[type] ?? 'Otros'}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    {list.map((m) => (
                      <div key={m.external_id} className="flex items-center gap-1.5 rounded-lg border border-gray-100 px-2 py-1.5">
                        <MethodLogo m={m} size="md" />
                        <span className="text-xs text-gray-600">{m.name}</span>
                        {m.max_interest_free_installments && m.max_interest_free_installments > 1 ? (
                          <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                            {m.max_interest_free_installments} c/ s/interés
                          </span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>,
        document.body,
      )
    : null

  return (
    <section className="mt-6 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold text-gray-900">Beneficios y medios de pago</h2>
      {benefits.length > 0 ? (
        <ul className="divide-y divide-gray-100">
          {benefits.map((b) => (
            <BenefitRow key={b.id} b={b} />
          ))}
        </ul>
      ) : (
        <p className="py-2 text-sm text-gray-500">Consultá todos los medios de pago disponibles.</p>
      )}

      {methods.length > 0 && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-2 text-sm font-medium text-[#1E8BB4] hover:underline"
        >
          Ver todos los medios de pago
        </button>
      )}
      {modal}
    </section>
  )
}

export default PaymentBenefitsClient
