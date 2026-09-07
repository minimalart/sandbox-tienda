/**
 * Cliente HTTP de micorreo/v1 — la API para COTIZAR.
 *
 * Es el ÚNICO cotizador real que expone Correo: paqar no tiene endpoint de
 * tarifas (el plugin oficial de WooCommerce tiene `PaqArService::getRates()`
 * como stub hardcodeado que devuelve `price => 0` sin hacer ninguna llamada
 * HTTP; los que integran solo paqar cotizan $0 y reconcilian offline).
 *
 * Auth: `POST /token` con HTTP Basic → JWT, después `Authorization: Bearer`.
 * Espeja la forma de `andreani-fulfillment/client.ts` (cache de token en memoria
 * a nivel de instancia + busy-wait de `isAuthenticating` para llamadas
 * concurrentes), con dos salvedades propias de Correo:
 *
 *  1. ⚠️ `expires` es un string SIN timezone (`"2022-04-26 21:16:20"`) y la
 *     timezone es DESCONOCIDA → el cache se sub-expira defensivamente
 *     (ver `resolveTokenTtlMs`).
 *  2. ⚠️ Las credenciales Basic son por INTEGRADOR, no por comerciante (el
 *     plugin oficial las trae hardcodeadas en plaintext). La identidad del
 *     comerciante va toda en `customerId`.
 */

import axios, { type AxiosInstance } from 'axios';
import type { Logger } from '@medusajs/framework/types';
import {
  CorreoAuthError,
  CorreoValidationError,
  extractErrorMessage,
  toCorreoApiError,
} from '../utils/errors';
import {
  CORREO_MAX_DIMENSION_CM,
  CORREO_MAX_WEIGHT_G,
  CORREO_MIN_WEIGHT_G,
} from '../transformers/consolidate-parcel';
import type {
  CorreoProviderOptions,
  CorreoRate,
  CorreoRateRequest,
  CorreoRatesResult,
  CorreoServiceType,
  CorreoTokenResponse,
} from '../types';

type MinimalLogger = Pick<Logger, 'info' | 'warn' | 'error' | 'debug'>;

const LOOKUP_TIMEOUT_MS = 12000;

/**
 * Fracción del TTL aparente que se considera segura. El `expires` de Correo no
 * trae timezone, así que se usa solo el 80% de la vida aparente del token: si la
 * estimación queda corta, se re-autentica antes de tiempo (barato); si quedara
 * larga, cada `/rates` fallaría con 401 (caro).
 */
export const MICORREO_TOKEN_SAFETY_RATIO = 0.8;
/** TTL cuando `expires` viene ausente, ilegible o ya vencido bajo la asunción UTC. */
export const MICORREO_TOKEN_FALLBACK_TTL_MS = 10 * 60 * 1000;
/** Techo del cache: nunca se confía en un `expires` de más de 1h. */
export const MICORREO_TOKEN_MAX_TTL_MS = 60 * 60 * 1000;

/**
 * Cuánto tiempo cachear el token, en ms.
 *
 * `expires` llega como `"2022-04-26 21:16:20"`, sin offset. Se interpreta como
 * **UTC** a propósito: entre las timezones plausibles (UTC y ART = UTC-3), UTC
 * es la que produce el instante MÁS TEMPRANO, o sea la lectura más conservadora
 * — si en realidad era ART, el token vive 3h más que lo que asumimos y nunca
 * usamos uno vencido. Después se aplica el ratio de seguridad y el techo.
 */
export function resolveTokenTtlMs(expires: unknown, now: number): number {
  if (typeof expires !== 'string' || expires.trim().length === 0) {
    return MICORREO_TOKEN_FALLBACK_TTL_MS;
  }

  const trimmed = expires.trim();
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(trimmed);
  const isoish = trimmed.replace(' ', 'T');
  const parsed = Date.parse(hasZone ? isoish : `${isoish}Z`);

  if (!Number.isFinite(parsed)) {
    return MICORREO_TOKEN_FALLBACK_TTL_MS;
  }

  const apparent = parsed - now;
  if (apparent <= 0) {
    // Puede ser un artefacto de timezone, no un token realmente vencido.
    return MICORREO_TOKEN_FALLBACK_TTL_MS;
  }

  return Math.min(
    Math.floor(apparent * MICORREO_TOKEN_SAFETY_RATIO),
    MICORREO_TOKEN_MAX_TTL_MS
  );
}

/**
 * Parsea la respuesta de `/rates` distinguiendo el motivo de una lista vacía.
 *
 * ⚠️ Una cuenta que Correo todavía NO activó comercialmente devuelve **HTTP 202
 * con `rates: []`**. No es un error de código y no hay nada que debuggear: hay
 * que pedir la activación. Confundirlo con "no hay tarifas para esta ruta" es la
 * forma más rápida de perder un día.
 */
export function parseRatesResponse(
  data: unknown,
  httpStatus: number
): CorreoRatesResult {
  const body = (typeof data === 'object' && data !== null ? data : {}) as Record<
    string,
    unknown
  >;

  const rates = Array.isArray(body.rates)
    ? (body.rates as CorreoRate[]).filter(
        (rate): rate is CorreoRate => typeof rate === 'object' && rate !== null
      )
    : [];

  const outcome: CorreoRatesResult['outcome'] =
    rates.length > 0
      ? 'ok'
      : httpStatus === 202
        ? 'account_not_activated'
        : 'no_rates';

  return {
    outcome,
    rates,
    customerId:
      typeof body.customerId === 'string' ? body.customerId : undefined,
    validTo: typeof body.validTo === 'string' ? body.validTo : undefined,
    httpStatus,
  };
}

/**
 * Elige la tarifa del producto pedido. El match es por `productType` (`"CP"` /
 * `"EP"`), que es el campo que trae el código del producto; `deliveredType`
 * filtra domicilio vs sucursal cuando el caller no lo mandó en el request (si se
 * omite, la API devuelve las tarifas de las dos modalidades).
 */
export function selectRate(
  rates: CorreoRate[],
  criteria: { serviceType: CorreoServiceType; deliveredType?: 'D' | 'S' }
): CorreoRate | undefined {
  const matchesDelivered = (rate: CorreoRate): boolean =>
    !criteria.deliveredType ||
    String(rate.deliveredType ?? '').toUpperCase() === criteria.deliveredType;

  const byProduct = rates.filter(
    (rate) =>
      String(rate.productType ?? '').toUpperCase() === criteria.serviceType
  );

  return (
    byProduct.find(matchesDelivered) ??
    byProduct[0] ??
    rates.filter(matchesDelivered)[0]
  );
}

export class MiCorreoClient {
  private readonly axiosInstance: AxiosInstance;
  private readonly options: CorreoProviderOptions;
  private readonly logger: MinimalLogger;

  // Cache de token en memoria (por instancia de cliente).
  private token: string | null = null;
  private tokenExpiry: Date | null = null;
  private isAuthenticating = false;

  constructor(options: CorreoProviderOptions, logger: MinimalLogger) {
    this.options = options;
    this.logger = logger;

    this.axiosInstance = axios.create({
      // Ya resuelta y normalizada en `normalizeCorreoOptions()`. Puede apuntar a
      // un host DISTINTO del de paqar (`CORREO_ARGENTINO_MICORREO_HOSTNAME`).
      baseURL: options.api.micorreo.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });

    this.setupInterceptors();
  }

  // --- Autenticación ---

  /**
   * `POST /token` → JWT cacheado. Todo error sale como `CorreoAuthError` con el
   * motivo textual adentro: es el contrato que esperan los callers de cotización
   * (el store degrada a "sin tarifa" mirando el mensaje).
   */
  async authenticate(): Promise<void> {
    try {
      await this.acquireToken();
    } catch (error) {
      // Credenciales ausentes: ya es el error final y su mensaje es el que
      // matchea la ruta de store. No se re-envuelve.
      if (error instanceof CorreoAuthError) {
        throw error;
      }
      const message = extractErrorMessage(error);
      this.logger.error(`MiCorreo authentication failed: ${message}`);
      throw new CorreoAuthError(
        `Failed to authenticate with the MiCorreo API: ${message}`
      );
    }
  }

  /**
   * Mismo `POST /token` que `authenticate()`, pero dejando subir el error
   * **TIPADO** (`CorreoAPIError` con `statusCode`, o `CorreoAuthError` cuando
   * faltan las credenciales).
   *
   * Existe para la sonda del health check: `authenticate()` colapsa todo a
   * `CorreoAuthError`, que NO lleva status, así que un 401 de credencial
   * inválida y un timeout del gateway llegan indistinguibles — y son las dos
   * únicas conclusiones accionables. El status lo preserva `toCorreoApiError`, y
   * lo deja `undefined` cuando no hubo respuesta HTTP.
   *
   * Deja el token cacheado igual que `authenticate()`, así el paso 2 de la sonda
   * (`getRates`) reusa el JWT en vez de pedir otro.
   */
  async probeAuth(): Promise<void> {
    try {
      await this.acquireToken();
    } catch (error) {
      throw toCorreoApiError(error, 'MiCorreo token request failed');
    }
  }

  isTokenValid(): boolean {
    return Boolean(
      this.token && this.tokenExpiry && this.tokenExpiry.getTime() > Date.now()
    );
  }

  /**
   * ¿Autentica?
   *
   * ⚠️ Un `true` acá NO significa que la cotización funcione: una cuenta que
   * Correo todavía no activó comercialmente autentica perfecto y devuelve
   * `POST /rates` con **202 y `rates: []`**. Para saber si cotiza de verdad hay
   * que pegarle a `/rates` y mirar el `outcome` (ver `parseRatesResponse`).
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.authenticate();
      return this.isTokenValid();
    } catch {
      return false;
    }
  }

  /**
   * `POST /token` + cacheo del JWT, **sin envolver el error**: lo tipa cada
   * caller según lo que necesite (`authenticate()` un `CorreoAuthError` con el
   * mensaje histórico, `probeAuth()` un error con el status HTTP intacto).
   */
  private async acquireToken(): Promise<void> {
    if (this.isAuthenticating) {
      while (this.isAuthenticating) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return;
    }

    if (!this.options.micorreo.username || !this.options.micorreo.password) {
      throw new CorreoAuthError(
        'MiCorreo credentials are not configured (set CORREO_ARGENTINO_MICORREO_USER / CORREO_ARGENTINO_MICORREO_PASS).'
      );
    }

    this.isAuthenticating = true;

    try {
      const basicToken = Buffer.from(
        `${this.options.micorreo.username}:${this.options.micorreo.password}`
      ).toString('base64');

      const response = await this.axiosInstance.post<CorreoTokenResponse>(
        '/token',
        undefined,
        {
          headers: { Authorization: `Basic ${basicToken}` },
          timeout: LOOKUP_TIMEOUT_MS,
        }
      );

      const token =
        typeof response.data?.token === 'string' ? response.data.token : '';
      if (!token) {
        throw new Error('No token received from POST /token');
      }

      const ttlMs = resolveTokenTtlMs(response.data?.expires, Date.now());
      this.token = token;
      this.tokenExpiry = new Date(Date.now() + ttlMs);
    } finally {
      this.isAuthenticating = false;
    }
  }

  private async ensureValidToken(): Promise<void> {
    if (this.isTokenValid()) {
      return;
    }
    await this.authenticate();
  }

  // --- Cotización ---

  /**
   * `POST /rates`. Valida peso y dimensiones ANTES de la llamada: la API rechaza
   * weight fuera de 1–25000 g y cualquier lado > 150 cm, y un 400 acá es un
   * checkout que degrada a "Gratuito" sin motivo visible.
   */
  async getRates(
    request: Omit<CorreoRateRequest, 'customerId'> & { customerId?: string }
  ): Promise<CorreoRatesResult> {
    const customerId = request.customerId ?? this.options.micorreo.customerId;
    if (!customerId) {
      throw new CorreoValidationError(
        'A customerId is required to quote with MiCorreo (set CORREO_ARGENTINO_CUSTOMER_ID).',
        'customerId'
      );
    }

    this.assertQuotableDimensions(request.dimensions);

    const payload: CorreoRateRequest = {
      customerId,
      postalCodeOrigin: request.postalCodeOrigin,
      postalCodeDestination: request.postalCodeDestination,
      dimensions: request.dimensions,
    };
    // Omitido a propósito cuando el caller no lo define: la API devuelve las
    // tarifas de las dos modalidades y el match lo hace `selectRate`.
    if (request.deliveredType) {
      payload.deliveredType = request.deliveredType;
    }

    try {
      const response = await this.axiosInstance.post<unknown>(
        '/rates',
        payload,
        { timeout: LOOKUP_TIMEOUT_MS }
      );

      const result = parseRatesResponse(response.data, response.status);

      if (result.outcome === 'account_not_activated') {
        this.logger.error(
          `[correo-argentino] MiCorreo devolvió ${response.status} con rates: [] para customerId=${customerId}. ` +
            'La cuenta NO está activada comercialmente — pedir la activación a Correo antes de debuggear el código.'
        );
      }

      return result;
    } catch (error) {
      throw toCorreoApiError(error, 'Failed to get MiCorreo rates');
    }
  }

  private assertQuotableDimensions(
    dimensions: CorreoRateRequest['dimensions']
  ): void {
    const maxWeightG = this.options.limits.maxWeightG || CORREO_MAX_WEIGHT_G;
    const maxDimensionCm =
      this.options.limits.maxDimensionCm || CORREO_MAX_DIMENSION_CM;

    if (
      !Number.isFinite(dimensions.weight) ||
      dimensions.weight < CORREO_MIN_WEIGHT_G ||
      dimensions.weight > maxWeightG
    ) {
      throw new CorreoValidationError(
        `MiCorreo weight must be between ${CORREO_MIN_WEIGHT_G} and ${maxWeightG} grams (got ${dimensions.weight})`,
        'weight'
      );
    }

    for (const side of ['height', 'width', 'length'] as const) {
      const value = dimensions[side];
      if (!Number.isFinite(value) || value <= 0 || value > maxDimensionCm) {
        throw new CorreoValidationError(
          `MiCorreo ${side} must be between 1 and ${maxDimensionCm} cm (got ${value})`,
          side
        );
      }
    }
  }

  private setupInterceptors(): void {
    this.axiosInstance.interceptors.request.use(
      async (config) => {
        if (config.url?.includes('/token') || this.isAuthenticating) {
          return config;
        }

        await this.ensureValidToken();

        if (this.token) {
          config.headers.set('Authorization', `Bearer ${this.token}`);
        }

        return config;
      },
      (error) => Promise.reject(error)
    );

    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          // Invalidar el token cacheado para que la próxima llamada re-autentique.
          // Con un `expires` de timezone desconocida esto es la red de seguridad
          // real del cache: si la estimación quedó larga, se corrige acá.
          this.token = null;
          this.tokenExpiry = null;
        }
        return Promise.reject(error);
      }
    );
  }
}

export default MiCorreoClient;
