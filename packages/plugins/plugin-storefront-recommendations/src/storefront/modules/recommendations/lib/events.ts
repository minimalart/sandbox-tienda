'use client';

import type { RecommendationEventName } from '../types';

/**
 * Envío de eventos de recomendaciones (PRD §14).
 *
 * Tres cosas que resuelve y que conviene no simplificar:
 *
 * 1. DEDUPE. La clave es `request_id:evento:producto` y vive en un Set a nivel módulo.
 *    Un remount del componente, el doble efecto de StrictMode o un scroll que vuelve a
 *    cruzar el viewport NO deben contar de nuevo: inflarían el CTR.
 *
 * 2. LOTE. Se acumula ~1s y se manda todo junto. Un rail de 8 productos que entra al
 *    viewport dispararía 8 requests; así manda uno.
 *
 * 3. FLUSH AL SALIR. En `visibilitychange`/`pagehide` se fuerza el envío por
 *    `sendBeacon`, que es lo único que el browser garantiza durante la descarga de la
 *    página. Justo ahí es donde se pierden los clics: el usuario clickea y navega.
 *
 * Va contra nuestro propio BFF y no directo al backend a propósito: `sendBeacon` no
 * puede setear headers, así que por el BFF la cookie de sesión viaja sola y el backend
 * recibe atribución autenticada. Es la limitación que documenta
 * `lib/typesense/search-browser.ts` como pérdida aceptada; acá no hace falta aceptarla.
 */

const ENDPOINT = '/api/store/recommendations/events';
const FLUSH_DELAY_MS = 1000;

type QueuedEvent = {
  event: RecommendationEventName;
  product_id: string;
  position?: number;
  occurred_at: string;
};

const sent = new Set<string>();
const queues = new Map<string, QueuedEvent[]>();
let timer: ReturnType<typeof setTimeout> | null = null;
let listenersBound = false;

/** Sólo para tests: limpia el estado del módulo. */
export const __resetEvents = (): void => {
  sent.clear();
  queues.clear();
  if (timer) clearTimeout(timer);
  timer = null;
};

function post(requestId: string, events: QueuedEvent[]): void {
  const body = JSON.stringify({ request_id: requestId, events });
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon(ENDPOINT, blob)) return;
    }
    // `keepalive` permite que el request sobreviva a la navegación, igual que beacon.
    void fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Telemetría: nunca puede romper la navegación.
  }
}

function flush(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  // `Array.from` y no `for...of` sobre el Map: el target de TS del storefront no
  // permite iterar iteradores sin `downlevelIteration`.
  for (const [requestId, events] of Array.from(queues.entries())) {
    if (events.length) post(requestId, events);
  }
  queues.clear();
}

function bindUnloadListeners(): void {
  if (listenersBound || typeof document === 'undefined') return;
  listenersBound = true;
  // `pagehide` cubre Safari (que no siempre dispara visibilitychange al navegar).
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  window.addEventListener('pagehide', flush);
}

/**
 * Encola un evento. No hace nada sin `requestId`: los rails que no vienen del motor
 * (vistos recientemente) no tienen request y loguearlos con `null` contaminaría la
 * tabla de eventos.
 */
export function trackRecommendationEvent(input: {
  requestId: string | null;
  event: RecommendationEventName;
  productId: string;
  position?: number;
}): void {
  if (!input.requestId || !input.productId) return;

  const key = `${input.requestId}:${input.event}:${input.productId}`;
  if (sent.has(key)) return;
  sent.add(key);

  bindUnloadListeners();

  const queued: QueuedEvent = {
    event: input.event,
    product_id: input.productId,
    ...(typeof input.position === 'number' ? { position: input.position } : {}),
    occurred_at: new Date().toISOString(),
  };

  const queue = queues.get(input.requestId);
  if (queue) queue.push(queued);
  else queues.set(input.requestId, [queued]);

  if (!timer) timer = setTimeout(flush, FLUSH_DELAY_MS);

  mirrorToGa4(input.event, input.productId);
}

/**
 * Espejo opcional a GA4.
 *
 * Deliberadamente por `window.gtag` y sin importar nada de `lib/analytics`: GA4 NO es
 * la fuente de verdad de la atribución (PRD §14.5) y mantenerlo como una llamada
 * guardada deja eso explícito en el código, además de no acoplar esta extensión con la
 * de GA4 (que es opcional).
 */
function mirrorToGa4(event: RecommendationEventName, productId: string): void {
  const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
  if (typeof gtag !== 'function') return;
  const name =
    event === 'recommendation_clicked'
      ? 'select_item'
      : event === 'recommendation_added_to_cart'
        ? 'add_to_cart'
        : 'view_item_list';
  try {
    gtag('event', name, { item_list_name: 'recommendations', items: [{ item_id: productId }] });
  } catch {
    // idem: nunca puede romper la navegación.
  }
}
