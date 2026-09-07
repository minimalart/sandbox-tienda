import recurringOrdersDescriptors from '../app-settings/descriptors/recurring-orders';
import { resolveSettingSync } from '../app-settings/resolve';

/**
 * Configuración efectiva de compras recurrentes, con la precedencia
 * **base > env > default** de `app-settings`.
 *
 * Es SINCRÓNICA, igual que `typesense/settings.ts` y `ga4/settings.ts`, y acá el
 * motivo es la FORMA DE LOS CALL SITES: `service.getConfig()` es un método
 * sincrónico, `isRecurringEnabledForChannel()` la usa como gate antes de tocar la
 * base y `mergeRuntimeConfig()` la recibe como capa de abajo de un merge PURO que
 * está testeado sin DB (`runtime-config.test.ts`). Convertirlos a promesa sería un
 * refactor de varios archivos para conseguir exactamente lo mismo: el snapshot ya
 * vive en memoria y se refresca solo cada `SNAPSHOT_TTL_MS`
 * (`app-settings/snapshot.ts:79`), así que un cambio guardado desde el admin llega
 * igual, sin pagar un `SELECT` por corrida del cron.
 *
 * NO hay camino async por `PG_CONNECTION` como el de `kapso-whatsapp/settings.ts`
 * y a propósito: ese existe para consumidores que corren en el contenedor
 * HERMÉTICO que arma `load-internal.js` (notification y fulfillment providers),
 * donde no se puede resolver un módulo. Acá no hay ninguno — todo lo que lee esta
 * config son jobs, workflows, subscribers y rutas, que tienen contenedor completo.
 *
 * Antes de que el loader llene el snapshot se cae a `process.env`, o sea que se
 * comporta exactamente como antes de esta migración.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ ESTO ES EL DEFAULT DE LA INSTALACIÓN. LA CAPA POR TIENDA ESTÁ ARRIBA.     │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Cinco de estos siete valores los pisa `recurring_setting` POR CANAL DE VENTA en
 * `runtime-config.ts:mergeRuntimeConfig`, y esa es la capa que hay que tocar para
 * personalizar una tienda. Por eso el namespace es `defaultScope: 'instance'`: se
 * lee la fila global y el admin escribe en la fila global, sin una tercera capa
 * por tienda compitiendo con la que ya funciona. La razón larga está en las notas
 * 1 y 2 de `app-settings/descriptors/recurring-orders.ts`.
 */

export type RecurringOrderSettings = {
  enabled: boolean;
  batchSize: number;
  maxAttempts: number;
  retryHours: number;
  paymentExpirationHours: number;
  reminderHours: number;
  maxConsecutiveFailures: number;
};

const byKey = new Map(recurringOrdersDescriptors.settings.map((d) => [d.key, d]));

function read<T>(key: string, fallback: T): T {
  const descriptor = byKey.get(key);
  if (!descriptor) return fallback;
  const value = resolveSettingSync(descriptor);
  return (value === undefined || value === null ? fallback : value) as T;
}

/**
 * Igual que `read`, pero exige un número POSITIVO.
 *
 * No es paranoia: `coerceFromEnv` convierte el tipo pero NO valida rangos
 * (`validate.ts:158-161`), a propósito, para que un env fuera de rango siga
 * funcionando como funcionaba. El `envInt` que había acá antes descartaba
 * cualquier cosa que no fuera `> 0` y caía al default, así que sin este guard un
 * `RECURRING_MAX_ATTEMPTS=0` heredado dejaría todo ciclo en fallo terminal al
 * primer intento. El camino de la base ya está cubierto por el `min` del
 * descriptor; esto cubre el del env.
 *
 * Hay una segunda razón, específica de este módulo: `mergeRuntimeConfig` usa
 * estos valores como FALLBACK de `pickNumber`, que ya descarta lo no positivo de
 * la fila del canal. Si el fallback pudiera ser 0, un canal sin configurar
 * heredaría un 0 que la fila del canal nunca habría podido guardar.
 */
function readPositive(key: string, fallback: number): number {
  const value = Number(read<number>(key, fallback));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function getRecurringOrderSettings(): RecurringOrderSettings {
  return {
    enabled: read('RECURRING_ORDERS_ENABLED', true),
    batchSize: readPositive('RECURRING_BATCH_SIZE', 50),
    maxAttempts: readPositive('RECURRING_MAX_ATTEMPTS', 3),
    retryHours: readPositive('RECURRING_RETRY_HOURS', 6),
    paymentExpirationHours: readPositive('RECURRING_PAYMENT_EXPIRATION_HOURS', 72),
    reminderHours: readPositive('RECURRING_REMINDER_HOURS', 24),
    maxConsecutiveFailures: readPositive('RECURRING_MAX_CONSECUTIVE_FAILURES', 2),
  };
}

/** Runtime gates shared by storefront routes, jobs and payment adapters. */
export function isSubscriptionFeatureEnabled(
  key:
    | 'SUBSCRIPTIONS_V2_ENABLED'
    | 'SUBSCRIPTIONS_STOREFRONT_ENABLED'
    | 'SUBSCRIPTIONS_AUTO_PAYMENT_ENABLED'
    | 'SUBSCRIPTIONS_STOCK_FORECAST_ENABLED'
    | 'SUBSCRIPTIONS_RETENTION_ENABLED'
): boolean {
  return read(key, false);
}
