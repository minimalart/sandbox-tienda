'use client';
import { useCallback, useEffect, useState } from 'react';
import { browserCustomerSession, sessionCookieName } from '../util/customer-session';
import { createCheckoutRequestQueue } from '../util/checkout-request-queue';

export type CheckoutPerson = { id: string; document?: string; first_name: string; last_name: string; grade?: string };
export type CheckoutUnit = { id: string; line_id: string; person_id: string | null };
export type CheckoutSectionCopy = { title?: string; subtitle?: string };
export type CheckoutState = {
  cart_changed?: boolean;
  configured: boolean; revision: number; version: string;
  policy: {
    steps: Record<string, boolean>;
    sections?: Partial<Record<'contact' | 'address' | 'delivery' | 'billing' | 'benefits' | 'payment' | 'review' | 'recipients', CheckoutSectionCopy>>;
    recipients: { enabled: boolean };
    /** Carrusel de sugerencias arriba del checkout. Ausente (sesion vieja) = se muestra. */
    suggestions?: { enabled: boolean };
  };
  people: CheckoutPerson[]; units: CheckoutUnit[]; global_person_id: string | null; conflicts: string[]; recipients_complete: boolean;
  flow: { ready: boolean; address_required: boolean; shipping_required: boolean; billing_required: boolean; blocks: { id: string; complete: boolean; visible: boolean; applicable: boolean; reason: string }[] };
};
const queueCheckoutRequest = createCheckoutRequestQueue();
export async function checkoutRequest(body: Record<string, unknown>): Promise<CheckoutState> {
  const key = sessionCookieName(browserCustomerSession(), 'checkout');
  const pagePath = window.location.pathname;
  return queueCheckoutRequest(key, async () => {
    const response = await fetch('/api/store/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-storefront-page': pagePath }, body: JSON.stringify(body), cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw Object.assign(new Error(data.message || 'No se pudo guardar el checkout.'), { code: data.code, block: data.block, fields: data.errors, units: data.units });
    return data;
  }, navigator.locks);
}
export function useCheckoutPolicy(cart: any) {
  const [state, setState] = useState<CheckoutState | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const key = cart ? JSON.stringify([cart.id, cart.updated_at, cart.email, cart.customer_id, cart.region_id, cart.total, cart.shipping_address, cart.billing_address, cart.shipping_methods, cart.items?.map((i: any) => [i.id, i.quantity, i.variant_id]), cart.metadata?.billing_snapshot]) : '';
  const refresh = useCallback(async () => {
    if (!key) return;
    setLoading(true); setError('');
    try { const next = await checkoutRequest({ action: 'begin' }); setState(next); return next; }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [key]);
  useEffect(() => { let live = true; if (!key) return; setLoading(true); checkoutRequest({ action: 'begin' }).then(next => { if (live) { setState(next); setError(''); } }).catch(e => { if (live) setError(e.message); }).finally(() => { if (live) setLoading(false); }); return () => { live = false; }; }, [key]);
  return { state, setState, error, loading, refresh };
}
