/**
 * Loader por ENV PURO + normalización de las options de Correo Argentino.
 *
 * `normalizeCorreoOptions()` es la ÚNICA normalización del módulo, y por eso
 * `settings.ts` (que resuelve contra `site_setting` con la precedencia de
 * `app-settings`) termina llamando acá en vez de parsear por su cuenta. Dos
 * normalizaciones significarían que el provider cotiza con una configuración y el
 * workflow de tickets da de alta con otra — y el síntoma, un envío creado con otro
 * origen o serviceType que el cotizado, no apunta a ningún archivo.
 *
 * `loadCorreoOptionsFromEnv()` lee SÓLO `process.env`, sin tocar la base. Queda
 * para el único consumidor que corre antes de que exista la base:
 * `medusa-config.ts`, que evalúa las options del provider en el boot (no hay hook
 * entre "config evaluada" y "contenedor construido"). Todo lo demás —el provider
 * en runtime, el workflow, las rutas, el job— tiene que pasar por
 * `settings.ts`: es el único camino que ve la configuración de la tienda.
 */

import {
  CORREO_DEFAULT_AFORO_DIVISOR,
  CORREO_MAX_DIMENSION_CM,
  CORREO_MAX_WEIGHT_G,
} from './transformers/consolidate-parcel';
import type {
  CorreoApiTarget,
  CorreoDeliveryType,
  CorreoProviderOptions,
  CorreoServiceType,
  CorreoWeightUnit,
} from './types';

/**
 * Host que hoy comparten las dos APIs. Es el DEFAULT, no un invariante: cada API
 * puede apuntar a un host distinto (`CORREO_ARGENTINO_MICORREO_HOSTNAME`).
 */
export const CORREO_TEST_HOSTNAME = 'apitest.correoargentino.com.ar';
export const CORREO_PROD_HOSTNAME = 'api.correoargentino.com.ar';

/**
 * Defaults de los base paths de cada API.
 *
 * Son DEFAULTS y no constantes de contrato: el historial de cambios del manual
 * oficial documenta que Correo ya movió la URL dos veces (v1.1 "Inclusión versión
 * en la URL", v1.2 "Inclusión URL PROD y TEST exteriorizadas") y el manual v1
 * apuntaba a `ptest04.correoargentino.com.ar/apipaqar` — host Y path distintos de
 * estos. Overrideables por env (`CORREO_ARGENTINO_PAQAR_BASE_PATH`,
 * `CORREO_ARGENTINO_MICORREO_BASE_PATH`) para que un `/paqar/v2` sea un cambio de
 * configuración y no un deploy de código.
 */
export const CORREO_DEFAULT_PAQAR_BASE_PATH = '/paqar/v1';
export const CORREO_DEFAULT_MICORREO_BASE_PATH = '/micorreo/v1';

/** Default de `parcels[].productCategory`, que es obligatorio en el payload. */
export const CORREO_DEFAULT_PRODUCT_CATEGORY = 'Mercaderia general';

export function loadCorreoOptionsFromEnv(): CorreoProviderOptions {
  return normalizeCorreoOptions({
    hostname: process.env.CORREO_ARGENTINO_HOSTNAME,
    micorreoHostname: process.env.CORREO_ARGENTINO_MICORREO_HOSTNAME,
    paqarBasePath: process.env.CORREO_ARGENTINO_PAQAR_BASE_PATH,
    micorreoBasePath: process.env.CORREO_ARGENTINO_MICORREO_BASE_PATH,
    testMode: process.env.CORREO_ARGENTINO_TEST_MODE,
    apiKey: process.env.CORREO_ARGENTINO_API_KEY,
    agreement: process.env.CORREO_ARGENTINO_AGREEMENT,
    sellerId: process.env.CORREO_ARGENTINO_SELLER_ID,
    extClient: process.env.CORREO_ARGENTINO_EXT_CLIENT,
    micorreo: {
      username: process.env.CORREO_ARGENTINO_MICORREO_USER,
      password: process.env.CORREO_ARGENTINO_MICORREO_PASS,
      customerId: process.env.CORREO_ARGENTINO_CUSTOMER_ID,
    },
    serviceType: process.env.CORREO_ARGENTINO_SERVICE_TYPE,
    productCategory: process.env.CORREO_ARGENTINO_PRODUCT_CATEGORY,
    productWeightUnit: process.env.CORREO_ARGENTINO_PRODUCT_WEIGHT_UNIT,
    sender: {
      name: process.env.CORREO_ARGENTINO_SENDER_NAME,
      email: process.env.CORREO_ARGENTINO_SENDER_EMAIL,
      phone: process.env.CORREO_ARGENTINO_SENDER_PHONE,
      cellphone: process.env.CORREO_ARGENTINO_SENDER_CELLPHONE,
      observation: process.env.CORREO_ARGENTINO_SENDER_OBSERVATION,
    },
    origin: {
      postalCode: process.env.CORREO_ARGENTINO_ORIGIN_POSTAL_CODE,
      street: process.env.CORREO_ARGENTINO_ORIGIN_STREET,
      number: process.env.CORREO_ARGENTINO_ORIGIN_NUMBER,
      city: process.env.CORREO_ARGENTINO_ORIGIN_CITY,
      state: process.env.CORREO_ARGENTINO_ORIGIN_STATE,
      floor: process.env.CORREO_ARGENTINO_ORIGIN_FLOOR,
      department: process.env.CORREO_ARGENTINO_ORIGIN_DEPARTMENT,
    },
    limits: {
      maxWeightG: process.env.CORREO_ARGENTINO_MAX_WEIGHT_G,
      maxDimensionCm: process.env.CORREO_ARGENTINO_MAX_DIMENSION_CM,
      aforoDivisor: process.env.CORREO_ARGENTINO_AFORO_DIVISOR,
    },
    dimensionFallback: {
      enabled: process.env.CORREO_ARGENTINO_DIMENSION_FALLBACK_ENABLED,
      length: process.env.CORREO_ARGENTINO_DIMENSION_FALLBACK_LENGTH,
      width: process.env.CORREO_ARGENTINO_DIMENSION_FALLBACK_WIDTH,
      height: process.env.CORREO_ARGENTINO_DIMENSION_FALLBACK_HEIGHT,
      weight: process.env.CORREO_ARGENTINO_DIMENSION_FALLBACK_WEIGHT,
    },
  });
}

type RawOptions = Record<string, unknown> | undefined;

/**
 * Valida y completa las options crudas (vengan de ENV, de `medusa-config.ts` o de
 * `settings.ts` resolviendo contra la base).
 *
 * ⚠️ **NO TIRA cuando faltan `apiKey` o `agreement`.** Hasta la migración a
 * `app-settings` sí lo hacía, y era razonable en un mundo single-tenant: la
 * configuración se congelaba al arrancar, así que fallar en el boot era mejor que
 * fallar en el primer checkout. En multitienda ese contrato se da vuelta:
 *
 *  - Las credenciales ahora se resuelven POR TIENDA y POR LLAMADA. Una tienda
 *    secundaria que todavía no cargó su acuerdo resuelve a `'off'` por
 *    fail-closed, que es el comportamiento CORRECTO — y con el throw, ese estado
 *    esperado se convertía en una excepción en medio de una cotización.
 *  - El provider se registra siempre y degrada, que es el patrón ya establecido
 *    en `kapso-whatsapp/service.ts:79-93` (sin credenciales, loguea en vez de
 *    enviar) y el que `canQuote()` ya aplicaba acá para MiCorreo.
 *
 * Faltar sigue sin ser gratis: `apiKey` y `agreement` vacíos dejan al provider en
 * el mismo estado degradado que documenta `canQuote()`, y el constructor grita con
 * `logger.error`. Quien necesita el diagnóstico completo lo tiene en la ruta de
 * health (`paqar_ready` / `micorreo_ready`).
 */
export function normalizeCorreoOptions(
  options: RawOptions
): CorreoProviderOptions {
  const opts = options ?? {};

  const testMode = readBool(opts.testMode);

  const apiKey = normalizeApiKey(readStr(opts.apiKey)) ?? '';
  const agreement = readStr(opts.agreement) ?? '';

  // Host de paqar y, por default, también el de MiCorreo: la cadena de fallback
  // de MiCorreo es `MICORREO_HOSTNAME` → `HOSTNAME` → derivado de `TEST_MODE`, así
  // que sin la variable propia el comportamiento es el de siempre (un solo host
  // para las dos APIs).
  const hostname =
    normalizeHostname(readStr(opts.hostname)) ??
    (testMode ? CORREO_TEST_HOSTNAME : CORREO_PROD_HOSTNAME);
  const micorreoHostname =
    normalizeHostname(readStr(opts.micorreoHostname)) ?? hostname;

  const micorreo = readRecord(opts.micorreo);
  const sender = readRecord(opts.sender);
  const origin = readRecord(opts.origin);
  const limits = readRecord(opts.limits);
  const fallback = readRecord(opts.dimensionFallback);

  return {
    hostname,
    api: {
      paqar: buildApiTarget(
        hostname,
        readStr(opts.paqarBasePath),
        CORREO_DEFAULT_PAQAR_BASE_PATH
      ),
      micorreo: buildApiTarget(
        micorreoHostname,
        readStr(opts.micorreoBasePath),
        CORREO_DEFAULT_MICORREO_BASE_PATH
      ),
    },
    testMode,
    apiKey,
    agreement,
    // El manual usa `sellerId` y `agreement` de forma intercambiable en varios
    // ejemplos; cuando no se configura aparte, el agreement es el default menos
    // sorprendente.
    sellerId: readStr(opts.sellerId) ?? agreement,
    extClient: normalizeExtClient(readStr(opts.extClient)),
    micorreo: {
      username: readStr(micorreo.username) ?? '',
      password: readStr(micorreo.password) ?? '',
      customerId: readStr(micorreo.customerId) ?? '',
    },
    serviceType: normalizeServiceType(readStr(opts.serviceType)),
    sender: {
      name: readStr(sender.name) ?? 'Remitente',
      email: readStr(sender.email),
      phone: readStr(sender.phone),
      cellphone: readStr(sender.cellphone),
      observation: readStr(sender.observation),
    },
    origin: {
      postalCode: readStr(origin.postalCode) ?? '',
      street: readStr(origin.street) ?? '',
      number: readStr(origin.number) ?? '',
      city: readStr(origin.city) ?? '',
      state: readStr(origin.state) ?? '',
      floor: readStr(origin.floor),
      department: readStr(origin.department),
    },
    productCategory:
      readStr(opts.productCategory) ?? CORREO_DEFAULT_PRODUCT_CATEGORY,
    limits: {
      maxWeightG: readNum(limits.maxWeightG, CORREO_MAX_WEIGHT_G),
      maxDimensionCm: readNum(limits.maxDimensionCm, CORREO_MAX_DIMENSION_CM),
      aforoDivisor: readNum(limits.aforoDivisor, CORREO_DEFAULT_AFORO_DIVISOR),
    },
    productWeightUnit: normalizeWeightUnit(readStr(opts.productWeightUnit)),
    dimensionFallback: {
      enabled: readBool(fallback.enabled),
      length: readNum(fallback.length, 30),
      width: readNum(fallback.width, 20),
      height: readNum(fallback.height, 15),
      weight: readNum(fallback.weight, 0.5),
    },
  };
}

/**
 * La planilla de credenciales que entrega Correo trae la celda con el prefijo
 * ya puesto (`"Apikey eyJhbGci…"`), y `PaqarClient` arma el header como
 * `Apikey ${apiKey}`. Copiar la celda tal cual produce `Apikey Apikey eyJ…`.
 *
 * Si el gateway tolera o no el prefijo duplicado es algo que NO sabemos: nunca
 * se probó contra la API. Se normaliza igual porque el costo es nulo y el
 * síntoma de que NO lo tolere sería un 401 en cada request sin ninguna pista de
 * por qué.
 */
export function normalizeApiKey(value?: string): string | undefined {
  // `(\s+|$)` y no `\s*`: sin el ancla, "ApikeyNoEsPrefijo" perdería sus 6
  // primeros chars. Con ella, "Apikey" pelado queda vacío → ausente.
  return value?.trim().replace(/^apikey(\s+|$)/i, '').trim() || undefined;
}

/**
 * Hostname de una de las dos APIs, tal como lo carga una persona en un `.env`.
 *
 * El valor se interpola como `https://${hostname}${basePath}`, así que un
 * `https://` pegado del navegador o del manual produce `https://https://api…` —
 * una URL inválida cuyo síntoma (ENOTFOUND o un 4xx del gateway) no señala a la
 * variable. Se saca el esquema, cualquier path pegado atrás y se pasa a
 * minúsculas (los hostnames son case-insensitive, y así `API.correo…` clasifica
 * igual que `api.correo…` en el health check).
 *
 * Devuelve `undefined` cuando no queda nada utilizable, para que el caller caiga
 * a su fallback en vez de armar una URL rota.
 */
export function normalizeHostname(value?: string): string | undefined {
  const trimmed = value?.trim().toLowerCase();
  if (!trimmed) return undefined;

  // `[a-z][a-z0-9+.-]*://` y no `https?://`: si alguien pega `http://` o
  // cualquier otro esquema, el host que queda sigue siendo el dato útil.
  const withoutScheme = trimmed.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  // Todo lo que venga después del primer `/` es path, no host.
  return withoutScheme.split('/')[0]?.trim() || undefined;
}

/**
 * Base path de una de las dos APIs (`/paqar/v1`, `/micorreo/v1`).
 *
 * Normalización defensiva porque el valor lo carga una persona a mano:
 *  - agrega el `/` inicial si falta (`paqar/v1`);
 *  - colapsa los `/` iniciales de más (`//paqar/v1`);
 *  - saca el `/` final (`/paqar/v1/`) — los clientes concatenan
 *    `baseURL + '/orders'`, y el doble slash resultante puede dar 404 o 403 en un
 *    gateway;
 *  - si después de todo eso no queda nada (string vacío, o un `/` pelado), cae al
 *    default en vez de armar una URL rota.
 */
export function normalizeBasePath(
  value: string | undefined,
  fallback: string
): string {
  const trimmed = value?.trim();
  if (!trimmed) return fallback;

  const normalized = trimmed.replace(/^\/*/, '/').replace(/\/+$/, '');
  return normalized || fallback;
}

/** Arma el endpoint resuelto de una API a partir de host + base path. */
function buildApiTarget(
  hostname: string,
  basePath: string | undefined,
  fallbackBasePath: string
): CorreoApiTarget {
  const normalizedPath = normalizeBasePath(basePath, fallbackBasePath);
  return {
    hostname,
    basePath: normalizedPath,
    baseUrl: `https://${hostname}${normalizedPath}`,
  };
}

/**
 * `serviceType`: solo `CP` (Clásico) y `EP` (Expreso) son válidos en
 * `POST /orders`. ⚠️ `EP` está SIN VERIFICAR contra el acuerdo real — el plugin
 * oficial manda siempre `CP`, incluso cuando el comprador eligió Expreso.
 * Cualquier otro valor cae a `CP`.
 */
export function normalizeServiceType(value?: string): CorreoServiceType {
  const upper = value?.trim().toUpperCase();
  return upper === 'EP' ? 'EP' : 'CP';
}

/**
 * `extClient` de `GET /tracking`: EXACTAMENTE 3 chars numéricos. Cualquier otra
 * cosa se descarta (mandarlo mal es peor que omitirlo: omitido, Correo appendea
 * `000` al agreement).
 */
export function normalizeExtClient(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed && /^\d{3}$/.test(trimmed) ? trimmed : undefined;
}

/**
 * Unidad de `product.weight` / `variant.weight`. Medusa NO impone una unidad;
 * este proyecto los trata como kg (ver `andreani-fulfillment`, que los mapea
 * directo a `kilos`). Correo pide GRAMOS, así que la conversión es explícita.
 */
export function normalizeWeightUnit(value?: string): CorreoWeightUnit {
  return value?.trim().toLowerCase() === 'g' ? 'g' : 'kg';
}

/** `deliveryType` de paqar → `deliveredType` de MiCorreo `/rates`. */
export function deliveredTypeForDeliveryType(
  deliveryType: CorreoDeliveryType
): 'D' | 'S' {
  return deliveryType === 'agency' ? 'S' : 'D';
}

// --- helpers ---

function readStr(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function readBool(value: unknown): boolean {
  return value === true || readStr(value)?.toLowerCase() === 'true';
}

function readNum(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
