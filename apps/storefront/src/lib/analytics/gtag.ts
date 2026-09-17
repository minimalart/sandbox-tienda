// Helper de Google Analytics 4 (gtag.js) — lado CLIENTE. Toda la integración
// es OPCIONAL: si NEXT_PUBLIC_GA_MEASUREMENT_ID no está seteado, `isGAEnabled`
// es false y cada función queda en no-op (mismo patrón que GTM/Clarity/Stripe).
//
// ARQUITECTURA HÍBRIDA: el cliente trackea solo los eventos de engagement/
// embudo que el backend no puede ver — page_view, view_item y begin_checkout.
// Los eventos de carrito y compra (add_to_cart, remove_from_cart,
// add_shipping_info, add_payment_info, purchase) los emite el plugin de backend
// @variablevic/google-analytics-medusa vía Measurement Protocol. La división es
// sin solapamiento para no duplicar eventos en GA4.
//
// PRIVACIDAD: nunca enviamos datos personales del usuario (email, nombre,
// dirección, teléfono). Solo datos de producto.

import { analyticsPermitted, analyticsTarget } from './runtime'

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (
      command: 'config' | 'event' | 'js' | 'set' | 'consent',
      targetIdOrEventName: string | Date,
      params?: Record<string, unknown>,
    ) => void
  }
}

/** Estructura mínima de item para eventos ecommerce de GA4 (sin PII). */
export type GA4Item = {
  item_id: string
  item_name: string
  price?: number
  quantity?: number
}

/** Forma mínima de un line item de carrito/pedido que necesitamos mapear. */
type AnyLineItem = {
  id?: string | null
  variant_id?: string | null
  product_id?: string | null
  title?: string | null
  product_title?: string | null
  unit_price?: number | null
  quantity?: number | null
}

/** GA4 espera el código de moneda en ISO 4217 mayúsculas (ej. "ARS"). */
export function normalizeCurrency(currency?: string | null): string | undefined {
  return currency ? currency.toUpperCase() : undefined
}

/** Mapea un line item de Medusa a un item de GA4, descartando PII. */
export function lineItemToGA4Item(item: AnyLineItem): GA4Item {
  return {
    item_id: item.variant_id ?? item.product_id ?? item.id ?? 'unknown',
    item_name: item.product_title ?? item.title ?? 'unknown',
    price: typeof item.unit_price === 'number' ? item.unit_price : undefined,
    quantity: typeof item.quantity === 'number' ? item.quantity : undefined,
  }
}

/** Suma price * quantity de una lista de items para el campo `value` de GA4. */
export function sumItemsValue(items: GA4Item[]): number {
  return items.reduce(
    (acc, item) => acc + (item.price ?? 0) * (item.quantity ?? 1),
    0,
  )
}

/** Dispara un evento si GA está activo y gtag ya cargó. No-op en otro caso. */
function sendEvent(name: string, params: Record<string, unknown>): void {
  if (
    !analyticsPermitted() ||
    typeof window === 'undefined' ||
    typeof window.gtag !== 'function'
  ) {
    return
  }
  window.gtag('event', name, { ...params, send_to: analyticsTarget() })
}

/**
 * page_view manual. Lo disparamos a mano (con send_page_view:false en el
 * config) porque el App Router hace navegación client-side sin recargar.
 */
export function trackPageView(url: string): void {
  if (
    !analyticsPermitted() ||
    typeof window === 'undefined' ||
    typeof window.gtag !== 'function'
  ) {
    return
  }
  window.gtag('event', 'page_view', {
    send_to: analyticsTarget(),
    page_path: url,
    page_location: window.location.href,
    page_title: document.title,
  })
}

export function trackViewItem(args: {
  item: GA4Item
  currency?: string
}): void {
  sendEvent('view_item', {
    currency: normalizeCurrency(args.currency),
    value: (args.item.price ?? 0) * (args.item.quantity ?? 1),
    items: [args.item],
  })
}

export function trackBeginCheckout(args: {
  items: GA4Item[]
  currency?: string
  value?: number
}): void {
  sendEvent('begin_checkout', {
    currency: normalizeCurrency(args.currency),
    value: args.value ?? sumItemsValue(args.items),
    items: args.items,
  })
}

