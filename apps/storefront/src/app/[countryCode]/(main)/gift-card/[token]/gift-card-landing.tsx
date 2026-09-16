'use client'

import { giftCardDesignImage } from '@lib/util/gift-card-design'
import { CheckCircle2, Gift, Loader2, ShoppingBag } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

type GiftCard = {
  design: { desktop_image_url?: string; text_color?: string }
  recipient_name?: string | null
  sender_name?: string | null
  anonymous: boolean
  message?: string | null
  value: number
  currency_code: string
  expires_at?: string | null
  masked_code: string
}

const formatMoney = (value: number, currency: string) => new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: currency.toUpperCase(), maximumFractionDigits: 0,
}).format(value)

export default function GiftCardLanding({ token }: { token: string }) {
  const params = useParams()
  const countryCode = String(params.countryCode ?? 'ar')
  const [card, setCard] = useState<GiftCard | null>(null)
  const [state, setState] = useState<'loading' | 'auth' | 'claiming' | 'claimed' | 'unavailable'>('loading')

  useEffect(() => {
    let active = true
    async function loadAndClaim() {
      const detailResponse = await fetch(`/api/store/gift-card-experience/landing/${encodeURIComponent(token)}`, { cache: 'no-store' })
      if (!detailResponse.ok) {
        // A repeated claim by the same authenticated customer is intentionally
        // idempotent even though the public detail endpoint no longer exposes it.
        const repeatedClaim = await fetch(`/api/store/gift-card-experience/landing/${encodeURIComponent(token)}`, { method: 'POST', cache: 'no-store' })
        if (active) setState(repeatedClaim.ok ? 'claimed' : 'unavailable')
        return
      }
      const detail = await detailResponse.json() as { gift_card: GiftCard }
      if (!active) return
      setCard(detail.gift_card)
      setState('claiming')
      const claimResponse = await fetch(`/api/store/gift-card-experience/landing/${encodeURIComponent(token)}`, { method: 'POST', cache: 'no-store' })
      if (!active) return
      if (claimResponse.status === 401) setState('auth')
      else if (claimResponse.ok) setState('claimed')
      else setState('unavailable')
    }
    void loadAndClaim()
    return () => { active = false }
  }, [token])

  if (state === 'loading') return <main className='flex min-h-[60vh] items-center justify-center'><Loader2 className='h-8 w-8 animate-spin text-[--primary-color]' /></main>
  if (state === 'claimed' && !card) return <main className='mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 text-center'><CheckCircle2 className='h-12 w-12 text-[--primary-color]' /><h1 className='mt-4 text-2xl font-bold'>Este saldo ya está acreditado en tu cuenta</h1><a className='mt-6 rounded-xl bg-[var(--primary-color)] px-6 py-3 font-bold text-white' href={`/${countryCode}/account/gift-cards`}>Ver mi billetera</a></main>
  if (state === 'unavailable' || !card) return <main className='mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 text-center'><Gift className='h-12 w-12 text-slate-300' /><h1 className='mt-4 text-2xl font-bold'>Esta gift card no está disponible</h1><p className='mt-2 text-slate-500'>El enlace puede haber vencido o ya haber sido utilizado.</p></main>

  const returnTo = `/${countryCode}/gift-card/${encodeURIComponent(token)}`
  const designImage = giftCardDesignImage(card.design.desktop_image_url)
  return (
    <main className='mx-auto max-w-3xl px-4 py-10 sm:py-16'>
      <div className='overflow-hidden rounded-[30px] border border-gray-200 bg-white shadow-xl'>
        {/* Sin imagen propia del diseño, el fondo es el degradado del color
            primario del tenant: el SVG de respaldo traía el verde y el wordmark
            de Mercatto quemados y se veía en cualquier tienda. */}
        <div className='relative aspect-[1.9/1] bg-[--primary-color]'>{designImage ? <>{/* eslint-disable-next-line @next/next/no-img-element */}<img alt='' className='absolute inset-0 h-full w-full object-cover' src={designImage} /></> : <div className='absolute inset-0' style={{ backgroundImage: 'linear-gradient(135deg, color-mix(in srgb, var(--primary-color) 82%, black) 0%, var(--primary-color) 55%, color-mix(in srgb, var(--primary-color) 55%, white) 100%)' }} />}<div className='absolute inset-0 flex flex-col items-center justify-center p-8 text-center' style={{ color: card.design.text_color ?? '#fff' }}><p className='text-sm font-bold uppercase tracking-[.25em]'>Un regalo para vos</p><p className='mt-4 text-4xl font-black'>{formatMoney(card.value, card.currency_code)}</p><p className='mt-2 font-mono text-sm'>{card.masked_code}</p></div></div>
        <div className='p-6 text-center sm:p-10'>
          <h1 className='text-2xl font-bold text-slate-950'>{card.anonymous ? 'Alguien te envió un regalo' : `${card.sender_name || 'Alguien especial'} te envió un regalo`}</h1>
          {card.message && <p className='mx-auto mt-4 max-w-xl whitespace-pre-wrap text-lg text-slate-600'>“{card.message}”</p>}
          {card.expires_at && <p className='mt-4 text-xs text-slate-400'>Disponible para reclamar hasta {new Intl.DateTimeFormat('es-AR', { dateStyle: 'long' }).format(new Date(card.expires_at))}.</p>}
          {state === 'auth' && <a className='mt-8 inline-flex items-center justify-center rounded-xl bg-[var(--primary-color)] px-6 py-3 font-bold text-white' href={`/${countryCode}/account?returnTo=${encodeURIComponent(returnTo)}`}>Ingresar o crear mi cuenta</a>}
          {state === 'claiming' && <p className='mt-8 inline-flex items-center gap-2 font-semibold text-[--primary-color]'><Loader2 className='h-5 w-5 animate-spin' /> Acreditando tu saldo…</p>}
          {state === 'claimed' && <div className='mt-8'><p className='inline-flex items-center gap-2 font-bold text-[--primary-color]'><CheckCircle2 className='h-6 w-6' /> Saldo acreditado en tu cuenta</p><div className='mt-6 flex flex-col justify-center gap-3 sm:flex-row'><a className='inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--primary-color)] px-6 py-3 font-bold text-white' href={`/${countryCode}/store`}><ShoppingBag className='h-4 w-4' /> Comprar ahora</a><a className='rounded-xl border border-gray-200 px-6 py-3 font-bold' href={`/${countryCode}/account/gift-cards`}>Ver mi billetera</a></div></div>}
        </div>
      </div>
    </main>
  )
}
