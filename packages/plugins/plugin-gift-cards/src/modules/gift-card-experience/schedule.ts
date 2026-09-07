import type { GiftCardConfigV1 } from '../../lib/gift-cards-shared';
import type { GiftCardSettingsRow } from './types';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function partsInTimeZone(date: Date, timeZone: string): Record<string, number> {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  return Object.fromEntries(
    parts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]),
  );
}

/** Converts a store-local wall clock value to an instant without adding a runtime dependency. */
export function zonedDateTimeToUtc(date: string, time: string, timeZone: string): Date {
  if (!DATE_ONLY.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new Error('La fecha o franja de entrega no es válida.');
  }
  // This also validates the IANA zone.
  new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  const [hour, minute] = time.split(':').map(Number) as [number, number];
  const wantedUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  let candidate = new Date(wantedUtc);
  for (let i = 0; i < 3; i += 1) {
    const local = partsInTimeZone(candidate, timeZone);
    const represented = Date.UTC(
      local.year!, local.month! - 1, local.day!, local.hour!, local.minute!, local.second!,
    );
    candidate = new Date(candidate.getTime() + (wantedUtc - represented));
  }
  const resolved = partsInTimeZone(candidate, timeZone);
  if (
    resolved.year !== year || resolved.month !== month || resolved.day !== day ||
    resolved.hour !== hour || resolved.minute !== minute
  ) {
    throw new Error('La hora elegida no existe en la zona horaria configurada.');
  }
  return candidate;
}

export function resolveScheduledAt(
  delivery: GiftCardConfigV1['delivery'],
  settings: GiftCardSettingsRow,
  now = new Date(),
): Date | null {
  if (delivery.type === 'now') return null;
  const time = delivery.window === 'morning'
    ? settings.morning_time
    : delivery.window === 'afternoon'
      ? settings.afternoon_time
      : settings.evening_time;
  const scheduledAt = zonedDateTimeToUtc(delivery.date, time, settings.timezone);
  if (scheduledAt.getTime() <= now.getTime()) {
    throw new Error('La entrega programada debe ser futura.');
  }
  const horizon = now.getTime() + settings.schedule_horizon_days * 86_400_000;
  if (scheduledAt.getTime() > horizon) {
    throw new Error(`La entrega no puede programarse a más de ${settings.schedule_horizon_days} días.`);
  }
  return scheduledAt;
}
