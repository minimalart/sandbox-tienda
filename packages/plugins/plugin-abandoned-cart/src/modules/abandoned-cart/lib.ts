/**
 * Helpers puros del módulo de carritos abandonados (sin dependencias de runtime),
 * compartibles entre job, workflow y API.
 */

import type { AbandonedCartConfig } from './config';
import { minIdleHours } from './config';

const HOUR_MS = 60 * 60 * 1000;

/**
 * Ventana de detección: un carrito es candidato si su última actividad cae
 * ENTRE `oldestAllowed` y `idleBefore`. Se calcula acá (puro) y se aplica en SQL,
 * no en JavaScript: filtrar en memoria después de paginar hace que un lote de
 * carritos viejos consuma la corrida entera y la detección nunca avance.
 */
export type DetectionWindow = {
  /** Actividad más reciente admitida: ya superó el umbral de inactividad. */
  idleBefore: Date;
  /** Actividad más antigua admitida: la ventana de recuperación sigue abierta. */
  oldestAllowed: Date;
};

export function detectionWindow(
  now: Date,
  config: AbandonedCartConfig,
): DetectionWindow {
  return {
    idleBefore: new Date(now.getTime() - minIdleHours(config) * HOUR_MS),
    oldestAllowed: new Date(now.getTime() - config.maxAgeHours * HOUR_MS),
  };
}

/**
 * Chequeo redundante con el filtro SQL, a propósito: cubre el borde de reloj
 * entre el cálculo de la ventana y la query, y deja el invariante explícito.
 */
export function isWithinDetectionWindow(
  lastActivity: Date | string | null | undefined,
  window: DetectionWindow,
): boolean {
  if (!lastActivity) return false;
  const at = new Date(lastActivity);
  if (Number.isNaN(at.getTime())) return false;
  return at <= window.idleBefore && at >= window.oldestAllowed;
}

/**
 * Un carrito es *contactable* si tenemos por dónde escribirle. NO es condición
 * para trackearlo: se trackea todo carrito abandonado (para medir el abandono
 * real) y el contacto solo decide si se puede notificar. `cart.email` recién
 * existe después del paso de dirección del checkout, así que exigirlo en la
 * detección amputa la mayor parte del funnel.
 */
export function isContactable(record: {
  email?: string | null;
  phone?: string | null;
}): boolean {
  return Boolean(record.email || record.phone);
}

/**
 * Cuándo vuelve a ser elegible un tracking, dado el último paso enviado y la
 * última actividad del carrito. `null` = no quedan pasos.
 *
 * Los offsets de los pasos son horas de inactividad ACUMULADAS desde la última
 * actividad, así que si el carrito revive hay que recalcular desde la actividad
 * nueva: dejar el valor viejo lo deja en el pasado y dispara un recordatorio
 * sobre un carrito que el cliente está usando en este momento.
 */
export function nextEligibleAfter(
  lastActivity: Date,
  lastStepSent: number,
  config: AbandonedCartConfig,
): Date | null {
  const upcoming = config.steps
    .filter((s) => s.step > lastStepSent)
    .sort((a, b) => a.step - b.step)[0];
  return upcoming
    ? new Date(lastActivity.getTime() + upcoming.hoursAfterIdle * HOUR_MS)
    : null;
}

/** Una fila del `GROUP BY` de la agregación de métricas. */
export type MetricsAggregateRow = {
  status: string;
  currency_code: string | null;
  sales_channel_id: string | null;
  contactable: boolean;
  count: number;
  /** `SUM(cart_total)` del grupo, en la unidad mayor de la moneda. */
  value: number;
};

export type AbandonedCartMetrics = {
  total: number;
  /** Trackeados a los que se les puede escribir (tienen email y/o teléfono). */
  contactable: number;
  /** Trackeados sin contacto: el techo de recuperación que hoy se pierde. */
  uncontactable: number;
  by_status: Record<string, number>;
  by_sales_channel: Record<string, number>;
  /** Valor abierto (pending + notified) por moneda. Nunca se suman monedas. */
  recoverable_value_by_currency: Record<string, number>;
  /** Valor efectivamente convertido en órdenes, por moneda. */
  recovered_value_by_currency: Record<string, number>;
  /**
   * `recovered / contactable`. El denominador son los contactables, no el total:
   * incluir carritos que nunca se pudieron notificar diluye la tasa y mide la
   * captura de contacto, no la efectividad de la secuencia.
   */
  recovery_rate: number;
};

const OPEN_STATUSES = new Set(['pending', 'notified']);
/** Clave para agrupar montos cuando la fila no tiene moneda. */
const UNKNOWN_CURRENCY = 'unknown';
/** Clave para agrupar filas sin canal de venta (o de antes de que se guardara). */
const UNASSIGNED_CHANNEL = 'unassigned';

/**
 * Da forma a las métricas a partir de las filas agregadas. Pura y sin DB para que
 * sea testeable: la agregación en sí vive en el service.
 */
export function shapeMetrics(rows: MetricsAggregateRow[]): AbandonedCartMetrics {
  const metrics: AbandonedCartMetrics = {
    total: 0,
    contactable: 0,
    uncontactable: 0,
    by_status: {},
    by_sales_channel: {},
    recoverable_value_by_currency: {},
    recovered_value_by_currency: {},
    recovery_rate: 0,
  };

  for (const row of rows) {
    const count = Number(row.count) || 0;
    const value = Number(row.value) || 0;
    const currency = (row.currency_code || UNKNOWN_CURRENCY).toLowerCase();
    const channel = row.sales_channel_id || UNASSIGNED_CHANNEL;

    metrics.total += count;
    if (row.contactable) metrics.contactable += count;
    else metrics.uncontactable += count;
    metrics.by_status[row.status] = (metrics.by_status[row.status] ?? 0) + count;
    metrics.by_sales_channel[channel] =
      (metrics.by_sales_channel[channel] ?? 0) + count;

    if (OPEN_STATUSES.has(row.status)) {
      metrics.recoverable_value_by_currency[currency] =
        (metrics.recoverable_value_by_currency[currency] ?? 0) + value;
    } else if (row.status === 'recovered') {
      metrics.recovered_value_by_currency[currency] =
        (metrics.recovered_value_by_currency[currency] ?? 0) + value;
    }
  }

  const recovered = metrics.by_status.recovered ?? 0;
  metrics.recovery_rate =
    metrics.contactable > 0 ? recovered / metrics.contactable : 0;

  return metrics;
}

/** Formatea un monto en la unidad mayor de la moneda (es-AR, 2 decimales). */
export function formatMoney(amount: number | null | undefined): string {
  const value = Number(amount) || 0;
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Arma el link de recuperación del carrito. Apunta a una ruta del storefront que
 * restaura el carrito por id y redirige al checkout (dependencia del storefront,
 * ver plan). Si no hay STOREFRONT_URL configurada, devuelve un path relativo.
 */
export function buildRecoveryUrl(
  cartId: string,
  countryCode?: string | null,
): string {
  const base = (
    process.env.STOREFRONT_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    ''
  ).replace(/\/$/, '');
  const cc = (countryCode || process.env.STOREFRONT_DEFAULT_COUNTRY || 'cl')
    .toLowerCase()
    .trim();
  const path = `/${cc}/cart/recover?cart_id=${encodeURIComponent(cartId)}`;
  return base ? `${base}${path}` : path;
}

export function fullName(
  first?: string | null,
  last?: string | null,
): string {
  return [first, last].filter(Boolean).join(' ').trim();
}
