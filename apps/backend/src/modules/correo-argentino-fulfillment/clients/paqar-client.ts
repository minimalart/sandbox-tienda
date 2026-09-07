/**
 * Cliente HTTP de paqar/v1 — la API para OPERAR (órdenes, rótulos, tracking,
 * sucursales).
 *
 * Diferencia clave con el cliente de Andreani: **NO hay intercambio de token**.
 * La API-Key y el agreement van como headers en CADA request, así que toda la
 * maquinaria de `authenticate()` / `tokenExpiry` / `isAuthenticating` /
 * interceptor de 401 de `andreani-fulfillment/client.ts` no aplica y no se
 * porta. Lo que SÍ se reutiliza: el timeout de instancia, el timeout corto para
 * lookups dentro del checkout, y el interceptor de response que normaliza
 * errores.
 *
 * Endpoints: GET /auth, POST /orders, PATCH /orders/{tn}/cancel, POST /labels,
 * GET /tracking, GET /agencies.
 */

import axios, { type AxiosInstance } from 'axios';
import type { Logger } from '@medusajs/framework/types';
import { normalizeProvinceToCode } from '../transformers/province-codes';
import { CorreoValidationError, toCorreoApiError } from '../utils/errors';
import type {
  CorreoAgencyFilters,
  CorreoCancelResponse,
  CorreoLabelFormat,
  CorreoLabelRequestItem,
  CorreoOrderPayload,
  CorreoOrderResponse,
  CorreoProviderOptions,
  CorreoRawAgency,
  CorreoRawLabelItem,
  CorreoRawTrackingItem,
} from '../types';

type MinimalLogger = Pick<Logger, 'info' | 'warn' | 'error' | 'debug'>;

// Los lookups de sucursales corren dentro del ciclo de request del checkout y
// están detrás de un gateway que abandona el request entero a los ~60s. Una
// respuesta lenta de Correo tiene que fallar rápido para que la ruta devuelva un
// error limpio bien dentro de esa ventana — y para que una llamada colgada no
// ocupe la instancia lo suficiente como para congestionarla. El alta de órdenes
// y la descarga de rótulos se quedan con el timeout de instancia.
const LOOKUP_TIMEOUT_MS = 12000;

/**
 * Statuses que `GET /auth` devuelve cuando las credenciales sirven.
 *
 * `204` es el único documentado; `200` se acepta por si el gateway cambia a
 * responder con cuerpo. Es una constante exportada y no dos literales sueltos
 * porque la comparte `testConnection()` (booleano, para los callers viejos) con
 * el clasificador de la ruta de health: si un día se agrega otro status, el
 * health y el booleano tienen que seguir opinando lo mismo.
 */
export const PAQAR_AUTH_OK_STATUSES: readonly number[] = [204, 200];

/**
 * Query params de `GET /tracking`.
 *
 * ⚠️ **INFERENCIA (sin verificar) — punto único de cambio.** El manual documenta
 * los TNs como un **array en el CUERPO de un GET**. Acá se mandan como **query
 * param `trackingNumbers` repetido** (`?trackingNumbers=A&trackingNumbers=B`),
 * asumiendo que el gateway descarta el body de un GET como hacen la mayoría.
 * Nunca se ejercitó contra la API real: no hubo credenciales.
 *
 * Las dos opciones, para poder cambiar de una a la otra en UN solo lugar:
 *  - **Query param repetido (lo que hace el código hoy)**: esta función + el
 *    `axiosInstance.request({ method: 'GET', params, paramsSerializer })` de
 *    `getTracking()`.
 *  - **Array en el body (lo que dice el manual)**: en esa misma llamada, pasar
 *    los TNs como `data` y dejar en `params` solo `extClient`.
 *
 * Extraído de la clase para poder pinear en un test la forma elegida sin
 * mockear axios. Si la QA demuestra que el manual tiene razón, ese test se da
 * vuelta a propósito junto con este comentario.
 */
export function buildTrackingParams(
  trackingNumbers: ReadonlyArray<string | null | undefined>,
  extClient?: string
): { trackingNumbers: string[]; extClient?: string } {
  const tns = (trackingNumbers ?? [])
    .map((tn) => tn?.trim())
    .filter((tn): tn is string => Boolean(tn));

  if (tns.length === 0) {
    throw new CorreoValidationError(
      'At least one trackingNumber is required to query tracking',
      'trackingNumbers'
    );
  }

  return { trackingNumbers: tns, ...(extClient ? { extClient } : {}) };
}

/**
 * Query params de `GET /agencies`.
 *
 * ⚠️ **INFERENCIA (sin verificar) — punto único de cambio de la convención de
 * provincia.** El manual dice que `stateId` es ISO 3166-2 (`"AR-C"`); acá se
 * manda el código de **UNA letra** (`"C"`), el mismo que usa `POST /orders`,
 * asumiendo que la misma API no usa dos convenciones para el mismo dato. Es un
 * razonamiento nuestro, no una respuesta observada.
 *
 * Si `/agencies` falla en QA, esto es lo PRIMERO a mirar, y se cambia acá y en
 * ningún otro lado:
 *  - **Letra (hoy)**: `params.stateId = stateId`.
 *  - **ISO 3166-2 (lo que dice el manual)**: `params.stateId = 'AR-' + stateId`.
 *
 * En los dos casos la ENTRADA sigue aceptando letra, ISO o nombre, porque
 * `normalizeProvinceToCode()` los colapsa a la letra antes de llegar acá.
 */
export function buildAgencyParams(
  filters: CorreoAgencyFilters = {}
): Record<string, string | boolean> {
  const params: Record<string, string | boolean> = {};

  if (filters.stateId) {
    const stateId = normalizeProvinceToCode(filters.stateId);
    if (!stateId) {
      throw new CorreoValidationError(
        `"${filters.stateId}" is not a recognizable Argentine province (expected the one-letter Correo code, ISO 3166-2, or the province name)`,
        'stateId'
      );
    }
    params.stateId = stateId;
  }
  if (typeof filters.pickupAvailability === 'boolean') {
    params.pickup_availability = filters.pickupAvailability;
  }
  if (typeof filters.packageReception === 'boolean') {
    params.package_reception = filters.packageReception;
  }

  return params;
}

export class PaqarClient {
  private readonly axiosInstance: AxiosInstance;
  private readonly options: CorreoProviderOptions;
  private readonly logger: MinimalLogger;

  constructor(options: CorreoProviderOptions, logger: MinimalLogger) {
    this.options = options;
    this.logger = logger;

    this.axiosInstance = axios.create({
      // Ya resuelta y normalizada en `normalizeCorreoOptions()` (host + base
      // path, los dos overrideables por env). Acá no se concatena nada.
      baseURL: options.api.paqar.baseUrl,
      timeout: 30000,
      headers: {
        // Sin token: la credencial viaja en cada request.
        authorization: `Apikey ${options.apiKey}`,
        agreement: options.agreement,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });

    this.setupInterceptors();
  }

  /**
   * `GET /auth` — sonda de credenciales. Devuelve el **status HTTP crudo** y tira
   * el error **TIPADO** (`CorreoAPIError` con `statusCode`) cuando la llamada
   * falla.
   *
   * Existe separada de `testConnection()` porque un booleano borra justo lo que
   * un health check necesita: con `false` no se distingue "la API-Key o el
   * agreement están mal" (401/403) de "el gateway no responde" (timeout, DNS,
   * sin respuesta), y son las dos únicas conclusiones accionables para el
   * operador. `toCorreoApiError` preserva el status en `CorreoAPIError.statusCode`
   * y lo deja `undefined` cuando no hubo respuesta HTTP, que es exactamente la
   * señal que lee `isTransientCorreoError`.
   *
   * ⚠️ Que `GET /auth` discrimine de verdad "credencial inválida" de "path mal
   * armado" está SIN VERIFICAR: el gateway de paqar devuelve 403 para cualquier
   * path, incluso inexistentes. Esta sonda es la herramienta con la que se va a
   * verificar el día que haya credenciales, no una conducta observada.
   */
  async probeAuth(): Promise<number> {
    try {
      const response = await this.axiosInstance.get('/auth', {
        timeout: LOOKUP_TIMEOUT_MS,
      });
      return response.status;
    } catch (error) {
      throw toCorreoApiError(error, 'Correo Argentino auth probe failed');
    }
  }

  /**
   * `GET /auth` → 204 significa credenciales válidas.
   *
   * Se mantiene la firma booleana para los callers que solo quieren un sí/no.
   * Quien necesite el MOTIVO de un `false` tiene que usar `probeAuth()`: acá el
   * `catch` descarta el error a propósito.
   */
  async testConnection(): Promise<boolean> {
    try {
      return PAQAR_AUTH_OK_STATUSES.includes(await this.probeAuth());
    } catch {
      return false;
    }
  }

  // --- Órdenes ---

  async createOrder(payload: CorreoOrderPayload): Promise<CorreoOrderResponse> {
    try {
      const response = await this.axiosInstance.post<CorreoOrderResponse>(
        '/orders',
        payload
      );
      return response.data;
    } catch (error) {
      throw toCorreoApiError(error, 'Failed to create Correo Argentino order');
    }
  }

  /**
   * `PATCH /orders/{trackingNumber}/cancel`.
   *
   * ⚠️ Solo funciona mientras el envío NO fue impuesto (no entró físicamente a la
   * red). Después de la imposición la API rechaza la cancelación; el error se
   * propaga tal cual a propósito, para que el caller lo muestre accionable en
   * vez de tragarlo y dejar al operador creyendo que canceló.
   */
  async cancelOrder(trackingNumber: string): Promise<CorreoCancelResponse> {
    const tn = trackingNumber?.trim();
    if (!tn) {
      throw new CorreoValidationError(
        'A trackingNumber is required to cancel a Correo Argentino order',
        'trackingNumber'
      );
    }

    try {
      const response = await this.axiosInstance.patch<CorreoCancelResponse>(
        `/orders/${encodeURIComponent(tn)}/cancel`
      );
      return response.data;
    } catch (error) {
      throw toCorreoApiError(
        error,
        `Failed to cancel Correo Argentino order ${tn}`
      );
    }
  }

  // --- Rótulos ---

  /**
   * `POST /labels` — **bulk nativo**: una sola llamada devuelve el base64 de
   * todos los TNs pedidos. No hace falta el fan-out de N llamadas que necesita
   * Andreani.
   *
   * `labelFormat` solo acepta `"10x15"` y `"label"`; cualquier otro valor se
   * ignora EN SILENCIO y la API cae al `consRotulo` legacy — por eso el tipo lo
   * restringe en vez de aceptar un string libre.
   *
   * ⚠️ Las fallas parciales devuelven **HTTP 200** con `result: "ERROR: ..."` por
   * ítem: el parseo por ítem vive en `label-download.ts`.
   */
  async getLabels(
    items: CorreoLabelRequestItem[],
    labelFormat: CorreoLabelFormat = '10x15'
  ): Promise<CorreoRawLabelItem[]> {
    if (!items?.length) {
      throw new CorreoValidationError(
        'At least one { sellerId, trackingNumber } is required to request labels',
        'items'
      );
    }

    try {
      const response = await this.axiosInstance.post<unknown>('/labels', items, {
        params: { labelFormat },
      });
      const data = response.data;
      if (Array.isArray(data)) {
        return data as CorreoRawLabelItem[];
      }
      // Defensivo: algunos ejemplos del manual envuelven el array.
      const wrapped = (data as { labels?: unknown })?.labels;
      return Array.isArray(wrapped) ? (wrapped as CorreoRawLabelItem[]) : [];
    } catch (error) {
      throw toCorreoApiError(error, 'Failed to get Correo Argentino labels');
    }
  }

  // --- Tracking ---

  /**
   * `GET /tracking` — acepta VARIOS TNs de una, así que el job de sync puede
   * batchear en vez de hacer una llamada por envío.
   *
   * ⚠️ **INFERENCIA (sin verificar).** El manual documenta el array como
   * **cuerpo de un GET**. Acá los TNs van en el **query param
   * `trackingNumbers`** (plural, repetido) porque asumimos que el gateway
   * descarta el body de un GET — si esa suposición es correcta, el manual daría
   * un error del estilo "required request parameter not present", pero el
   * mensaje exacto (y si pasa siquiera) está por verificar. Se elige el
   * parámetro repetido y no la lista separada por comas porque no se rompe si
   * algún día un TN trae una coma.
   *
   * **Esto es lo PRIMERO a verificar contra `apitest` cuando lleguen las
   * credenciales**: si está mal, el sync de tracking no funciona y el síntoma es
   * silencioso — los envíos se crean bien y nunca actualizan estado. Las dos
   * formas posibles y el punto único de cambio están documentados en
   * `buildTrackingParams()`.
   *
   * SEGÚN EL MANUAL (sin verificar): un TN inexistente NO es un error, devuelve
   * 200 con el ítem en `{ id: null, quantity: 0, event: [] }`. El caller
   * distingue "sin historial" de "no existe" por `event.length === 0`, no por el
   * status HTTP.
   */
  async getTracking(
    trackingNumbers: string[]
  ): Promise<CorreoRawTrackingItem[]> {
    const params = buildTrackingParams(
      trackingNumbers,
      this.options.extClient
    );

    try {
      const response = await this.axiosInstance.request<unknown>({
        method: 'GET',
        url: '/tracking',
        timeout: LOOKUP_TIMEOUT_MS,
        params,
        // `trackingNumbers=A&trackingNumbers=B`, sin los `[]` que axios agrega
        // por default y que el gateway no reconoce.
        paramsSerializer: { indexes: null },
      });

      const data = response.data;
      return Array.isArray(data) ? (data as CorreoRawTrackingItem[]) : [];
    } catch (error) {
      throw toCorreoApiError(error, 'Failed to get Correo Argentino tracking');
    }
  }

  // --- Sucursales ---

  /**
   * `GET /agencies`.
   *
   * ⚠️ **INFERENCIA (sin verificar).** Se manda `stateId` como código de **UNA
   * letra** (`"B"`, `"C"`), el MISMO que usa `POST /orders`, aunque el manual
   * diga ISO 3166-2. Asumimos que el ISO sería rechazado porque en `POST
   * /orders` el campo de provincia es de 1 char; el mensaje exacto y hasta si
   * falla están por verificar. Ver `buildAgencyParams()`: es el único lugar
   * donde se cambia de una convención a la otra.
   *
   * Se normaliza acá con `normalizeProvinceToCode()` para que el caller pueda
   * pasar el nombre, el ISO o la letra indistintamente: un error por una
   * provincia mal formateada es el peor error posible de diagnosticar.
   *
   * Sin filtros devuelve el padrón completo del país (miles de sucursales; el
   * tamaño real no se midió todavía).
   */
  async getAgencies(
    filters: CorreoAgencyFilters = {}
  ): Promise<CorreoRawAgency[]> {
    const params = buildAgencyParams(filters);

    try {
      const response = await this.axiosInstance.get<unknown>('/agencies', {
        params,
        timeout: LOOKUP_TIMEOUT_MS,
      });
      const data = response.data;
      if (Array.isArray(data)) {
        return data as CorreoRawAgency[];
      }
      const wrapped = (data as { agencies?: unknown })?.agencies;
      return Array.isArray(wrapped) ? (wrapped as CorreoRawAgency[]) : [];
    } catch (error) {
      throw toCorreoApiError(error, 'Failed to get Correo Argentino agencies');
    }
  }

  private setupInterceptors(): void {
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => {
        if (axios.isAxiosError(error)) {
          const status = error.response?.status;
          if (status === 401 || status === 403) {
            // Un 403 puede ser credencial inválida, agreement sin permiso, o
            // simplemente una URL mal armada: se sospecha (SIN VERIFICAR) que el
            // gateway responde 403 también para paths inexistentes, así que el
            // status por sí solo no alcanza para diagnosticar. Dejar la pista en
            // el log ahorra horas contra una API que no se puede sondear.
            this.logger.warn(
              `[correo-argentino] paqar respondió ${status} en ${error.config?.url ?? '(sin url)'} — ` +
                'revisá apiKey/agreement y que el path exista (el gateway podría devolver 403 también para paths inexistentes).'
            );
          }
        }
        return Promise.reject(error);
      }
    );
  }
}

export default PaqarClient;
