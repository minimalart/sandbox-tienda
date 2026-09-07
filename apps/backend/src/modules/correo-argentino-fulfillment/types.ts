/**
 * Correo Argentino fulfillment provider — type definitions.
 *
 * Correo expone DOS APIs distintas, con auth distinta, y hay que usar las dos.
 * Por default comparten host y difieren solo en el path base, pero las dos cosas
 * son configurables (ver env-options.ts):
 *
 *   - paqar/v1    → OPERAR (auth: `authorization: Apikey <key>` + `agreement`
 *                   en cada request, sin intercambio de token).
 *                   /auth, /orders, /orders/{tn}/cancel, /labels, /tracking, /agencies
 *   - micorreo/v1 → COTIZAR (auth: POST /token con HTTP Basic → JWT).
 *                   /rates es el único cotizador real que existe.
 *
 * Multitienda: la configuración y las credenciales se resuelven por tienda en
 * `settings.ts` (`site_setting` + `site_credential`), con el env como fallback.
 * Sin data models: el estado vive en `order.metadata` y en el módulo `delivery`.
 */

/** Productos comerciales habilitados en `POST /orders`. */
export type CorreoServiceType = 'CP' | 'EP';

/**
 * Modalidad de entrega de `POST /orders`. `locker` existe en el contrato pero
 * NO se implementa: los SmartLockers figuran como *currently unavailable* en el
 * FAQ oficial y `/agencies` no trae ningún campo que discrimine un locker de
 * una sucursal.
 */
export type CorreoDeliveryType = 'homeDelivery' | 'agency';

/** Modalidad de entrega de `POST /rates` (MiCorreo). D = domicilio, S = sucursal. */
export type CorreoDeliveredType = 'D' | 'S';

/**
 * Formatos de rótulo funcionales en `POST /labels`. Cualquier otro valor se
 * ignora EN SILENCIO y la API cae al `consRotulo` legacy.
 */
export type CorreoLabelFormat = '10x15' | 'label';

export const CORREO_LABEL_FORMATS: ReadonlyArray<CorreoLabelFormat> =
  Object.freeze(['10x15', 'label']);

/** Unidad en la que el catálogo guarda `product.weight` / `variant.weight`. */
export type CorreoWeightUnit = 'kg' | 'g';

/**
 * Endpoint YA RESUELTO de una de las dos APIs.
 *
 * `baseUrl` se arma una sola vez en `normalizeCorreoOptions()` y es lo único que
 * consumen los clientes: si cada cliente interpolara `https://${host}${path}` por
 * su cuenta, la normalización del path (slash inicial/final) tendría que estar
 * duplicada en los dos y podría divergir. `hostname` y `basePath` quedan
 * expuestos porque son el dato de diagnóstico — nunca para volver a concatenar.
 */
export interface CorreoApiTarget {
  /** Host efectivo de ESTA API (las dos pueden apuntar distinto). */
  hostname: string;
  /** Path base normalizado: con `/` inicial, sin `/` final. */
  basePath: string;
  /** `https://{hostname}{basePath}`. Es el `baseURL` del cliente axios. */
  baseUrl: string;
}

/**
 * Provider options.
 *
 * Se resuelven POR LLAMADA y POR TIENDA en `settings.ts`
 * (`site_setting` + `site_credential`, con la precedencia de la decisión 3). Las
 * que inyecta `medusa-config.ts` en el constructor son el último fallback, y
 * `loadCorreoOptionsFromEnv()` existe sólo para ese arranque, que corre antes de
 * que haya base.
 */
export interface CorreoProviderOptions {
  /**
   * Host de paqar y default del de MiCorreo. Las dos APIs comparten host por
   * DEFAULT, no por contrato: `CORREO_ARGENTINO_MICORREO_HOSTNAME` desacopla el de
   * MiCorreo (el caso real: operar en test y cotizar en prod, porque hay reportes
   * de integradores de que el sandbox de MiCorreo no responde).
   */
  hostname: string;
  /**
   * Endpoints resueltos de las dos APIs. Los clientes leen `api.paqar.baseUrl` /
   * `api.micorreo.baseUrl` y no vuelven a armar nada.
   */
  api: {
    paqar: CorreoApiTarget;
    micorreo: CorreoApiTarget;
  };
  testMode: boolean;

  // --- paqar/v1 ---
  apiKey: string;
  agreement: string;
  /** Identidad del vendedor en `POST /orders` y `POST /labels`. */
  sellerId: string;
  /**
   * `extClient` de `GET /tracking`: EXACTAMENTE 3 chars numéricos. Si se omite,
   * Correo appendea `000` al agreement (`18018` → `18018000`).
   */
  extClient?: string;

  // --- micorreo/v1 ---
  micorreo: {
    /**
     * Credenciales Basic para `POST /token`. OJO: son por INTEGRADOR, no por
     * comerciante (el plugin oficial de WooCommerce las trae hardcodeadas en
     * plaintext). La identidad del comerciante va toda en `customerId`.
     */
    username: string;
    password: string;
    customerId: string;
  };

  serviceType: CorreoServiceType;

  sender: {
    name: string;
    email?: string;
    phone?: string;
    cellphone?: string;
    observation?: string;
  };

  origin: {
    postalCode: string;
    street: string;
    number: string;
    city: string;
    /** Código de UNA letra (ver transformers/province-codes.ts). */
    state: string;
    floor?: string;
    department?: string;
  };

  /** `parcels[].productCategory` — obligatorio en el payload de orders. */
  productCategory: string;

  limits: {
    /**
     * Techo de peso en gramos. Default 25000: es el límite duro de `/rates`,
     * que rechaza por encima de eso sea cual sea el techo comercial del
     * acuerdo (las fuentes oficiales se contradicen: 25 / 30 / 50 kg).
     */
    maxWeightG: number;
    /** Techo por lado en cm. `/rates` valida ≤ 150. */
    maxDimensionCm: number;
    /**
     * "Coeficiente de aforo" para el peso volumétrico (cm³ → kg).
     * ⚠️ El 4000 es un valor DE COMUNIDAD: Correo no lo publica. Configurable
     * a propósito hasta tenerlo por escrito del ejecutivo de cuenta.
     */
    aforoDivisor: number;
  };

  /** Unidad de `product.weight`. Medusa no la impone; el proyecto usa kg. */
  productWeightUnit: CorreoWeightUnit;

  /**
   * Fallback OPT-IN para productos sin dimensiones/peso. Con `enabled: false`
   * (default) la consolidación es estricta y aborta antes de pegarle a la API.
   */
  dimensionFallback: {
    enabled: boolean;
    length: number; // cm
    width: number; // cm
    height: number; // cm
    weight: number; // en `productWeightUnit`, por unidad
  };
}

// --- paqar/v1: POST /orders ---

/**
 * Dirección del payload de orders. TODOS los campos son strings (incluso
 * `streetNumber` y `zipCode`), y `floor` / `department` son obligatorios: se
 * mandan como '' cuando no aplican.
 */
export interface CorreoAddressPayload {
  streetName: string;
  streetNumber: string;
  cityName: string;
  floor: string;
  department: string;
  /** Código de UNA letra. `zipCode` se valida CONTRA esto → mismatch = 400. */
  state: string;
  zipCode: string;
}

export interface CorreoSenderDataPayload {
  id: string;
  businessName: string;
  areaCodePhone: string;
  phoneNumber: string;
  areaCodeCellphone: string;
  cellphoneNumber: string;
  email: string;
  observation: string;
  address: CorreoAddressPayload;
}

export interface CorreoShippingDataPayload {
  name: string;
  areaCodePhone: string;
  phoneNumber: string;
  areaCodeCellphone: string;
  cellphoneNumber: string;
  email: string;
  observation: string;
  address: CorreoAddressPayload;
}

/**
 * Un bulto. ⚠️ La API **descarta todo el array salvo el primer elemento**
 * (manual pág. 15: *"Solo tomará un producto... se ignoran los siguientes"*),
 * así que el pedido entero se consolida en UNO
 * (ver transformers/consolidate-parcel.ts).
 */
export interface CorreoParcelPayload {
  dimensions: {
    height: string;
    width: string;
    depth: string;
  };
  productWeight: string;
  productCategory: string;
  declaredValue: string;
}

export interface CorreoOrderPayload {
  sellerId: string;
  trackingNumber: string;
  order: {
    senderData: CorreoSenderDataPayload;
    shippingData: CorreoShippingDataPayload;
    parcels: CorreoParcelPayload[];
    deliveryType: CorreoDeliveryType;
    /** Obligatorio salvo en `homeDelivery`, donde va ausente. */
    agencyId?: string;
    /** Formato exacto `YYYY-MM-DDTHH:mm:ss-03:00`. */
    saleDate: string;
    /** Documentado como NO funcional en la versión inicial de la API. */
    shipmentClientId?: string;
    serviceType: CorreoServiceType;
  };
}

/** 200 de `POST /orders`: el mismo objeto, con el `trackingNumber` resuelto. */
export interface CorreoOrderResponse {
  sellerId?: string;
  trackingNumber?: string;
  order?: Record<string, unknown>;
  [key: string]: unknown;
}

/** 200 de `PATCH /orders/{trackingNumber}/cancel`. */
export interface CorreoCancelResponse {
  codigo?: number;
  mensaje?: string;
  [key: string]: unknown;
}

// --- paqar/v1: POST /labels (bulk nativo) ---

export interface CorreoLabelRequestItem {
  sellerId: string;
  trackingNumber: string;
}

/**
 * Ítem crudo de la respuesta de `/labels`. La doc de Correo es internamente
 * inconsistente: muestra tanto `status` como `result`, y tanto `fileName` como
 * `filename`. Se aceptan las dos grafías de cada uno.
 * Las fallas parciales llegan con **HTTP 200** y `result: "ERROR: <motivo>"`.
 */
export interface CorreoRawLabelItem {
  trackingNumber?: unknown;
  fileBase64?: unknown;
  fileName?: unknown;
  filename?: unknown;
  result?: unknown;
  status?: unknown;
  [key: string]: unknown;
}

// --- paqar/v1: GET /tracking ---

export interface CorreoTrackingRequestItem {
  trackingNumber: string;
}

/**
 * Evento crudo de tracking. El campo de planta aparece como `facilityId` en un
 * ejemplo del manual y como `facilityCode` en otro → se aceptan los dos.
 * `date` viene en dos formatos distintos según el ejemplo:
 * `"2017-06-27T10:00:00-03:00"` y `"28-06-2022 11:53"`.
 */
export interface CorreoRawTrackingEvent {
  facilityId?: unknown;
  facilityCode?: unknown;
  facility?: unknown;
  statusId?: unknown;
  status?: unknown;
  date?: unknown;
  sign?: unknown;
  [key: string]: unknown;
}

/**
 * Ítem crudo de tracking. El campo de producto aparece como `serviceType` en un
 * ejemplo y `productType` en otro → se aceptan los dos.
 * `quantity: 0` con `event: []` significa "TN sin historial", NO un error.
 */
export interface CorreoRawTrackingItem {
  id?: unknown;
  quantity?: unknown;
  countryId?: unknown;
  serviceType?: unknown;
  productType?: unknown;
  trackingNumber?: unknown;
  event?: unknown;
  [key: string]: unknown;
}

// --- paqar/v1: GET /agencies ---

export interface CorreoAgencyFilters {
  /**
   * Provincia. El módulo manda el código de **UNA letra** (`"B"`, `"C"`), el
   * mismo de `POST /orders`, y no el ISO 3166-2 que dice el manual: es una
   * INFERENCIA sin verificar contra la API. Ver `buildAgencyParams()` en
   * `clients/paqar-client.ts`.
   *
   * `PaqarClient.getAgencies()` acepta además el nombre o el ISO y los
   * normaliza con `normalizeProvinceToCode()` antes de mandar.
   */
  stateId?: string;
  pickupAvailability?: boolean;
  packageReception?: boolean;
}

/**
 * Sucursal cruda. `volumetric_capacity`, `maximum_package_dimensions` y todo
 * `open_hours` vienen `null` en el ejemplo oficial → todo opcional.
 */
export interface CorreoRawAgency {
  location?: unknown;
  status?: unknown;
  schedule?: unknown;
  owner?: unknown;
  email?: unknown;
  phone?: unknown;
  /** Código de planta opaco de 3 chars (ej. `"SCQ"`). */
  agency_id?: unknown;
  agency_name?: unknown;
  package_reception?: unknown;
  pickup_availability?: unknown;
  open_hours?: unknown;
  last_updated?: unknown;
  deactivation_date?: unknown;
  volumetric_capacity?: unknown;
  maximum_package_dimensions?: unknown;
  [key: string]: unknown;
}

// --- micorreo/v1 ---

export interface CorreoTokenResponse {
  token?: unknown;
  /**
   * ⚠️ String SIN timezone (`"2022-04-26 21:16:20"`) y la timezone es
   * DESCONOCIDA. Ver `resolveTokenTtlMs()` en clients/micorreo-client.ts.
   */
  expires?: unknown;
}

export interface CorreoRateRequest {
  customerId: string;
  postalCodeOrigin: string;
  postalCodeDestination: string;
  /** Omitir → la API devuelve las tarifas de las DOS modalidades. */
  deliveredType?: CorreoDeliveredType;
  dimensions: {
    /** Gramos. Validación dura de la API: 1 – 25000. */
    weight: number;
    /** cm. Validación dura de la API: ≤ 150 por lado. */
    height: number;
    width: number;
    length: number;
  };
}

export interface CorreoRate {
  deliveredType?: string;
  /** `"CP"` / `"EP"` — es el campo por el que se matchea el serviceType. */
  productType?: string;
  productName?: string;
  price?: number;
  deliveryTimeMin?: string | number;
  deliveryTimeMax?: string | number;
}

export interface CorreoRawRateResponse {
  customerId?: unknown;
  validTo?: unknown;
  rates?: unknown;
}

/**
 * Resultado de cotizar, con el motivo explícito de una lista vacía.
 *
 *  - `ok`                     → hay tarifas.
 *  - `account_not_activated`  → HTTP **202** con `rates: []`. Correo devuelve
 *    esto hasta que activa la cuenta COMERCIALMENTE. No es un bug de código y
 *    no hay que debuggear nada: hay que pedir la activación.
 *  - `no_rates`               → 200 con `rates: []` (la ruta no tiene servicio).
 */
export type CorreoRatesOutcome = 'ok' | 'account_not_activated' | 'no_rates';

export interface CorreoRatesResult {
  outcome: CorreoRatesOutcome;
  rates: CorreoRate[];
  customerId?: string;
  validTo?: string;
  httpStatus: number;
}

// --- Errores ---

/** Formato de error consistente en las DOS APIs. `message` puede venir vacío. */
export interface CorreoApiErrorBody {
  timestamp?: unknown;
  status?: unknown;
  error?: unknown;
  message?: unknown;
  path?: unknown;
}
