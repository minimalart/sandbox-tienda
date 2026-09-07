/**
 * Configuración efectiva de GA4 con la precedencia **snapshot > env > default**.
 *
 * La capa de snapshot vive en el host (`app-settings`) y el plugin la recibe vía
 * `@minimalart/mercatto-plugin-runtime`: el host registra su `resolveSettingSync`
 * envuelto una sola vez al arrancar, y este archivo lo lee vía
 * `getAppSettingsSyncReader`.
 *
 * Es SINCRÓNICA a propósito. `dispatch()` y `dispatchBuiltin()` corren por cada
 * evento del event bus, y meterles un `SELECT` a `site_setting` por hit sería
 * pagar una consulta por cada `add_to_cart` del sitio. El snapshot ya está en
 * memoria del host y se refresca en cada escritura del admin, así que leer de
 * ahí es gratis y consistente.
 *
 * Cuando el host no registró un reader —proyecto sin `app-settings`, tests,
 * boot antes del bridge— se cae a `process.env`. Es la MISMA semántica que la
 * extensión original tenía "antes de que el loader llene el snapshot".
 */

import { getAppSettingsSyncReader } from '@minimalart/mercatto-plugin-runtime';

export type Ga4ResolvedSettings = {
  measurementId: string | null;
  apiSecret: string | null;
  gtmId: string | null;
  debug: boolean;
};

/**
 * La fila legacy `ga4_settings`, que existe desde antes de `app-settings`.
 * Ver `mergeWithLegacyRow` para por qué sigue viva.
 */
export type LegacyGa4SettingsRow = {
  measurement_id?: string | null;
  api_secret?: string | null;
  gtm_id?: string | null;
  debug?: boolean | null;
};

const NAMESPACE = 'extension:ga4';

/**
 * Alias del env que el descriptor del host mapea a la misma key. Se replican
 * acá porque cuando no hay reader (host sin app-settings, tests) el plugin
 * hace el fallback a env por su cuenta y necesita conocer los aliases.
 */
const ENV_ALIASES: Record<string, string[]> = {
  GA_MEASUREMENT_ID: ['GA_MEASUREMENT_ID', 'NEXT_PUBLIC_GA_MEASUREMENT_ID'],
  GA_API_SECRET: ['GA_API_SECRET'],
  GTM_ID: ['GTM_ID', 'NEXT_PUBLIC_GTM_ID'],
  GA_DEBUG: ['GA_DEBUG'],
};

function readFromSnapshot(key: string): unknown {
  const reader = getAppSettingsSyncReader();
  if (!reader) return undefined;
  try {
    return reader(NAMESPACE, key);
  } catch {
    // Un reader que tira NO tiene que romper el getter: se cae al env.
    return undefined;
  }
}

function readEnvString(key: string): string | null {
  for (const alias of ENV_ALIASES[key] ?? [key]) {
    const raw = process.env[alias];
    if (raw !== undefined && raw !== '') return raw;
  }
  return null;
}

function readString(key: string, fallback: string | null): string | null {
  const fromSnapshot = readFromSnapshot(key);
  if (typeof fromSnapshot === 'string' && fromSnapshot !== '') return fromSnapshot;
  const fromEnv = readEnvString(key);
  return fromEnv ?? fallback;
}

function readBool(key: string, fallback: boolean): boolean {
  const fromSnapshot = readFromSnapshot(key);
  if (typeof fromSnapshot === 'boolean') return fromSnapshot;
  const raw = process.env[ENV_ALIASES[key]?.[0] ?? key];
  if (raw === undefined) return fallback;
  const value = raw.trim().toLowerCase();
  if (value === '') return fallback;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

/**
 * `true` si el snapshot del host tiene una entrada explícita para esta key. Es
 * la señal de intención que necesita `mergeWithLegacyRow` para decidir quién
 * gana; el valor efectivo no alcanza, porque un valor heredado del env se ve
 * idéntico a uno guardado en `site_setting`.
 *
 * En el plugin no tenemos acceso directo a `site_setting`: si el reader del
 * runtime devuelve un valor distinto de `undefined`, asumimos que ese valor
 * vino del snapshot (guardado en el admin). El host debería devolver
 * `undefined` cuando no hay override — así lo hace `resolveSettingSync` cuando
 * no hay fila en `site_setting`, incluso si el env tiene algo.
 */
function isOverriddenInDb(key: string): boolean {
  const reader = getAppSettingsSyncReader();
  if (!reader) return false;
  try {
    return reader(NAMESPACE, key) !== undefined;
  } catch {
    return false;
  }
}

export function getGa4Settings(): Ga4ResolvedSettings {
  return {
    measurementId: readString('GA_MEASUREMENT_ID', null),
    apiSecret: readString('GA_API_SECRET', null),
    gtmId: readString('GTM_ID', null),
    debug: readBool('GA_DEBUG', false),
  };
}

/**
 * Mezcla la fila legacy `ga4_settings` con los ajustes de `app-settings`.
 *
 * Precedencia, por campo:
 *
 *   1. entrada en `site_setting` — alguien la guardó en la card. Intención
 *      explícita y en el sistema nuevo: gana siempre.
 *   2. columna NO nula de `ga4_settings` — el panel viejo de GA4, o la semilla
 *      que ese panel escribía desde el env. Hay instalaciones con valores
 *      reales ahí y perderlos sería apagarles la medición en silencio.
 *   3. env → 4. default (los dos ya los resuelve `getGa4Settings`).
 */
export function mergeWithLegacyRow(legacy: LegacyGa4SettingsRow | undefined): Ga4ResolvedSettings {
  const resolved = getGa4Settings();
  if (!legacy) return resolved;

  const pick = <T>(key: string, legacyValue: T | null | undefined, resolvedValue: T): T =>
    isOverriddenInDb(key) ? resolvedValue : (legacyValue ?? resolvedValue);

  return {
    measurementId: pick('GA_MEASUREMENT_ID', legacy.measurement_id, resolved.measurementId),
    apiSecret: pick('GA_API_SECRET', legacy.api_secret, resolved.apiSecret),
    gtmId: pick('GTM_ID', legacy.gtm_id, resolved.gtmId),
    debug: pick('GA_DEBUG', legacy.debug, resolved.debug),
  };
}
