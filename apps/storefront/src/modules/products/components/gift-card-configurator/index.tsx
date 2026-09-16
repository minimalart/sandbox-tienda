'use client'

import { useCartStore } from '@lib/stores/cart.store'
import { useTenantBrand } from '@lib/site-config/context'
import { giftCardDesignImage } from '@lib/util/gift-card-design'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { HttpTypes } from '@medusajs/types'
import { toast } from '@medusajs/ui'
import { giftCardConfigV1Schema } from '@repo/shared'
import { CalendarDays, Check, Clock, Gift, Maximize2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { es } from 'react-day-picker/locale'
import { checkVariantInStock } from '../product-actions/use-variant-selection'

/** Local YYYY-MM-DD (avoids the UTC shift of Date.prototype.toISOString). */
function toISODate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const deliveryWindows = [
  { value: 'morning', label: 'Mañana · 09:00' },
  { value: 'afternoon', label: 'Tarde · 14:00' },
  { value: 'evening', label: 'Noche · 19:00' },
] as const

type Design = {
  id: string
  name: string
  occasion: string
  desktop_image_url: string
  mobile_image_url?: string | null
  text_color: string
  content_position: string
}

type Props = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  countryCode: string
}

/**
 * Diseño de respaldo, el que se ve mientras `/designs` no contestó y el único
 * que queda si el merchant no cargó ninguno.
 *
 * `desktop_image_url` va VACÍO a propósito: antes apuntaba a un SVG con el verde
 * y el wordmark de Mercatto hardcodeados, así que en cualquier otra tienda la
 * vista previa mostraba una tarjeta verde con la marca ajena. Sin imagen, se
 * pinta el degradado derivado de `--primary-color` (ver `BrandCanvas`), que sí
 * sigue el branding del tenant.
 */
const defaultDesign: Design = {
  id: 'brand-default',
  name: 'Diseño de marca',
  occasion: 'brand',
  desktop_image_url: '',
  mobile_image_url: null,
  text_color: '#FFFFFF',
  content_position: 'center',
}

/**
 * Fondo de la tarjeta. Con imagen cargada por el admin, la imagen; sin ella, un
 * degradado construido con el color primario del tenant (oscuro → primario →
 * claro), que es lo que hace que la gift card se vea "de la tienda".
 */
function CardBackground({ src, className = '' }: { src?: string | null; className?: string }) {
  const image = giftCardDesignImage(src)
  if (image) {
    // Admin URLs are constrained to HTTP(S) or internal paths by the backend.
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt='' className={`h-full w-full object-cover ${className}`} src={image} />
  }
  return (
    <div
      className={`h-full w-full ${className}`}
      style={{
        backgroundImage:
          'linear-gradient(135deg, color-mix(in srgb, var(--primary-color) 82%, black) 0%, var(--primary-color) 55%, color-mix(in srgb, var(--primary-color) 55%, white) 100%)',
      }}
    />
  )
}

const positionClass: Record<string, string> = {
  top_left: 'items-start justify-start text-left', top_center: 'items-start justify-center text-center',
  top_right: 'items-start justify-end text-right', center_left: 'items-center justify-start text-left',
  center: 'items-center justify-center text-center', center_right: 'items-center justify-end text-right',
  bottom_left: 'items-end justify-start text-left', bottom_center: 'items-end justify-center text-center',
  bottom_right: 'items-end justify-end text-right',
}

function amountOf(variant: HttpTypes.StoreProductVariant): number {
  return Number(variant.calculated_price?.calculated_amount ?? 0)
}

function money(amount: number, currency: string): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: currency.toUpperCase(), maximumFractionDigits: 0 }).format(amount)
}

function Preview({ design, brandName, recipientName, senderName, anonymous, message, amount, currency, scheduled, fullscreen, close }: {
  design: Design; brandName: string; recipientName: string; senderName: string; anonymous: boolean; message: string;
  amount: number; currency: string; scheduled: string; fullscreen?: boolean; close?: () => void
}) {
  return (
    <div className={fullscreen ? 'fixed inset-0 z-[100] flex items-center bg-gray-950/90 p-4' : 'sticky top-24'}>
      {close && <button aria-label='Cerrar vista previa' className='absolute right-5 top-5 rounded-full bg-white p-2 text-gray-900' onClick={close}><X /></button>}
      <div className='w-full'>
        <div className='relative aspect-[1.58/1] w-full overflow-hidden rounded-[28px] bg-gray-900 shadow-2xl'>
          <div className='absolute inset-0'>
            <CardBackground src={design.desktop_image_url} />
          </div>
          {/* El wordmark sólo va sobre el degradado de marca: los diseños que
              sube el merchant ya traen su propia identidad en la imagen. */}
          {!giftCardDesignImage(design.desktop_image_url) && brandName && (
            <p className='absolute left-7 top-6 font-bold text-xs uppercase tracking-[0.26em] text-white/90 sm:left-10' >{brandName}</p>
          )}
          <div className={`absolute inset-0 flex p-7 sm:p-10 ${positionClass[design.content_position] ?? positionClass.center}`} style={{ color: design.text_color }}>
            <div className='max-w-[82%] drop-shadow-md'>
              <p className='text-xs font-semibold uppercase tracking-[0.24em]'>Gift Card</p>
              <p className='mt-3 text-2xl font-bold sm:text-4xl'>{recipientName ? `Para ${recipientName}` : 'Un regalo para vos'}</p>
              {message && <p className='mt-3 line-clamp-3 text-sm sm:text-base'>{message}</p>}
              <p className='mt-5 text-xl font-bold sm:text-3xl'>{money(amount, currency)}</p>
              <p className='mt-2 text-xs opacity-90'>{anonymous ? 'Un regalo anónimo' : senderName ? `De ${senderName}` : 'De alguien especial'}{scheduled ? ` · ${scheduled}` : ''}</p>
            </div>
          </div>
        </div>
        {!fullscreen && <p className='mt-4 text-center text-sm text-gray-500'>La vista previa se congela al confirmar la compra.</p>}
      </div>
    </div>
  )
}

export default function GiftCardConfigurator({ product, region, countryCode }: Props) {
  const variants = (product.variants ?? []).filter(checkVariantInStock)
  const [variantId, setVariantId] = useState(variants[0]?.id ?? '')
  const [designs, setDesigns] = useState<Design[]>([defaultDesign])
  const [designId, setDesignId] = useState(defaultDesign.id)
  const [mode, setMode] = useState<'self' | 'recipient'>('recipient')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [senderName, setSenderName] = useState('')
  const [anonymous, setAnonymous] = useState(false)
  const [message, setMessage] = useState('')
  const [deliveryType, setDeliveryType] = useState<'now' | 'scheduled'>('now')
  const [date, setDate] = useState('')
  const [deliveryWindow, setDeliveryWindow] = useState<'morning' | 'afternoon' | 'evening'>('morning')
  const [previewOpen, setPreviewOpen] = useState(false)
  const addItem = useCartStore((state) => state.addItem)
  const pending = useCartStore((state) => state.pendingAdditions)
  // Nombre de la tienda activa, para el wordmark del diseño de marca.
  const { name: brandName } = useTenantBrand()

  useEffect(() => {
    fetch('/api/store/gift-card-experience/designs')
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data: { designs?: Design[] }) => {
        if (data.designs?.length) {
          setDesigns(data.designs)
          setDesignId(data.designs[0]!.id)
        }
      })
      .catch(() => undefined)
  }, [])

  const variant = variants.find((candidate) => candidate.id === variantId) ?? variants[0]
  const design = designs.find((candidate) => candidate.id === designId) ?? designs[0] ?? defaultDesign
  const amount = variant ? amountOf(variant) : 0
  const currency = variant?.calculated_price?.currency_code ?? region.currency_code
  const isAdding = variant ? pending.has(variant.id) : false
  const scheduledLabel = deliveryType === 'scheduled' && date ? new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium' }).format(new Date(`${date}T12:00:00`)) : ''
  // La entrega se puede programar desde mañana y hasta un año hacia adelante.
  const minDate = useMemo(() => new Date(Date.now() + 86_400_000), [])
  const maxDate = useMemo(() => new Date(Date.now() + 365 * 86_400_000), [])
  const selectedDate = date ? new Date(`${date}T12:00:00`) : undefined

  const submit = async () => {
    if (!variant) return
    const parsedConfig = giftCardConfigV1Schema.safeParse({
      version: 1 as const,
      delivery_mode: mode,
      design_id: design.id,
      ...(mode === 'recipient' ? {
        recipient_email: recipientEmail.trim().toLowerCase(),
        ...(recipientName.trim() ? { recipient_name: recipientName.trim() } : {}),
      } : {}),
      ...(senderName.trim() ? { sender_name: senderName.trim() } : {}),
      anonymous,
      ...(message.trim() ? { message: message.trim() } : {}),
      delivery: deliveryType === 'now' ? { type: 'now' as const } : { type: 'scheduled' as const, date, window: deliveryWindow },
    })
    if (!parsedConfig.success) {
      toast.error(parsedConfig.error.issues[0]?.message ?? 'Revisá los datos del regalo.')
      return
    }
    const giftCardConfig = parsedConfig.data
    const success = await addItem(variant.id, 1, countryCode, product.id, {
      gift_card_config: giftCardConfig,
      gift_configuration_id: crypto.randomUUID(),
    }, {
      title: product.title, handle: product.handle,
      // El diseño de marca no tiene imagen (es un degradado CSS), así que la
      // línea del carrito cae en la foto del producto.
      thumbnail:
        giftCardDesignImage(design.desktop_image_url) ?? product.thumbnail ?? undefined,
      unitPrice: amount, currencyCode: currency,
    })
    if (success) {
      toast.success('Gift card agregada al carrito.')
      const gtag = (window as typeof window & { gtag?: (...args: unknown[]) => void }).gtag
      gtag?.('event', 'gift_card_add_to_cart', {
        design_id: design.id, value: amount, currency: currency.toUpperCase(), delivery_mode: mode,
      })
    }
  }

  return (
    <main className='mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-14'>
      <div className='mb-8 text-center lg:text-left'>
        <span className='inline-flex items-center gap-2 rounded-full bg-[--mc-green-pale] px-3 py-1 text-sm font-semibold text-[--primary-color-dark]'><Gift className='h-4 w-4' /> Regalo digital</span>
        <h1 className='mt-4 text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl'>{product.title}</h1>
        <p className='mx-auto mt-2 max-w-2xl text-gray-600 lg:mx-0'>Elegí el diseño, el monto y cuándo querés que llegue. Nosotros nos ocupamos del resto.</p>
      </div>
      <div className='grid gap-10 lg:grid-cols-[minmax(0,1.08fr)_minmax(380px,.92fr)]'>
        <div className='relative'>
          <Preview amount={amount} anonymous={anonymous} brandName={brandName} currency={currency} design={design} message={message} recipientName={mode === 'self' ? '' : recipientName} scheduled={scheduledLabel} senderName={senderName} />
          <button className='mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 py-3 text-sm font-semibold lg:hidden' onClick={() => setPreviewOpen(true)} type='button'><Maximize2 className='h-4 w-4' /> Ver en pantalla completa</button>
        </div>
        <div className='space-y-7 rounded-[28px] border border-gray-200 bg-white p-5 shadow-sm sm:p-8'>
          <section><h2 className='text-base font-bold'><span className='mr-2 text-[--primary-color]'>1.</span>Elegí un diseño</h2><div className='mt-3 grid grid-cols-3 gap-3'>{designs.map((item) => <button aria-pressed={item.id === design.id} className={`overflow-hidden rounded-xl border-2 text-left ${item.id === design.id ? 'border-[--primary-color]' : 'border-transparent'}`} key={item.id} onClick={() => setDesignId(item.id)} type='button'><span className='relative block aspect-[1.58/1] bg-gray-100'><CardBackground src={item.desktop_image_url} />{item.id === design.id && <Check className='absolute right-1 top-1 h-5 w-5 rounded-full bg-[--primary-color] p-1 text-white' />}</span><span className='block truncate px-1 py-1 text-xs font-medium'>{item.name}</span></button>)}</div></section>
          <section><h2 className='text-base font-bold'><span className='mr-2 text-[--primary-color]'>2.</span>Elegí el monto</h2><div className='mt-3 flex flex-wrap gap-2'>{variants.map((item) => <button className={`rounded-xl border px-4 py-3 text-sm font-bold transition ${item.id === variant?.id ? 'border-[--primary-color] bg-[--mc-green-pale] text-[--primary-color-dark]' : 'border-gray-200 hover:border-gray-400'}`} key={item.id} onClick={() => setVariantId(item.id)} type='button'>{money(amountOf(item), item.calculated_price?.currency_code ?? currency)}</button>)}</div></section>
          <section><h2 className='text-base font-bold'><span className='mr-2 text-[--primary-color]'>3.</span>¿Para quién es?</h2><div className='mt-3 grid grid-cols-2 gap-2'>{(['self', 'recipient'] as const).map((value) => <button className={`rounded-xl border px-3 py-3 text-sm font-semibold ${mode === value ? 'border-[--primary-color] bg-[--mc-green-pale]' : 'border-gray-200 hover:border-gray-400'}`} key={value} onClick={() => setMode(value)} type='button'>{value === 'self' ? 'Para mí' : 'Para otra persona'}</button>)}</div>{mode === 'recipient' && <div className='mt-4 grid gap-3'><label className='text-sm font-medium'>Email del destinatario *<input className='mt-1 h-11 w-full rounded-xl border border-gray-200 px-3 focus:border-[--primary-color] focus:outline-none focus:ring-1 focus:ring-[--primary-color]' maxLength={254} onChange={(event) => setRecipientEmail(event.target.value)} type='email' value={recipientEmail} /></label><label className='text-sm font-medium'>Nombre del destinatario<input className='mt-1 h-11 w-full rounded-xl border border-gray-200 px-3 focus:border-[--primary-color] focus:outline-none focus:ring-1 focus:ring-[--primary-color]' maxLength={80} onChange={(event) => setRecipientName(event.target.value)} value={recipientName} /></label></div>}</section>
          <section><h2 className='text-base font-bold'><span className='mr-2 text-[--primary-color]'>4.</span>Personalizá el regalo</h2><div className='mt-3 grid gap-3'><label className='text-sm font-medium'>Tu nombre<input className='mt-1 h-11 w-full rounded-xl border border-gray-200 px-3 focus:border-[--primary-color] focus:outline-none focus:ring-1 focus:ring-[--primary-color]' disabled={anonymous} maxLength={80} onChange={(event) => setSenderName(event.target.value)} value={senderName} /></label><label className='flex items-center gap-2 text-sm'><input checked={anonymous} onChange={(event) => setAnonymous(event.target.checked)} type='checkbox' /> Enviar de forma anónima</label><label className='text-sm font-medium'>Mensaje <span className='float-right font-normal text-gray-400'>{message.length}/300</span><textarea className='mt-1 min-h-24 w-full rounded-xl border border-gray-200 p-3 focus:border-[--primary-color] focus:outline-none focus:ring-1 focus:ring-[--primary-color]' maxLength={300} onChange={(event) => setMessage(event.target.value)} value={message} /></label></div></section>
          <section>
            <h2 className='text-base font-bold'><span className='mr-2 text-[--primary-color]'>5.</span>Elegí la entrega</h2>
            <div className='mt-3 grid grid-cols-2 gap-2'>
              <button className={`rounded-xl border px-3 py-3 text-sm font-semibold ${deliveryType === 'now' ? 'border-[--primary-color] bg-[--mc-green-pale]' : 'border-gray-200 hover:border-gray-400'}`} onClick={() => setDeliveryType('now')} type='button'>Ahora</button>
              <button className={`rounded-xl border px-3 py-3 text-sm font-semibold ${deliveryType === 'scheduled' ? 'border-[--primary-color] bg-[--mc-green-pale]' : 'border-gray-200 hover:border-gray-400'}`} onClick={() => setDeliveryType('scheduled')} type='button'><CalendarDays className='mr-1 inline h-4 w-4' /> Programar</button>
            </div>
            {deliveryType === 'scheduled' && (
              <Card className='mt-3 w-fit overflow-hidden rounded-2xl'>
                <CardContent className='p-0'>
                  <Calendar
                    className='p-3'
                    disabled={{ before: minDate, after: maxDate }}
                    locale={es}
                    mode='single'
                    onSelect={(next) => setDate(next ? toISODate(next) : '')}
                    selected={selectedDate}
                    startMonth={minDate}
                    endMonth={maxDate}
                  />
                </CardContent>
                <CardFooter className='flex-col items-stretch gap-2 border-t bg-card p-3'>
                  <label className='text-sm font-medium' htmlFor='gift-card-window'>Horario de entrega</label>
                  <Select onValueChange={(value) => setDeliveryWindow(value as typeof deliveryWindow)} value={deliveryWindow}>
                    {/* Sin modificador de opacidad sobre `--primary-color`: en
                        Tailwind 3 el `/30` no tinta una var CSS y el ring sale
                        transparente. */}
                    <SelectTrigger className='h-11 rounded-xl border-gray-200 focus:ring-0 focus:ring-offset-0 focus-visible:border-[--primary-color] focus-visible:ring-2 focus-visible:ring-[--primary-color] data-[state=open]:border-[--primary-color]' id='gift-card-window'>
                      {/* !flex: el trigger base trae [&>span]:line-clamp-1, que a
                          este span (hijo directo) le fuerza display:-webkit-box +
                          orient vertical y apila el ícono sobre el texto. */}
                      <span className='!flex items-center gap-2'>
                        <Clock className='h-4 w-4 shrink-0 text-muted-foreground' />
                        <SelectValue>
                          {deliveryWindows.find((option) => option.value === deliveryWindow)?.label}
                        </SelectValue>
                      </span>
                    </SelectTrigger>
                    <SelectContent className='z-[110]'>
                      {deliveryWindows.map((window) => (
                        <SelectItem key={window.value} value={window.value}>{window.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardFooter>
              </Card>
            )}
          </section>
          <button className='h-13 w-full rounded-xl bg-[var(--primary-color)] px-6 py-4 font-bold text-white shadow-lg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50' disabled={!variant || isAdding} onClick={submit} type='button'>{isAdding ? 'Agregando…' : `Agregar ${money(amount, currency)} al carrito`}</button>
        </div>
      </div>
      {previewOpen && typeof document !== 'undefined' && createPortal(<Preview amount={amount} anonymous={anonymous} brandName={brandName} close={() => setPreviewOpen(false)} currency={currency} design={design} fullscreen message={message} recipientName={mode === 'self' ? '' : recipientName} scheduled={scheduledLabel} senderName={senderName} />, document.body)}
    </main>
  )
}
