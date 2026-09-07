/**
 * Helpers compartidos de las rutas store de Correo Argentino.
 *
 * Tres cosas viven acá:
 *
 *  1. El envelope de error con timestamp, igual que
 *     `store/andreani/rates/route.ts:41-45`. Está compartido para que las tres
 *     rutas de store devuelvan LA MISMA forma: el storefront tiene un solo
 *     parser de errores.
 *  2. La validación estricta de código postal. Ver el comentario de
 *     `parseStorePostalCode()`: `normalizePostalCode()` del módulo NO valida.
 *  3. El parseo de los filtros de `/agencies`, que es donde se cruzan las dos
 *     convenciones de provincia.
 */

import type { MedusaResponse } from '@medusajs/framework/http';
import {
  normalizePostalCode,
  normalizeProvinceToCode,
  provinceCodeToIso,
  type CorreoProvinceCode,
} from '../../../modules/correo-argentino-fulfillment/transformers/province-codes';

export interface CorreoStoreErrorPayload {
  code: string;
  message: string;
}

/**
 * Envelope de error de las rutas store: `{ error: { code, message }, timestamp }`.
 *
 * El `timestamp` no es decorativo: el storefront cachea cotizaciones y
 * sucursales, y sin él es imposible saber si el error que se está mostrando es
 * de ahora o de hace diez minutos.
 */
export function sendCorreoStoreError(
  res: MedusaResponse,
  status: number,
  payload: CorreoStoreErrorPayload
): void {
  res.status(status).json({ error: payload, timestamp: new Date().toISOString() });
}

/**
 * Valida y normaliza un código postal argentino para una ruta store. Acepta el
 * CP de 4 dígitos y el CPA completo (`"C1414AAF"` → `"1414"`); devuelve
 * `undefined` para cualquier otra cosa.
 *
 * ⚠️ Esto NO es un alias de `normalizePostalCode()` del módulo, y la diferencia
 * es un bug esperando: ese helper es un NORMALIZADOR, no un validador — cuando
 * el regex del CPA no matchea devuelve **el input tal cual en mayúsculas**
 * (`"abc"` → `"ABC"`). Sirve para el camino del payload de órdenes, donde el
 * workflow valida aparte y tira `CORREO_INVALID_POSTAL_CODE`. Pero un
 * `if (!normalizePostalCode(input))` en una ruta NUNCA rechaza basura: la deja
 * pasar y el 400 lo tira Correo, cuando ya se gastó una llamada a la API y el
 * mensaje de error no dice nada útil.
 *
 * Acá el contrato es el de `store/andreani/rates/route.ts:68`: 4 dígitos o 400.
 */
export function parseStorePostalCode(
  value: unknown
): string | undefined {
  if (typeof value !== 'string' || value.trim().length === 0) return undefined;
  const normalized = normalizePostalCode(value);
  // El único resultado aceptable son 4 dígitos: cualquier residuo del input
  // significa que no era ni un CP ni un CPA.
  return normalized && /^\d{4}$/.test(normalized) ? normalized : undefined;
}

export interface CorreoAgencyQuery {
  /** Código de UNA letra, listo para el query param `stateId` de la API. */
  state_id?: CorreoProvinceCode;
  /** CP de 4 dígitos; se filtra en memoria, la API no lo soporta. */
  postal_code?: string;
  pickup_availability?: boolean;
  package_reception?: boolean;
}

export type CorreoAgencyQueryResult =
  | { ok: true; query: CorreoAgencyQuery }
  | { ok: false; error: CorreoStoreErrorPayload };

/**
 * Parsea los filtros de `GET /store/correo-argentino/agencies`.
 *
 * La provincia se acepta en CUALQUIERA de sus tres representaciones (letra
 * `"B"`, ISO 3166-2 `"AR-B"`, nombre `"Buenos Aires"` / `"CABA"`) y siempre sale
 * como **letra**.
 *
 * ⚠️ Que salga la letra y no el ISO es una **INFERENCIA (sin verificar)**: el
 * manual dice que el query param `stateId` de `GET /agencies` es ISO 3166-2, y
 * el módulo asume que en realidad quiere la misma letra que `POST /orders`. La
 * decisión y cómo darla vuelta en un solo lugar están documentadas en
 * `buildAgencyParams()` (`modules/correo-argentino-fulfillment/clients/paqar-client.ts`).
 * Acá se acepta el ISO en la ENTRADA (el storefront puede tenerlo, y rechazarlo
 * sería gratuito) pero se convierte antes de salir, así que esta capa no cambia
 * en ninguno de los dos escenarios.
 *
 * Se aceptan `state_id` y `province` como nombres del parámetro: el primero
 * espeja el de la API de Correo, el segundo es el que usa el checkout.
 */
export function parseCorreoAgencyQuery(query: unknown): CorreoAgencyQueryResult {
  const provinceRaw =
    firstString(readField(query, 'state_id')) ??
    firstString(readField(query, 'province')) ??
    '';
  const postalCodeRaw = firstString(readField(query, 'postal_code')) ?? '';

  const result: CorreoAgencyQuery = {};

  if (provinceRaw.length > 0) {
    const code = normalizeProvinceToCode(provinceRaw);
    if (!code) {
      return {
        ok: false,
        error: {
          code: 'INVALID_PROVINCE',
          message: `"${provinceRaw}" no es una provincia argentina reconocible`,
        },
      };
    }
    result.state_id = code;
  }

  if (postalCodeRaw.length > 0) {
    const postalCode = parseStorePostalCode(postalCodeRaw);
    if (!postalCode) {
      return {
        ok: false,
        error: {
          code: 'INVALID_POSTAL_CODE',
          message: 'Código postal inválido (se esperan 4 dígitos o un CPA)',
        },
      };
    }
    result.postal_code = postalCode;
  }

  const pickup = optionalBoolean(readField(query, 'pickup_availability'));
  if (pickup !== undefined) {
    result.pickup_availability = pickup;
  }
  const reception = optionalBoolean(readField(query, 'package_reception'));
  if (reception !== undefined) {
    result.package_reception = reception;
  }

  return { ok: true, query: result };
}

/**
 * Clave de caché de un lote de sucursales.
 *
 * SOLO entran los filtros que se le mandan a la API (`stateId` y los dos flags).
 * `postal_code` se filtra en memoria y por eso NO va: si formara parte de la
 * clave, cada CP del país sería una entrada distinta de caché — miles de
 * llamadas a la API para cachear una y otra vez el mismo padrón provincial.
 */
export function correoAgencyCacheKey(query: CorreoAgencyQuery): string {
  return [
    query.state_id ?? 'all',
    query.pickup_availability === undefined
      ? 'any'
      : String(query.pickup_availability),
    query.package_reception === undefined
      ? 'any'
      : String(query.package_reception),
  ].join('|');
}

/**
 * ISO 3166-2 de una provincia, para exponerlo en la respuesta.
 *
 * Es para el CONSUMIDOR de la API (el storefront trabaja con ISO), nunca para
 * mandárselo a Correo. Ver la advertencia de `parseCorreoAgencyQuery()`.
 */
export function provinceIsoOrNull(
  code: CorreoProvinceCode | undefined
): string | null {
  return code ? (provinceCodeToIso(code) ?? null) : null;
}

// --- internals ---

/**
 * Express parsea `?a=1&a=2` como array. Se toma el primer valor útil en vez de
 * hacer `String(value)`, que sobre un array devolvería `"1,2"` y terminaría en
 * un 400 incomprensible.
 */
function firstString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = firstString(entry);
      if (found) return found;
    }
  }
  return undefined;
}

/**
 * `undefined` cuando el filtro no vino: para los flags de sucursal, "no filtres"
 * y "dame las que NO reciben paquetes" son cosas distintas.
 */
function optionalBoolean(value: unknown): boolean | undefined {
  const raw = firstString(value);
  if (raw === undefined) {
    return typeof value === 'boolean' ? value : undefined;
  }
  const normalized = raw.toLowerCase();
  if (normalized === 'true' || normalized === '1') return true;
  if (normalized === 'false' || normalized === '0') return false;
  return undefined;
}

function readField(source: unknown, key: string): unknown {
  if (typeof source !== 'object' || source === null) return undefined;
  return (source as Record<string, unknown>)[key];
}
