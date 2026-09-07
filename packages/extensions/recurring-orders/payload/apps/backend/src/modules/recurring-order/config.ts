/**
 * Configuración de compras recurrentes con defaults sensatos.
 *
 * Ya NO se lee de `process.env` directo: los siete valores editables salen de
 * `./settings.ts`, que aplica la precedencia **base > env > default** de
 * `app-settings`. La forma de este objeto no cambió, y eso es a propósito —
 * `mergeRuntimeConfig` lo recibe como capa de abajo y el job y el service lo
 * consumen igual que antes.
 *
 * `enabled` sigue siendo el kill-switch global y a la vez el default de la tienda
 * principal (los demos tienen su propio toggle `demo_store.recurring_enabled`).
 *
 * `renewalCron` es LO ÚNICO que se sigue leyendo del entorno acá, y no es una
 * excepción olvidada: el `schedule:` de un job lo hornea el loader al arrancar
 * (`job-loader.js:69-78`), cuando la base todavía no se consultó. Está declarado
 * en `envOnly` con esa razón escrita.
 */

import { getRecurringOrderSettings } from './settings';

export type RecurringOrderConfig = {
  enabled: boolean;
  renewalCron: string;
  /** Máx. de ciclos a procesar por corrida del cron (evita picos). */
  batchSize: number;
  /** Reintentos de EJECUCIÓN por ciclo (armar carrito/validar) antes de fallo terminal. */
  maxAttempts: number;
  /** Horas entre reintentos de ejecución (re-agenda `scheduled_at`). */
  retryHours: number;
  /** Vida del link de pago: pasado esto el ciclo expira. */
  paymentExpirationHours: number;
  /** Horas en `pending_payment` antes de mandar el recordatorio (uno solo). */
  reminderHours: number;
  /** Ciclos fallidos/expirados consecutivos antes de marcar la suscripción `failed`. */
  maxConsecutiveFailures: number;
};

export function getRecurringOrderConfig(): RecurringOrderConfig {
  const settings = getRecurringOrderSettings();
  return {
    ...settings,
    renewalCron: process.env.RECURRING_RENEWAL_CRON || '*/5 * * * *',
  };
}
