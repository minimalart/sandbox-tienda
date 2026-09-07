/**
 * Clasificación del resultado de la sonda de conexión de Correo Argentino.
 *
 * Vive separado del `route.ts` por la misma razón que `_input.ts` y
 * `_status-for-error.ts`: es la parte que decide QUÉ le vamos a decir al
 * operador, y un `route.ts` no se puede testear sin levantar un server. Acá son
 * funciones puras con tests directos.
 *
 * La pregunta que este clasificador tiene que responder NO es "¿funcionó?" sino
 * **"¿qué tiene que hacer la persona que está mirando la pantalla?"**:
 *
 *  - `sin_credenciales` → cargar las env vars. No se salió a la red.
 *  - `ok` → nada.
 *  - `credenciales_invalidas` → revisar la key / el agreement con Correo. No
 *    sirve reintentar.
 *  - `gateway_inalcanzable` → esperar y reintentar; no hay nada roto de nuestro
 *    lado.
 *  - `cuenta_no_activada` (solo MiCorreo) → **pedirle a Correo la activación
 *    comercial del acuerdo.** No es un problema de código y no se arregla
 *    reintentando.
 *  - `sin_tarifas` (solo MiCorreo) → probablemente el par de CPs de la sonda; la
 *    cuenta responde.
 *  - `error_desconocido` → leer el mensaje.
 *
 * Un solo booleano "conectó / no conectó" colapsa las cuatro conclusiones del
 * medio en la misma pantalla inútil, que es exactamente lo que esta ruta existe
 * para evitar.
 *
 * ⚠️ NINGUNA de estas clasificaciones se ejercitó contra la API real de Correo:
 * no hay credenciales todavía. Están derivadas del manual y del comportamiento
 * de los clientes; esta sonda es justamente la herramienta con la que se van a
 * verificar el día que lleguen.
 */

import { PAQAR_AUTH_OK_STATUSES } from '../../../../modules/correo-argentino-fulfillment/clients/paqar-client';
import type { CorreoRatesResult } from '../../../../modules/correo-argentino-fulfillment/types';
import {
  extractErrorMessage,
  isTransientCorreoError,
} from '../../../../modules/correo-argentino-fulfillment/utils/errors';

/** Estados comunes a las dos APIs. */
export type CorreoProbeStatus =
  /** No se pidió la sonda (`?probe=true` ausente): no se salió a la red. */
  | 'no_probado'
  | 'sin_credenciales'
  | 'ok'
  | 'credenciales_invalidas'
  | 'gateway_inalcanzable'
  | 'error_desconocido';

/**
 * Estados de MiCorreo. Suma los dos casos en que la cuenta CONTESTA pero no
 * cotiza, que un `ok` pelado escondería.
 */
export type CorreoMiCorreoProbeStatus =
  | CorreoProbeStatus
  | 'cuenta_no_activada'
  | 'sin_tarifas';

export interface CorreoProbeOutcome<
  TStatus extends string = CorreoProbeStatus,
> {
  status: TStatus;
  /** Status HTTP observado, cuando hubo respuesta. `null` = no hubo. */
  http_status: number | null;
  /** Motivo legible, ya redactado. `null` cuando no hay nada que explicar. */
  message: string | null;
  /**
   * ¿Reintentar la sonda puede dar otro resultado?
   *
   * Sale de `isTransientCorreoError`, o sea de la misma tabla que usa el retry
   * de los workflows: rate limit, 5xx o sin respuesta. Un 401 es `false` a
   * propósito — reintentar una credencial mal cargada solo entrena al operador a
   * apretar el botón en vez de leer el error.
   */
  retryable: boolean;
}

/** Cap del mensaje que se devuelve al admin. */
const MAX_MESSAGE_LENGTH = 500;

/**
 * Saca de un mensaje de error cualquier cosa que se parezca a una credencial.
 *
 * Es defensa en profundidad, no una fuga conocida: hoy `formatCorreoApiErrorBody`
 * formatea el body de Correo (`error` / `message` / `path`) y axios no mete
 * headers en `error.message`, así que no debería llegar un token acá. Pero este
 * mensaje va DERECHO a una respuesta JSON del admin, y el costo de equivocarse
 * es publicar la API-Key: si algún día un upstream decide ecoar el header en el
 * body, el filtro ya está puesto.
 */
export function redactCorreoProbeMessage(message: string): string {
  const redacted = message
    // `Apikey eyJ…`, `Bearer eyJ…`, `Basic dXNlcjpwYXNz`
    .replace(/\b(apikey|bearer|basic)\s+\S+/gi, '$1 ***')
    // JWT pelado, sin prefijo.
    .replace(/\beyJ[\w-]{8,}\.[\w-]+(?:\.[\w-]+)?/g, '***')
    .trim();

  return redacted.length > MAX_MESSAGE_LENGTH
    ? `${redacted.slice(0, MAX_MESSAGE_LENGTH)}…`
    : redacted;
}

/**
 * Status HTTP de un error del módulo, si lo tiene.
 *
 * Tolera el error envuelto (`{ error }`) igual que `isTransientCorreoError`, para
 * que las dos lecturas del mismo error nunca se contradigan.
 */
export function readCorreoErrorStatus(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null;
  const obj = error as Record<string, unknown>;

  if (typeof obj.statusCode === 'number') return obj.statusCode;
  if (obj.error && obj.error !== error) return readCorreoErrorStatus(obj.error);
  return null;
}

/** ¿Es el rate limit de Correo? (no lleva `statusCode`, viaja por `code`) */
function isCorreoRateLimit(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const obj = error as Record<string, unknown>;
  if (obj.code === 'CORREO_RATE_LIMIT') return true;
  if (obj.error && obj.error !== error) return isCorreoRateLimit(obj.error);
  return false;
}

/**
 * Error de la sonda → estado accionable.
 *
 * `401`/`403` son credenciales. `gateway_inalcanzable` se reserva para el caso
 * exacto en que **no hubo respuesta HTTP** (timeout, DNS, conexión cortada), que
 * es lo que `isTransientCorreoError` reconoce como `CorreoAPIError` sin
 * `statusCode`. Pedir las dos condiciones —sin status Y transitorio— evita el
 * error de clasificar como "Correo no responde" un bug NUESTRO que tiró un
 * `Error` pelado: eso es `error_desconocido` y hay que leerlo.
 *
 * Un `5xx` también cae en `error_desconocido`, con su status a la vista y
 * `retryable: true`: el gateway contestó, así que decir "inalcanzable" sería
 * falso, pero reintentar sí puede servir. Un rate limit va al mismo lugar por la
 * misma razón (contestó, y de más).
 *
 * ⚠️ El gateway de paqar devuelve 403 para CUALQUIER path, incluso inexistentes,
 * así que un `credenciales_invalidas` acá puede ser también una URL mal armada.
 * Eso no se puede desambiguar sin credenciales; el mensaje va completo para que
 * el operador vea el path.
 */
export function classifyCorreoProbeError(
  error: unknown
): CorreoProbeOutcome<CorreoProbeStatus> {
  const httpStatus = readCorreoErrorStatus(error);
  const message = redactCorreoProbeMessage(extractErrorMessage(error));
  const retryable = isTransientCorreoError(error);

  let status: CorreoProbeStatus = 'error_desconocido';
  if (httpStatus === 401 || httpStatus === 403) {
    status = 'credenciales_invalidas';
  } else if (httpStatus === null && retryable && !isCorreoRateLimit(error)) {
    status = 'gateway_inalcanzable';
  }

  return {
    status,
    http_status: httpStatus,
    message: message.length > 0 ? message : null,
    retryable,
  };
}

/**
 * Status de `GET /auth` de paqar → estado.
 *
 * Solo se llama con una respuesta que axios consideró exitosa; un 2xx que no sea
 * de los esperados no se da por bueno, porque "el gateway contestó algo" no es
 * "las credenciales sirven".
 */
export function classifyPaqarAuthStatus(
  httpStatus: number
): CorreoProbeOutcome<CorreoProbeStatus> {
  if (PAQAR_AUTH_OK_STATUSES.includes(httpStatus)) {
    return {
      status: 'ok',
      http_status: httpStatus,
      message: null,
      retryable: false,
    };
  }

  return {
    status: 'error_desconocido',
    http_status: httpStatus,
    message: `GET /auth respondió ${httpStatus}; se esperaba ${PAQAR_AUTH_OK_STATUSES.join(' o ')}`,
    retryable: false,
  };
}

// ─── Sonda de MiCorreo ───────────────────────────────────────────────────────

/**
 * Bulto de la sonda de `/rates`. Chico y dentro de los límites duros de MiCorreo
 * (1–25000 g, ningún lado > 150 cm) para que un rechazo NO pueda ser por las
 * medidas: si `/rates` falla con esto, el problema es la cuenta.
 */
export const CORREO_PROBE_PARCEL = {
  /** Gramos: MiCorreo pide el peso en g, no en kg. */
  weight: 1000,
  height: 20,
  width: 15,
  length: 10,
} as const;

/**
 * CP de destino de la sonda: CABA. Es una constante NUESTRA, no una env var, así
 * que se puede devolver en la respuesta sin filtrar configuración.
 */
export const CORREO_PROBE_DESTINATION_POSTAL_CODE = '1414';

/**
 * CP de origen de respaldo, para cuando `CORREO_ARGENTINO_ORIGIN_POSTAL_CODE` no
 * está cargado. Sin esto la sonda no podría correr justo en el caso en que más
 * hace falta (una instalación a medio configurar), y "no pude ni intentar" es
 * peor dato que "cotizó desde un CP de prueba".
 */
export const CORREO_PROBE_FALLBACK_ORIGIN_POSTAL_CODE = '1000';

/**
 * Resultado de `POST /rates` → estado.
 *
 * ⚠️ El caso que justifica todo el paso 2 de la sonda: una cuenta que Correo NO
 * activó comercialmente **autentica perfecto** y devuelve `202` con `rates: []`.
 * Si el health check se quedara en `POST /token`, diría "todo bien" mientras el
 * checkout cotiza $0 y le muestra "Gratuito" al comprador en cada venta
 * (decisión D4). No hay nada que debuggear en el código: hay que pedirle a
 * Correo la activación del acuerdo.
 *
 * `no_rates` (200 con lista vacía) se reporta aparte y NO como `ok`: la cuenta
 * contesta, pero para el par de CPs de la sonda no hay tarifa. Colapsarlo a `ok`
 * sería decir "cotiza" sin haber visto una sola tarifa; colapsarlo a
 * `cuenta_no_activada` sería mandar a pedir una activación que quizá ya está.
 */
export function classifyMiCorreoRatesResult(
  result: Pick<CorreoRatesResult, 'outcome' | 'httpStatus'>
): CorreoProbeOutcome<CorreoMiCorreoProbeStatus> {
  const http_status = result.httpStatus;

  if (result.outcome === 'ok') {
    return { status: 'ok', http_status, message: null, retryable: false };
  }

  if (result.outcome === 'account_not_activated') {
    return {
      status: 'cuenta_no_activada',
      http_status,
      message:
        'MiCorreo autenticó pero devolvió la cotización vacía: la cuenta no está activada comercialmente. Hay que pedirle la activación del acuerdo a Correo.',
      retryable: false,
    };
  }

  return {
    status: 'sin_tarifas',
    http_status,
    message:
      'MiCorreo autenticó y contestó, pero no devolvió tarifas para el par de códigos postales de la sonda.',
    retryable: false,
  };
}

/** Estado de una API cuando faltan sus credenciales: no se sale a la red. */
export function credentialsMissingOutcome(
  missing: readonly string[]
): CorreoProbeOutcome<CorreoProbeStatus> {
  return {
    status: 'sin_credenciales',
    http_status: null,
    message: `Faltan variables de entorno: ${missing.join(', ')}`,
    retryable: false,
  };
}

/** Estado de una API cuando no se pidió la sonda. */
export function notProbedOutcome(): CorreoProbeOutcome<CorreoProbeStatus> {
  return {
    status: 'no_probado',
    http_status: null,
    message: null,
    retryable: false,
  };
}
