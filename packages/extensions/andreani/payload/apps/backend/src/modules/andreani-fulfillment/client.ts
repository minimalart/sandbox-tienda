/**
 * Andreani HTTP client (simplified, env-credentialed).
 *
 * - Basic-auth login -> bearer-style `x-authorization-token`.
 * - Token cached IN MEMORY on the instance (no DB token cache).
 * - Endpoints: rates (cotizacion), sucursales, puntos-de-tercero,
 *   create shipment (orden de envio), label, tracking (trazas).
 */

// `import type` para los dos tipos: eran un import de VALOR y el runner de tests
// (`node --experimental-transform-types`) sólo borra lo que está marcado como tipo,
// así que cualquier test que importara este módulo moría con "axios does not provide
// an export named 'AxiosInstance'". Es la razón por la que los tests de Andreani
// eran todos grep sobre el fuente.
import axios from 'axios';
import type { AxiosInstance, AxiosResponse } from 'axios';
import type { Logger } from '@medusajs/framework/types';
import {
  AndreaniAPIError,
  AndreaniAuthError,
  AndreaniRateLimitError,
} from './utils/errors';
import type {
  AndreaniAuthResponse,
  AndreaniCreateShipmentRequest,
  AndreaniProviderOptions,
  AndreaniRateRequest,
  AndreaniRateResponse,
  AndreaniShipmentResponse,
  AndreaniShipmentStatusResponse,
  AndreaniTrackingResponse,
  AndreaniTrazasResponse,
} from './types';

type MinimalLogger = Pick<Logger, 'info' | 'warn' | 'error' | 'debug'>;

// Branch/pickup-point lookups run inside the checkout request cycle and sit
// behind a platform gateway that gives up on the whole request after ~60s.
// A slow Andreani response must fail fast so the route can return a clean
// error well within that window — and so a stalled call never ties up the
// instance long enough to congest it. Shipment creation / label download keep
// the longer instance-wide timeout.
const LOOKUP_TIMEOUT_MS = 12000;

export class AndreaniClient {
  private readonly axiosInstance: AxiosInstance;
  private readonly options: AndreaniProviderOptions;
  private readonly logger: MinimalLogger;

  // In-memory token cache (per client instance).
  private token: string | null = null;
  private tokenExpiry: Date | null = null;
  private isAuthenticating = false;

  constructor(options: AndreaniProviderOptions, logger: MinimalLogger) {
    this.options = options;
    this.logger = logger;

    this.axiosInstance = axios.create({
      baseURL: `https://${options.hostname}`,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });

    this.setupInterceptors();
  }

  // --- Authentication ---

  async authenticate(): Promise<void> {
    if (this.isAuthenticating) {
      while (this.isAuthenticating) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return;
    }

    this.isAuthenticating = true;

    try {
      const basicToken = Buffer.from(
        `${this.options.username}:${this.options.password}`
      ).toString('base64');

      const response: AxiosResponse<AndreaniAuthResponse> =
        await this.axiosInstance.get('/login', {
          headers: {
            Authorization: `Basic ${basicToken}`,
            'Content-Type': undefined,
            Accept: '*/*',
            'User-Agent': 'curl/8.0',
          },
        });

      if (response.data && response.data.token) {
        this.token = response.data.token;
        // Andreani tokens last ~24h; refresh at 23h for safety.
        this.tokenExpiry = new Date(Date.now() + 23 * 60 * 60 * 1000);
      } else {
        throw new Error('No token received from login response');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Andreani authentication failed: ${message}`);
      throw new AndreaniAuthError(
        `Failed to authenticate with Andreani API: ${message}`
      );
    } finally {
      this.isAuthenticating = false;
    }
  }

  isTokenValid(): boolean {
    return Boolean(
      this.token && this.tokenExpiry && this.tokenExpiry.getTime() > Date.now()
    );
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.authenticate();
      return this.isTokenValid();
    } catch {
      return false;
    }
  }

  private async ensureValidToken(): Promise<void> {
    if (this.isTokenValid()) {
      return;
    }
    await this.authenticate();
  }

  // --- Rates (cotizacion) ---

  async getTarifas(params: AndreaniRateRequest): Promise<AndreaniRateResponse> {
    try {
      const queryParams: Record<string, string | number> = {
        // Andreani's /v1/tarifas expects a 4-digit postal code. Callers may pass
        // a full CPA (e.g. "C1121AAF") straight from the cart address, which
        // yields no matching tarifa (→ price 0). Normalize it here so every
        // caller (calculatePrice, rates route) is safe.
        cpDestino:
          this.normalizePostalCode(params.cpDestino) ?? params.cpDestino,
        // Per-service contract override (Domicilio/Sucursal/PuntoDeTercero each
        // quote under their own contract); fall back to the base contract.
        contrato: params.contrato || this.options.contract,
        cliente: this.options.clientCode || '',
      };

      params.bultos.forEach((bulto, index) => {
        queryParams[`bultos[${index}][valorDeclarado]`] = bulto.valorDeclarado;
        queryParams[`bultos[${index}][volumen]`] = bulto.volumen;
        queryParams[`bultos[${index}][kilos]`] = bulto.kilos;

        if (bulto.altoCm && bulto.altoCm > 0) {
          queryParams[`bultos[${index}][altoCm]`] = bulto.altoCm;
        }
        if (bulto.largoCm && bulto.largoCm > 0) {
          queryParams[`bultos[${index}][largoCm]`] = bulto.largoCm;
        }
        if (bulto.anchoCm && bulto.anchoCm > 0) {
          queryParams[`bultos[${index}][anchoCm]`] = bulto.anchoCm;
        }
      });

      const response = await this.axiosInstance.get<AndreaniRateResponse>(
        '/v1/tarifas',
        { params: queryParams }
      );

      return response.data;
    } catch (error) {
      throw this.toApiError(error, 'Failed to get rates');
    }
  }

  // --- Branch / pickup-point lookups ---

  async getSucursales(
    postalCode?: string
  ): Promise<Array<Record<string, unknown>>> {
    try {
      const params: Record<string, string> = { contrato: this.options.contract };
      const cp = this.normalizePostalCode(postalCode);
      if (cp) {
        params.codigoPostal = cp;
      }

      const response = await this.axiosInstance.get('/v2/sucursales', {
        params,
        timeout: LOOKUP_TIMEOUT_MS,
      });
      const data = response.data as
        | { sucursales?: Array<Record<string, unknown>> }
        | Array<Record<string, unknown>>;

      return Array.isArray(data) ? data : data.sucursales || [];
    } catch (error) {
      throw this.toApiError(error, 'Failed to get branches');
    }
  }

  async getPuntosDeTercero(
    postalCode?: string
  ): Promise<Array<Record<string, unknown>>> {
    try {
      const params: Record<string, string> = { contrato: this.options.contract };
      const cp = this.normalizePostalCode(postalCode);
      if (cp) {
        params.atencionPorCodigoPostal = cp;
      }

      const response = await this.axiosInstance.get('/v2/puntos-de-tercero', {
        params,
        timeout: LOOKUP_TIMEOUT_MS,
      });
      const data = response.data as
        | { puntosDeEntrega?: Array<Record<string, unknown>> }
        | Array<Record<string, unknown>>;

      return Array.isArray(data) ? data : data.puntosDeEntrega || [];
    } catch (error) {
      throw this.toApiError(error, 'Failed to get pickup points');
    }
  }

  // --- Shipment creation (orden de envio) ---

  async createShipment(
    shipmentData: AndreaniCreateShipmentRequest
  ): Promise<AndreaniShipmentResponse> {
    try {
      const response = await this.axiosInstance.post<AndreaniShipmentResponse>(
        '/v2/ordenes-de-envio',
        shipmentData
      );
      return response.data;
    } catch (error) {
      throw this.toApiError(error, 'Failed to create shipment');
    }
  }

  async getLabel(shipmentId: string): Promise<string> {
    try {
      const response = await this.axiosInstance.get<{
        etiqueta?: string;
        url?: string;
      }>(`/v2/ordenes-de-envio/${shipmentId}/etiquetas`);

      return response.data.etiqueta || response.data.url || '';
    } catch (error) {
      throw this.toApiError(error, 'Failed to get label');
    }
  }

  /**
   * Descarga el PDF de la etiqueta como Buffer. Acepta una URL completa de
   * Andreani o un path relativo; normaliza el host antes de pegarle.
   */
  async getLabelPdf(labelUrl: string): Promise<Buffer> {
    const path = labelUrl
      .replace(/^https:\/\/apisqa\.andreani\.com/i, '')
      .replace(/^https:\/\/apis\.andreani\.com/i, '');
    try {
      const response = await this.axiosInstance.get<ArrayBuffer>(path, {
        responseType: 'arraybuffer',
        headers: { Accept: 'application/pdf' },
      });
      return Buffer.from(response.data);
    } catch (error) {
      throw this.toApiError(error, 'Failed to download label PDF');
    }
  }

  // --- Tracking (trazas) ---

  async getTracking(trackingNumber: string): Promise<AndreaniTrackingResponse> {
    try {
      const response = await this.axiosInstance.get<AndreaniTrackingResponse>(
        `/v2/envios/${trackingNumber}/trazas`
      );
      return response.data;
    } catch (error) {
      throw this.toApiError(error, 'Failed to get tracking');
    }
  }

  /**
   * Estado del envío (con estadoId). Usado por el job de sync para detectar
   * transiciones admitido/entregado.
   */
  async getShipment(
    trackingNumber: string
  ): Promise<AndreaniShipmentStatusResponse> {
    try {
      const response =
        await this.axiosInstance.get<AndreaniShipmentStatusResponse>(
          `/v2/envios/${trackingNumber}`
        );
      return response.data;
    } catch (error) {
      throw this.toApiError(error, 'Failed to get shipment status');
    }
  }

  /**
   * Trazas en formato `{ eventos: [...] }` (mayúsculas). Algunas cuentas de
   * Andreani devuelven este formato en vez de `{ trazas: [...] }`.
   */
  async getTrazas(trackingNumber: string): Promise<AndreaniTrazasResponse> {
    try {
      const response = await this.axiosInstance.get<AndreaniTrazasResponse>(
        `/v2/envios/${trackingNumber}/trazas`
      );
      return response.data;
    } catch (error) {
      throw this.toApiError(error, 'Failed to get trazas');
    }
  }

  // --- Internals ---

  private normalizePostalCode(postalCode?: string): string | undefined {
    if (!postalCode?.trim()) {
      return undefined;
    }
    const trimmed = postalCode.trim().toUpperCase();
    const cpaMatch = trimmed.match(/^[A-Z]?(\d{4})[A-Z]{0,3}$/);
    return cpaMatch && cpaMatch[1] ? cpaMatch[1] : trimmed;
  }

  private toApiError(error: unknown, prefix: string): Error {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      if (status === 429) {
        const retryAfter = Number(error.response?.headers['retry-after']) || 60;
        return new AndreaniRateLimitError('Rate limit exceeded', retryAfter);
      }
      const apiMessage =
        this.formatApiErrorBody(error.response?.data) || error.message;
      return new AndreaniAPIError(`${prefix}: ${apiMessage}`, status);
    }
    const message = error instanceof Error ? error.message : String(error);
    return new AndreaniAPIError(`${prefix}: ${message}`);
  }

  /**
   * Andreani's 4xx bodies don't use a single field: depending on the endpoint
   * the detail lives in `message`, `detalle`/`detail`, `title`, or an array of
   * field errors (`errores`/`errors`, each with `detalle`/`mensaje`/`message`).
   * Pull whatever is present; fall back to a truncated JSON dump so the real
   * validation reason is never swallowed into a bare "status code 400".
   */
  private formatApiErrorBody(data: unknown): string | undefined {
    if (data == null) return undefined;
    if (typeof data === 'string') {
      return data.trim().length > 0 ? data.trim() : undefined;
    }
    if (typeof data !== 'object') return String(data);

    const obj = data as Record<string, unknown>;
    const str = (v: unknown): string | undefined =>
      typeof v === 'string' && v.trim().length > 0 ? v.trim() : undefined;

    const errorList = Array.isArray(obj.errores)
      ? obj.errores
      : Array.isArray(obj.errors)
        ? obj.errors
        : [];
    const details = errorList
      .map((e) => {
        if (typeof e === 'string') return e;
        if (e && typeof e === 'object') {
          const er = e as Record<string, unknown>;
          return str(er.detalle) || str(er.mensaje) || str(er.message);
        }
        return undefined;
      })
      .filter((v): v is string => Boolean(v));

    const head =
      str(obj.message) || str(obj.detalle) || str(obj.detail) || str(obj.title);

    const parts = [head, ...details].filter(Boolean);
    if (parts.length > 0) return parts.join(' | ');

    try {
      return JSON.stringify(data).slice(0, 500);
    } catch {
      return undefined;
    }
  }

  private setupInterceptors(): void {
    this.axiosInstance.interceptors.request.use(
      async (config) => {
        if (config.url?.includes('/login') || this.isAuthenticating) {
          return config;
        }

        await this.ensureValidToken();

        if (this.token) {
          config.headers.set('x-authorization-token', this.token);
        }

        return config;
      },
      (error) => Promise.reject(error)
    );

    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          // Invalidate cached token so the next call re-authenticates.
          this.token = null;
          this.tokenExpiry = null;
        }
        return Promise.reject(error);
      }
    );
  }
}

export default AndreaniClient;
