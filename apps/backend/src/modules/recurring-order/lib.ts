/**
 * Helpers puros del módulo de compras recurrentes (sin dependencias de runtime),
 * compartibles entre job, workflows, API y tests.
 */

import type { RecurringAddressSnapshot, RecurringFrequencyInterval } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Suma un intervalo de frecuencia a una fecha. Los meses se suman por calendario
 * con clamp al fin de mes (31/01 + 1 mes = 28/02) para no "derrapar" al mes
 * siguiente. Días y semanas son aritmética simple de ms.
 */
export function addInterval(
  from: Date,
  interval: RecurringFrequencyInterval,
  count: number,
): Date {
  const n = Math.max(1, Math.trunc(count) || 1);
  switch (interval) {
    case 'day':
      return new Date(from.getTime() + n * DAY_MS);
    case 'week':
      return new Date(from.getTime() + n * 7 * DAY_MS);
    case 'month': {
      const target = new Date(from.getTime());
      const day = target.getUTCDate();
      // Ir al día 1 evita el rollover (31 de enero + 1 mes ≠ 3 de marzo)…
      target.setUTCDate(1);
      target.setUTCMonth(target.getUTCMonth() + n);
      // …y después clavar el día original con clamp al último día del mes.
      const lastDay = new Date(
        Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
      ).getUTCDate();
      target.setUTCDate(Math.min(day, lastDay));
      return target;
    }
  }
}

/** Etiqueta humana de la frecuencia para notificaciones y admin. */
export function frequencyLabel(
  interval: RecurringFrequencyInterval,
  count: number,
): string {
  const n = Math.max(1, Math.trunc(count) || 1);
  switch (interval) {
    case 'day':
      return n === 1 ? 'todos los días' : `cada ${n} días`;
    case 'week':
      return n === 1 ? 'todas las semanas' : `cada ${n} semanas`;
    case 'month':
      return n === 1 ? 'todos los meses' : `cada ${n} meses`;
  }
}

/** Formatea un monto en la unidad mayor de la moneda (es-AR, 2 decimales). */
export function formatMoney(amount: number | null | undefined): string {
  const value = Number(amount) || 0;
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function storefrontBase(): string {
  return (
    process.env.STOREFRONT_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    ''
  ).replace(/\/$/, '');
}

function countryPath(countryCode?: string | null): string {
  return (countryCode || process.env.STOREFRONT_DEFAULT_COUNTRY || 'cl')
    .toLowerCase()
    .trim();
}

/**
 * Link de confirmación de una renovación: restaura el carrito generado por id y
 * redirige al checkout (ruta del storefront /subscriptions/renew). Sin
 * STOREFRONT_URL configurada devuelve un path relativo.
 */
export function buildConfirmationUrl(
  cartId: string,
  cycleId: string,
  countryCode?: string | null,
): string {
  const base = storefrontBase();
  const cc = countryPath(countryCode);
  const path = `/${cc}/subscriptions/renew?cart_id=${encodeURIComponent(cartId)}&cycle_id=${encodeURIComponent(cycleId)}`;
  return base ? `${base}${path}` : path;
}

/** Link a "Mis compras recurrentes" en la cuenta del cliente. */
export function buildManageUrl(countryCode?: string | null): string {
  const base = storefrontBase();
  const path = `/${countryPath(countryCode)}/account/subscriptions`;
  return base ? `${base}${path}` : path;
}

export function fullName(first?: string | null, last?: string | null): string {
  return [first, last].filter(Boolean).join(' ').trim();
}

/** Los campos json del ORM llegan como unknown: normaliza el snapshot de dirección. */
export function asAddress(value: unknown): RecurringAddressSnapshot {
  return (value ?? {}) as RecurringAddressSnapshot;
}

/** Normaliza el intervalo persistido (text en DB) al tipo del dominio. */
export function asFrequency(value: unknown): RecurringFrequencyInterval {
  return value === 'day' || value === 'week' || value === 'month' ? value : 'month';
}
