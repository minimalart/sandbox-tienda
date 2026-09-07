/**
 * Normalizador de tracking de Correo Argentino — ÚNICA fuente de verdad del
 * mapeo `statusId`/`status` → vocabulario interno.
 *
 * ⚠️ **LA TABLA DE `statusId` NO ESTÁ PUBLICADA EN NINGÚN LADO.** Ni el manual
 * v1 ni el v2 la traen, y ninguna integración open source la encodea: todas
 * hacen match por SUBSTRING sobre el TEXTO del evento. Verificados solo 3
 * códigos: `PRE` (preImposición), `CAU` (caduco), `CAN` (en proceso de
 * cancelación).
 *
 * Por eso el diseño es: código conocido primero, matcher por texto después, y
 * un bucket `unknown` que **loguea el par `statusId` + `status` con
 * `logger.error`**. Ese log NO es diagnóstico opcional: es el mecanismo para
 * cosechar la tabla real desde tráfico de producción. Si se apaga, el mapeo
 * queda ciego para siempre.
 *
 * Igual que el normalizador de Andreani, hay DOS derivaciones del mismo evento:
 *   - `status` → target de la state machine operativa (`DeliveryExecutionStatus |
 *     null`), lo que consume `pollStatus`.
 *   - `code`   → `code` interno del `TrackingEvent` (vocabulario más fino del
 *     timeline, no necesariamente un estado de la máquina).
 *
 * El vocabulario de salida es el del módulo `delivery` (por eso `canceled` con
 * una L, no `cancelled`): son los mismos estados que ya consumen la state
 * machine y el timeline.
 */

import type { DeliveryExecutionStatus } from '../../delivery/types';
import type { TrackingEventCode } from '../../delivery/tracking-types';
import type { CorreoRawTrackingEvent, CorreoRawTrackingItem } from '../types';

type MinimalLogger = {
  error: (message: string) => void;
};

/**
 * Bucket intermedio: la clasificación semántica del evento de Correo, antes de
 * proyectarla a los dos vocabularios del módulo `delivery`.
 *
 * `pre_shipment` NO está en el mapeo del plan (que agrupa
 * `preimposicion|imposicion|admis → admitted`) y se separó a propósito:
 * preImposición significa que la orden existe pero Correo **todavía no recibió
 * el paquete**. Mapearla a `admitted`/`picked_up` avanzaría la state machine
 * sobre un envío que el carrier no tiene en su red — exactamente lo que el
 * normalizador de Andreani evita devolviendo `null` para `estadoId < 5`.
 */
export type CorreoTrackingBucket =
  | 'pre_shipment'
  | 'admitted'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'returned'
  | 'canceled'
  | 'failed'
  | 'unknown';

/**
 * Los ÚNICOS `statusId` verificados. Todo lo demás cae al matcher por texto.
 * Cuando el ejecutivo de cuenta mande la tabla completa, se agrega acá.
 */
export const CORREO_KNOWN_STATUS_CODES: Readonly<
  Record<string, CorreoTrackingBucket>
> = Object.freeze({
  PRE: 'pre_shipment',
  CAU: 'failed',
  // "EN PROCESO DE CANCELACION": el manual no expone un código separado para la
  // cancelación efectiva, y desde nuestro lado el pedido de cancelación no se
  // revierte, así que se trata como cancelado.
  CAN: 'canceled',
});

/**
 * Reglas de match por TEXTO del evento, en orden de evaluación. El orden importa:
 * `"preimposicion"` CONTIENE `"imposicion"`, así que la regla de pre-imposición
 * tiene que evaluarse antes o todo pre-envío se clasificaría como admitido.
 */
export const CORREO_STATUS_TEXT_RULES: ReadonlyArray<{
  bucket: CorreoTrackingBucket;
  patterns: ReadonlyArray<string>;
}> = Object.freeze([
  { bucket: 'pre_shipment', patterns: ['preimposicion', 'pre imposicion'] },
  { bucket: 'canceled', patterns: ['cancelad'] },
  { bucket: 'returned', patterns: ['devolu', 'returned'] },
  { bucket: 'delivered', patterns: ['entregado', 'delivered'] },
  { bucket: 'failed', patterns: ['caduca', 'caduco', 'fallid', 'rechaz'] },
  {
    bucket: 'out_for_delivery',
    patterns: ['distribuci', 'reparto', 'en camino'],
  },
  {
    bucket: 'in_transit',
    patterns: ['transit', 'despach', 'planta', 'clasificac', 'clog'],
  },
  { bucket: 'admitted', patterns: ['imposicion', 'admis'] },
]);

export interface CorreoTrackingNormalization {
  bucket: CorreoTrackingBucket;
  /** Target de la state machine operativa, o null si no hay transición. */
  status: DeliveryExecutionStatus | null;
  /** `code` del TrackingEvent del timeline, o null si no hay hito mapeable. */
  code: TrackingEventCode | null;
  raw_status_id: string | null;
  raw_status: string | null;
}

/**
 * Bucket → target de la state machine operativa (`delivery`).
 *
 *  - `pre_shipment` → `null`: la orden existe pero Correo no recibió el paquete.
 *  - `admitted`     → `picked_up`: el carrier ya lo tiene (igual que
 *    `estadoId === 5` de Andreani).
 *  - `out_for_delivery` → `in_transit`: la máquina no tiene un estado de
 *    "salió a repartir"; el matiz queda en el `code` del timeline.
 *  - `returned` → `failed_attempt` y NO `canceled`: `canceled` es TERMINAL en la
 *    state machine, y quemar un terminal con un `statusId` que no está
 *    documentado deja la ejecución sin salida. `failed_attempt` es visible para
 *    el operador y sigue admitiendo transiciones.
 */
export function mapBucketToDeliveryStatus(
  bucket: CorreoTrackingBucket
): DeliveryExecutionStatus | null {
  switch (bucket) {
    case 'admitted':
      return 'picked_up';
    case 'in_transit':
    case 'out_for_delivery':
      return 'in_transit';
    case 'delivered':
      return 'delivered';
    case 'canceled':
      return 'canceled';
    case 'returned':
    case 'failed':
      return 'failed_attempt';
    case 'pre_shipment':
    case 'unknown':
      return null;
  }
}

/** Bucket → `code` del TrackingEvent (vocabulario del timeline). */
export function mapBucketToEventCode(
  bucket: CorreoTrackingBucket
): TrackingEventCode | null {
  switch (bucket) {
    case 'pre_shipment':
      return 'created';
    case 'admitted':
      return 'admitted';
    case 'in_transit':
    case 'out_for_delivery':
      return 'in_transit';
    case 'delivered':
      return 'delivered';
    case 'canceled':
      return 'canceled';
    case 'returned':
    case 'failed':
      return 'failed_attempt';
    case 'unknown':
      return null;
  }
}

/**
 * Clasifica un evento de tracking. `logger` es opcional para que la función siga
 * siendo pura y testeable, pero los callers de producción DEBEN pasarlo: es la
 * única forma de descubrir los `statusId` que no conocemos.
 */
export function normalizeCorreoTrackingStatus(
  input: { statusId?: unknown; status?: unknown },
  logger?: MinimalLogger
): CorreoTrackingNormalization {
  const rawStatusId = readString(input.statusId);
  const rawStatus = readString(input.status);

  const bucket = classify(rawStatusId, rawStatus);

  if (bucket === 'unknown') {
    // REQUISITO, no un nice-to-have: sin este log la tabla real de statusId no
    // se puede reconstruir desde el tráfico de producción.
    logger?.error(
      `[correo-argentino] statusId desconocido en tracking — statusId="${rawStatusId ?? ''}" status="${rawStatus ?? ''}". ` +
        'Agregarlo a CORREO_KNOWN_STATUS_CODES o a CORREO_STATUS_TEXT_RULES.'
    );
  }

  return {
    bucket,
    status: mapBucketToDeliveryStatus(bucket),
    code: mapBucketToEventCode(bucket),
    raw_status_id: rawStatusId ?? null,
    raw_status: rawStatus ?? null,
  };
}

function classify(
  rawStatusId: string | undefined,
  rawStatus: string | undefined
): CorreoTrackingBucket {
  const code = rawStatusId?.trim().toUpperCase();
  if (code && Object.prototype.hasOwnProperty.call(CORREO_KNOWN_STATUS_CODES, code)) {
    return CORREO_KNOWN_STATUS_CODES[code] as CorreoTrackingBucket;
  }

  // El texto del evento es la señal principal: es lo único que todas las
  // integraciones existentes pueden usar. Se busca también en el statusId por si
  // trae texto en vez de un código (pasa en respuestas mixtas).
  const haystack = `${normalizeText(rawStatus ?? '')} ${normalizeText(rawStatusId ?? '')}`;

  for (const rule of CORREO_STATUS_TEXT_RULES) {
    if (rule.patterns.some((pattern) => haystack.includes(pattern))) {
      return rule.bucket;
    }
  }

  return 'unknown';
}

export interface CorreoNormalizedTrackingEvent {
  bucket: CorreoTrackingBucket;
  status: DeliveryExecutionStatus | null;
  code: TrackingEventCode | null;
  raw_status_id: string | null;
  raw_status: string | null;
  /** ISO 8601, o null cuando la fecha es ilegible. */
  occurred_at: string | null;
  facility: string | null;
  facility_code: string | null;
  sign: string | null;
}

export interface CorreoNormalizedTracking {
  tracking_number: string | null;
  /** `serviceType` o `productType` — el manual usa los dos nombres. */
  product_type: string | null;
  /** `quantity: 0` + `event: []` significa "TN sin historial", NO un error. */
  has_history: boolean;
  events: CorreoNormalizedTrackingEvent[];
  /** Último evento cronológico, o null si no hay historial. */
  latest: CorreoNormalizedTrackingEvent | null;
  /** Último `status` mapeable (ignora eventos `unknown`), o null. */
  status: DeliveryExecutionStatus | null;
}

/**
 * Normaliza un ítem de `GET /tracking`.
 *
 * Tolera las dos grafías que el manual usa para el mismo campo: `serviceType` /
 * `productType` para el producto, `facilityId` / `facilityCode` para la planta.
 */
export function normalizeCorreoTrackingItem(
  raw: CorreoRawTrackingItem,
  logger?: MinimalLogger
): CorreoNormalizedTracking {
  const rawEvents = Array.isArray(raw?.event) ? raw.event : [];

  const events = rawEvents
    .filter((event): event is CorreoRawTrackingEvent => isRecord(event))
    .map((event) => normalizeEvent(event, logger))
    .sort(byOccurredAtAsc);

  const latest = events.length > 0 ? events[events.length - 1] ?? null : null;

  // El último estado MAPEABLE, no el último evento: un evento `unknown` al final
  // no debe borrar el progreso que ya reportaron los anteriores.
  let status: DeliveryExecutionStatus | null = null;
  for (const event of events) {
    if (event.status) {
      status = event.status;
    }
  }

  return {
    tracking_number: readString(raw?.trackingNumber) ?? null,
    product_type:
      readString(raw?.serviceType) ?? readString(raw?.productType) ?? null,
    has_history: events.length > 0,
    events,
    latest,
    status,
  };
}

function normalizeEvent(
  event: CorreoRawTrackingEvent,
  logger?: MinimalLogger
): CorreoNormalizedTrackingEvent {
  const normalized = normalizeCorreoTrackingStatus(
    { statusId: event.statusId, status: event.status },
    logger
  );

  return {
    ...normalized,
    occurred_at: parseCorreoEventDate(event.date),
    facility: readString(event.facility) ?? null,
    facility_code:
      readString(event.facilityId) ?? readString(event.facilityCode) ?? null,
    sign: readString(event.sign) ?? null,
  };
}

/**
 * Parsea la fecha de un evento a ISO 8601.
 *
 * El manual muestra DOS formatos distintos en dos ejemplos distintos:
 * `"2017-06-27T10:00:00-03:00"` (ISO con offset) y `"28-06-2022 11:53"`
 * (DD-MM-YYYY HH:mm, sin offset). El segundo se interpreta en hora argentina
 * (`-03:00`), que es el huso en el que opera Correo; leerlo como UTC correría
 * todos los eventos 3 horas.
 */
export function parseCorreoEventDate(value: unknown): string | null {
  const raw = readString(value);
  if (!raw) return null;

  const dmy = raw.match(
    /^(\d{2})-(\d{2})-(\d{4})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/
  );
  if (dmy) {
    const [, day, month, year, hours, minutes, seconds] = dmy;
    const iso = `${year}-${month}-${day}T${hours}:${minutes}:${seconds ?? '00'}-03:00`;
    const parsed = Date.parse(iso);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
  }

  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

// --- helpers ---

function byOccurredAtAsc(
  a: CorreoNormalizedTrackingEvent,
  b: CorreoNormalizedTrackingEvent
): number {
  // Los eventos sin fecha legible van al principio: no pueden desplazar al
  // último evento fechado, que es el que define el estado actual. Se comparan
  // por signo y no por resta para no producir NaN entre dos indatables (un
  // comparador que devuelve NaN deja el orden indefinido).
  const left = a.occurred_at ? Date.parse(a.occurred_at) : Number.NEGATIVE_INFINITY;
  const right = b.occurred_at ? Date.parse(b.occurred_at) : Number.NEGATIVE_INFINITY;
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function readString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
