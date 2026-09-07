import { DEFAULT_OUTBOX_SETTINGS, type ErpRetryBudget } from '../types';

const JITTER_MAX_MS = 30_000;

/**
 * Próximo reintento del outbox con backoff exponencial + jitter:
 * `now + min(base * 2^(attempts-1), max) + jitter(0–30s)`.
 * Devuelve `null` cuando `attempts` agotó `max_attempts` → dead_letter.
 * Con los defaults (base 60s, tope 30min, 5 intentos): ~1m, 2m, 4m, 8m → DL.
 *
 * El presupuesto se pasa por parámetro (no se lee de la config acá) porque cada
 * tipo de evento tiene el suyo: `sale_created` usa el general y `invoice_fetch`
 * uno mucho más largo — el ERP factura por lote y "todavía no facturado" no es
 * un error. Ver `ErpOutboxSettings.invoice_fetch`.
 *
 * `now`/`jitterFn` inyectables para tests.
 */
export function computeNextRetry(
  attempts: number,
  settings?: ErpRetryBudget | null,
  now: number = Date.now(),
  jitterFn: () => number = Math.random
): Date | null {
  const maxAttempts = settings?.max_attempts ?? DEFAULT_OUTBOX_SETTINGS.max_attempts;
  if (attempts >= maxAttempts) return null;

  const baseS = settings?.base_delay_s ?? DEFAULT_OUTBOX_SETTINGS.base_delay_s;
  const maxS = settings?.max_delay_s ?? DEFAULT_OUTBOX_SETTINGS.max_delay_s;
  const exponent = Math.max(attempts - 1, 0);
  const delayS = Math.min(baseS * 2 ** exponent, maxS);
  const jitterMs = Math.floor(jitterFn() * JITTER_MAX_MS);
  return new Date(now + delayS * 1000 + jitterMs);
}
