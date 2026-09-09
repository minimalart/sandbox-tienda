import type { Logger, IEventBusModuleService, RemoteQueryFunction } from '@medusajs/framework/types';
/**
 * Correo Argentino — workflow de generación de envíos on-demand.
 *
 * Es el ÚNICO camino que crea un envío real en Correo (`POST /paqar/v1/orders`).
 * `CorreoArgentinoFulfillmentService.createFulfillment()` es un stub deliberado,
 * igual que en Andreani: el alta contra el carrier vive acá, donde hay
 * orquestación, reintentos y compensación.
 *
 * Orquesta: validar orden → crear el envío en Correo → guardar el ticket en
 * `order.metadata.correo_tickets[]` → linkear el tracking a la DeliveryExecution
 * (best-effort) → emitir `correo.ticket_generated` (solo el primero).
 *
 * Espeja `andreani-generate-tickets.ts`. Tres diferencias deliberadas:
 *
 *  1. **Idempotencia a nivel de orden.** Andreani acumula un envío nuevo por cada
 *     corrida; acá una orden que ya tiene `correo_tickets[]` NO crea otro envío
 *     (devuelve el último ticket con `created: false`) salvo `force: true`.
 *     Motivo: cada alta en Correo es flete facturado.
 *  2. **UN bulto, no N cajas.** `POST /orders` descarta todo `parcels[]` salvo el
 *     primer elemento, así que se consolida con `consolidate-parcel.ts` y el
 *     `box-packer.ts` de Andreani NO se usa (ver §3.1 del plan).
 *  3. **Los dos steps que mutan estado tienen compensación.** Los de Andreani no
 *     la tienen: si el guardado de metadata falla después de crear el envío,
 *     queda un envío huérfano en el carrier y el flete se paga igual. Acá el
 *     rollback cancela el envío (`PATCH /orders/{tn}/cancel`, best-effort porque
 *     solo funciona antes de la imposición) y restaura la metadata previa.
 *
 * Casi toda la lógica vive en funciones PURAS exportadas (validación, decisión de
 * tracking number, armado del ticket, clasificación de errores) porque el backend
 * no tiene runner de integración: los tests son `node:test` sobre funciones
 * puras (`correo-generate-tickets.test.ts`).
 */

import { createHash } from 'node:crypto';
import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk';
import {
  ContainerRegistrationKeys,
  Modules,
} from '@medusajs/framework/utils';
import type { IOrderModuleService } from '@medusajs/framework/types';
import { getCorreoClientsForSite } from '../modules/correo-argentino-fulfillment/get-client';
import {
  consolidateParcel,
  type ConsolidateParcelItem,
  type ConsolidatedParcel,
} from '../modules/correo-argentino-fulfillment/transformers/consolidate-parcel';
import {
  buildCorreoOrderPayload,
  CORREO_MAX_TRACKING_NUMBER_LENGTH,
} from '../modules/correo-argentino-fulfillment/transformers/order-payload';
import {
  normalizePostalCode,
  normalizeProvinceToCode,
} from '../modules/correo-argentino-fulfillment/transformers/province-codes';
import {
  extractErrorMessage,
  isTransientCorreoError,
} from '../modules/correo-argentino-fulfillment/utils/errors';
import type {
  CorreoDeliveryType,
  CorreoOrderPayload,
  CorreoOrderResponse,
  CorreoProviderOptions,
  CorreoServiceType,
} from '../modules/correo-argentino-fulfillment/types';
import {
  DELIVERY_MODULE,
  DELIVERY_TERMINAL_STATUSES,
} from '../modules/delivery/types';
import type DeliveryModuleService from '../modules/delivery/service';

// --- Constantes de contrato ---

/**
 * Clave de `order.metadata` donde se acumulan los tickets de Correo.
 *
 * ⚠️ NO renombrar: el storefront la resuelve por
 * `CARRIER_TICKET_METADATA_KEYS` en `lib/util/get-tracking.ts` (carrier id →
 * clave de metadata), donde `correo_argentino` mapea a esta constante. El shape
 * mínimo que ese archivo consume es `{ tracking_number, generated_at }`.
 */
export const CORREO_TICKETS_METADATA_KEY = 'correo_tickets';

/** URL pública de seguimiento (la misma que usa el storefront). */
export const CORREO_PUBLIC_TRACKING_URL =
  'https://www.correoargentino.com.ar/formularios/e-commerce?id=';

/**
 * `provider_type` de la DeliveryExecution de Correo.
 *
 * Se compara como string y no contra `DeliveryProviderType` porque el union del
 * módulo `delivery` todavía no incluye `correo_argentino` — extenderlo va junto
 * con `DELIVERY_TRANSITIONS` y `POD_REQUIRED_PROVIDER_TYPES` (§7.4 del plan) y es
 * un cambio de otro archivo.
 */
export const CORREO_DELIVERY_PROVIDER_TYPE = 'correo_argentino';

/** Evento de dominio que dispara el aviso de tracking por WhatsApp. */
export const CORREO_TICKET_GENERATED_EVENT = 'correo.ticket_generated';

/** Estados de `payment_collection` que cuentan como orden paga. */
const PAID_PAYMENT_STATUSES: ReadonlySet<string> = new Set([
  'completed',
  'partially_captured',
  'authorized',
]);

export function correoPublicTrackingUrl(trackingNumber: string): string {
  return `${CORREO_PUBLIC_TRACKING_URL}${encodeURIComponent(trackingNumber)}`;
}

// --- Tipos ---

export interface CorreoGenerateTicketInput {
  order_id: string;
  /**
   * Crea un envío NUEVO aunque la orden ya tenga tickets. Rompe la idempotencia
   * a propósito (reimpresión con envío nuevo); el TN determinístico incorpora el
   * índice del ticket, así que el segundo envío no colisiona con el primero.
   */
  force?: boolean;
}

/** Bulto declarado, tal como se mandó. Copia inmutable para auditoría. */
export interface CorreoTicketParcel {
  height: number;
  width: number;
  depth: number;
  /** Peso REAL sumado, en gramos. */
  product_weight_g: number;
  volumetric_weight_g: number;
  /** max(real, volumétrico): el que Correo factura y el que va en el payload. */
  billed_weight_g: number;
  declared_value: number;
  item_count: number;
}

/**
 * Un ticket de Correo, tal como queda en `order.metadata.correo_tickets[]`.
 *
 * `tracking_number` + `generated_at` son el contrato con el storefront
 * (`lib/util/get-tracking.ts` ordena por `generated_at` y arma la URL pública con
 * `tracking_number`). El resto es para el admin y para auditar el envío.
 */
export interface CorreoTicketMetadataEntry {
  generated_at: string;
  tracking_number: string;
  tracking_url: string;
  seller_id: string;
  agreement: string;
  service_type: CorreoServiceType;
  delivery_type: CorreoDeliveryType;
  agency_id?: string;
  parcel: CorreoTicketParcel;
  /** `true` = el TN lo generamos nosotros (CORREO_ARGENTINO_SELF_GENERATED_TN). */
  self_generated_tracking_number: boolean;
  /** Índice del ticket dentro de la orden (0 = primero). */
  sequence: number;
  /**
   * `true` = el alta devolvió "TN duplicado" y se adoptó el envío que ya existía
   * en Correo en vez de crear uno nuevo. Solo puede pasar con TN propio.
   */
  recovered_from_duplicate?: boolean;
}

export interface ValidatedCorreoItem {
  id: string;
  product_id: string;
  title: string;
  quantity: number;
  unit_price: number;
  /** En `options.productWeightUnit` (kg por convención del proyecto). */
  weight: number;
  length: number;
  width: number;
  height: number;
  variant_id: string;
}

export interface ValidatedCorreoOrderData {
  order_id: string;
  display_id: number;
  email: string;
  shipping_address: Record<string, unknown>;
  items: ValidatedCorreoItem[];
  service_type: CorreoServiceType;
  delivery_type: CorreoDeliveryType;
  /** Obligatorio cuando `delivery_type === 'agency'`. */
  agency_id?: string;
  existing_metadata: Record<string, unknown>;
  existing_tickets: CorreoTicketMetadataEntry[];
  /**
   * Canal de venta de la orden → la TIENDA con cuya cuenta hay que despachar.
   *
   * Se arrastra por todos los steps (incluida la compensación) porque el alta
   * contra Correo se hace fuera del provider, y ahí no hay request de dónde sacar
   * la tienda. Ausente = configuración de la instancia, que es el comportamiento
   * de un proyecto mono-tienda.
   */
  sales_channel_id?: string;
  /**
   * `true` = la orden ya tiene tickets y no se pidió `force`: NO se crea otro
   * envío. Es el guard de idempotencia del workflow.
   */
  skip_creation: boolean;
  recipient_name?: string;
  recipient_phone?: string;
  /** Código de UNA letra ya resuelto (§3.4). */
  province_code?: string;
  /** CP de 4 dígitos ya normalizado (acepta CPA `C1121AAF`). */
  postal_code?: string;
  /**
   * Origen resuelto del stock location del fulfillment. Cada campo es opcional;
   * el step de alta completa los huecos con las CORREO_ARGENTINO_ORIGIN_*.
   */
  origin_address?: {
    company?: string;
    address_1?: string;
    address_2?: string;
    city?: string;
    province?: string;
    postal_code?: string;
  };
}

export interface CorreoShipmentResult {
  ticket: CorreoTicketMetadataEntry;
  /** `false` = idempotencia: no se creó nada, el ticket es el que ya existía. */
  created: boolean;
}

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const getString = (source: unknown, key: string): string | undefined => {
  if (!isRecord(source)) return undefined;
  const value = source[key];
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
};

const getStringLike = (source: unknown, key: string): string | undefined => {
  if (!isRecord(source)) return undefined;
  const value = source[key];
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// --- Reintentos ---

/**
 * Corre `fn` reintentando los fallos TRANSITORIOS de Correo (429 / 5xx /
 * timeout sin respuesta) con backoff lineal `500 * intento`. Los deterministas
 * (4xx) y el último intento re-lanzan de una.
 *
 * Mismo helper que `withPickupRetry` de Andreani, con
 * `isTransientCorreoError()`. Ese clasificador mira `code` + `statusCode` además
 * de `instanceof` a propósito: el workflow-engine de Redis rehidrata el error de
 * un step como objeto plano sin prototipo `Error`, y con `instanceof` pelado
 * NINGÚN error de step sería reintentable. No simplificar.
 *
 * ⚠️ El 403 de paqar NO se reintenta: el gateway devuelve 403 para cualquier
 * path, incluso inexistentes, así que reintentar solo quema tiempo.
 */
export async function withPickupRetry<T>(
  fn: () => Promise<T>,
  logger: { warn: (message: string) => void },
  label: string,
  maxAttempts = 3
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isTransientCorreoError(error) || attempt === maxAttempts) {
        throw error;
      }
      const backoff = 500 * attempt;
      logger.warn(
        `[correo-tickets] ${label} falló (intento ${attempt}/${maxAttempts}, reintento en ${backoff}ms): ${extractErrorMessage(error)}`
      );
      await sleep(backoff);
    }
  }
  throw lastError;
}

// --- Decisión del trackingNumber ---

/** Prefijo por default del TN propio. Override: CORREO_ARGENTINO_TN_PREFIX. */
export const CORREO_TN_DEFAULT_PREFIX = 'MER';
/** Largo fijo del sufijo derivado. */
export const CORREO_TN_HASH_LENGTH = 6;
/** Prefijo: alfanumérico y corto, para que el TN entre en 30 chars. */
const CORREO_TN_MAX_PREFIX_LENGTH = 6;

export interface CorreoTrackingNumberSeed {
  order_id: string;
  display_id: number;
  /** Acuerdo comercial: el TN tiene que ser único DENTRO del agreement. */
  agreement: string;
  /** Índice del ticket en la orden (0 = primero). Diferencia regeneraciones. */
  sequence?: number;
  prefix?: string;
}

export interface CorreoTrackingNumberDecision {
  /**
   * `undefined` = la clave se OMITE del payload y Correo genera el TN. No es lo
   * mismo que mandar `""`.
   */
  tracking_number?: string;
  self_generated: boolean;
}

/**
 * ¿Generamos nosotros el `trackingNumber`?
 *
 * `trackingNumber` es OPCIONAL en `POST /orders`: si se omite, Correo lo genera y
 * lo devuelve. Están implementadas las dos vías y el default es que lo genere
 * CORREO (`CORREO_ARGENTINO_SELF_GENERATED_TN` ausente o distinto de `'true'`).
 *
 * TRADEOFF, explícito porque no es obvio:
 *
 *  - **TN propio (flag en `true`) compra IDEMPOTENCIA.** Si el `POST` timeoutea
 *    pero el alta ocurrió del lado de Correo, el reintento con el MISMO TN falla
 *    con "duplicado" y eso es información: el envío ya existe y se adopta (ver
 *    `isCorreoDuplicateTrackingNumberError`). Con TN generado por Correo no hay
 *    forma de saberlo → dos altas, dos envíos, flete doble.
 *  - **Contra:** el manual dice que el formato/longitud del TN del cliente *"se
 *    pacta previamente"* (*"o envía el cliente seller en un formato/longitud
 *    específico previamente definido"*), y todavía no tenemos esa confirmación
 *    por escrito del ejecutivo de cuenta (§13.4 del plan). Un formato no pactado
 *    puede ser rechazado, o peor: aceptado hoy y rechazado cuando Correo endurece
 *    la validación. Y una colisión dentro del agreement es IRRECUPERABLE.
 *
 * Por eso el default es `false`: es la vía sin supuestos. El flag se prende
 * cuando Correo confirme el formato pactado.
 */
export function isCorreoSelfGeneratedTnEnabled(
  env: Record<string, string | undefined> = process.env
): boolean {
  return env.CORREO_ARGENTINO_SELF_GENERATED_TN?.trim().toLowerCase() === 'true';
}

/**
 * TN propio DETERMINÍSTICO: `<prefijo><display_id><sufijo>`, máx 30 chars.
 *
 * Determinístico es el requisito, no un detalle: sin `Math.random()` ni
 * timestamps, dos corridas con el mismo input producen el MISMO TN, que es
 * exactamente lo que hace que el reintento de un `POST` timeouteado sea
 * reconocible como duplicado en vez de crear un segundo envío.
 *
 * `display_id` ya es único por store; el sufijo (sha256 de
 * `agreement|order_id|sequence`, en base36) discrimina entre environments/tenants
 * que comparten agreement y hace que una regeneración (`sequence > 0`) produzca
 * un TN distinto del primer envío.
 */
export function generateCorreoTrackingNumber(
  seed: CorreoTrackingNumberSeed
): string {
  const prefix =
    sanitizeTnToken(seed.prefix ?? CORREO_TN_DEFAULT_PREFIX).slice(
      0,
      CORREO_TN_MAX_PREFIX_LENGTH
    ) || CORREO_TN_DEFAULT_PREFIX;

  const sequence = Math.max(Math.trunc(Number(seed.sequence) || 0), 0);
  const displayId = String(Math.max(Math.trunc(Number(seed.display_id) || 0), 0));

  const digest = createHash('sha256')
    .update(`${seed.agreement}|${seed.order_id}|${sequence}`)
    .digest('hex')
    .slice(0, 12);

  const suffix = BigInt(`0x${digest}`)
    .toString(36)
    .toUpperCase()
    .padStart(CORREO_TN_HASH_LENGTH, '0')
    .slice(-CORREO_TN_HASH_LENGTH);

  // El slice final es un cinturón: prefijo(6) + display_id + sufijo(6) entra
  // holgado en 30, pero un display_id absurdo no debe producir un TN inválido.
  return `${prefix}${displayId}${suffix}`.slice(
    0,
    CORREO_MAX_TRACKING_NUMBER_LENGTH
  );
}

function sanitizeTnToken(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

/**
 * Resuelve la vía de TN a partir del flag y el prefijo YA resueltos.
 *
 * Los dos son `scope: 'site'`: el prefijo forma parte del TN y el TN tiene que ser
 * único dentro del ACUERDO, que también es por tienda. Mezclar el prefijo de una
 * tienda con el acuerdo de otra es cómo se llega a una colisión, que es
 * irrecuperable.
 */
export function resolveCorreoTrackingNumberWith(
  seed: CorreoTrackingNumberSeed,
  settings: { selfGeneratedTrackingNumber: boolean; trackingNumberPrefix?: string }
): CorreoTrackingNumberDecision {
  if (!settings.selfGeneratedTrackingNumber) {
    return { self_generated: false };
  }
  return {
    tracking_number: generateCorreoTrackingNumber({
      ...seed,
      prefix: seed.prefix ?? settings.trackingNumberPrefix,
    }),
    self_generated: true,
  };
}

/**
 * Igual, leyendo el flag y el prefijo de un `env`.
 *
 * Se conserva como forma pura y testeable; el workflow ya no la usa, porque el
 * `env` no ve la configuración de la tienda.
 */
export function resolveCorreoTrackingNumber(
  seed: CorreoTrackingNumberSeed,
  env: Record<string, string | undefined> = process.env
): CorreoTrackingNumberDecision {
  return resolveCorreoTrackingNumberWith(seed, {
    selfGeneratedTrackingNumber: isCorreoSelfGeneratedTnEnabled(env),
    trackingNumberPrefix: env.CORREO_ARGENTINO_TN_PREFIX,
  });
}

/** Payload de alta con el `trackingNumber` todavía opcional. */
export type CorreoOrderPayloadDraft = Omit<
  CorreoOrderPayload,
  'trackingNumber'
> & { trackingNumber?: string };

/**
 * Aplica la decisión de TN sobre el payload ya armado.
 *
 * `buildCorreoOrderPayload` EXIGE `trackingNumber` (es obligatorio en su tipo y
 * valida el largo), así que el payload se arma siempre con el determinístico y en
 * la vía por default la clave se ELIMINA antes de postear. Se elimina y no se
 * manda `''`: el manual no dice qué hace la API con un string vacío, y "omitido"
 * es el único comportamiento documentado.
 */
export function applyCorreoTrackingNumberDecision(
  payload: CorreoOrderPayload,
  decision: CorreoTrackingNumberDecision
): CorreoOrderPayloadDraft {
  if (decision.self_generated) return payload;
  const draft: CorreoOrderPayloadDraft = { ...payload };
  delete draft.trackingNumber;
  return draft;
}

/**
 * TN definitivo: el que devolvió Correo manda; si no vino (respuesta parcial),
 * cae al que mandamos nosotros. `undefined` = no hay TN y el envío no se puede
 * seguir → el caller lo trata como fallo.
 */
export function resolveCorreoTrackingNumberFromResponse(
  response: CorreoOrderResponse | undefined,
  sentTrackingNumber?: string
): string | undefined {
  return (
    getString(response, 'trackingNumber') ??
    getString(response?.order, 'trackingNumber') ??
    (sentTrackingNumber?.trim() || undefined)
  );
}

/**
 * ¿El alta falló porque el `trackingNumber` ya existe?
 *
 * Es la señal que compra el TN propio: significa que el envío YA está creado del
 * lado de Correo (probablemente por un `POST` que timeouteó después de
 * persistir), así que se adopta en vez de crear un segundo envío. El manual no
 * documenta el texto exacto del error, así que el match es por substring sobre
 * las variantes plausibles en castellano e inglés.
 */
export function isCorreoDuplicateTrackingNumberError(message: string): boolean {
  const normalized = message
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return (
    /duplicad|duplicate|ya existe|already exist|existente|repetid/.test(
      normalized
    ) && /tracking|envio|numero|orden|order/.test(normalized)
  );
}

// --- Resolución del método de envío ---

/**
 * ¿Este shipping method es de Correo Argentino?
 *
 * Orden explícito → inferido, nunca al revés. `data.provider` / `data.carrier`
 * los escribe `validateFulfillmentData()` del provider y `data.id` es la
 * fulfillment option (`correo-domicilio` / `correo-sucursal`). El match por
 * nombre queda ÚLTIMO y exige el token `correo` completo: "correo" es una
 * palabra corriente en castellano y un match laxo clasificaría mal cualquier
 * opción que la mencione al pasar.
 */
export function isCorreoShippingMethod(method: unknown): boolean {
  const provider = getString(method, 'provider_id');
  if (provider?.toLowerCase().includes('correo_argentino')) return true;

  const data = isRecord(method) ? method.data : undefined;

  for (const key of ['provider', 'carrier']) {
    const value = getString(data, key)?.toLowerCase();
    if (value === 'correo_argentino' || value === 'correo') return true;
  }

  const optionId = getString(data, 'id')?.toLowerCase();
  if (optionId?.startsWith('correo-')) return true;

  const dataProvider = getString(data, 'provider_id')?.toLowerCase();
  if (dataProvider?.includes('correo_argentino')) return true;

  return hasCorreoNameHint(getString(method, 'name'));
}

function hasCorreoNameHint(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return /\bcorreo\b/.test(normalized);
}

/**
 * `deliveryType` del payload. Acepta el valor de la API (`homeDelivery` /
 * `agency`), el de MiCorreo (`D` / `S`) y el castellano del checkout
 * (`domicilio` / `sucursal`), y cae a la fulfillment option / al nombre.
 * Default `homeDelivery`, que es la modalidad sin datos extra obligatorios.
 */
export function resolveCorreoDeliveryType(method: unknown): CorreoDeliveryType {
  const data = isRecord(method) ? method.data : undefined;
  const raw = getString(data, 'delivery_type')?.toLowerCase();

  if (raw === 'agency' || raw === 's' || raw === 'sucursal') return 'agency';
  if (raw === 'homedelivery' || raw === 'd' || raw === 'domicilio') {
    return 'homeDelivery';
  }

  const optionId = getString(data, 'id')?.toLowerCase();
  if (optionId === 'correo-sucursal') return 'agency';
  if (optionId === 'correo-domicilio') return 'homeDelivery';

  const name = getString(method, 'name')
    ?.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (name?.includes('sucursal')) return 'agency';

  return 'homeDelivery';
}

/**
 * `serviceType`: solo `CP` (Clásico) y `EP` (Expreso). Cualquier otro valor cae
 * al default (el de ENV). No se usa `normalizeServiceType()` de env-options
 * porque ese colapsa todo lo desconocido a `CP` y acá el default configurado
 * puede ser `EP`.
 */
export function resolveCorreoServiceType(
  method: unknown,
  fallback: CorreoServiceType
): CorreoServiceType {
  const data = isRecord(method) ? method.data : undefined;
  const raw = getString(data, 'service_type')?.toUpperCase();
  if (raw === 'CP' || raw === 'EP') return raw;
  return fallback;
}

/**
 * `agencyId` de la sucursal elegida. OBLIGATORIO salvo en `homeDelivery`, y
 * Correo valida además que la sucursal esté habilitada para el agreement.
 *
 * Se busca en `data` (donde la Fase 0 del storefront persiste
 * `{ carrier, branch_id, branch_code }`) y después en la metadata de la orden,
 * que es por donde viaja hoy la sucursal de Andreani. `branch_code` va ANTES que
 * `branch_id`: el `agency_id` de Correo es un código de planta opaco de 3 chars
 * (`"SCQ"`), no un número.
 */
export function resolveCorreoAgencyId(
  method: unknown,
  orderMetadata: unknown
): string | undefined {
  const data = isRecord(method) ? method.data : undefined;

  for (const key of [
    'agency_id',
    'branch_code',
    'branch_id',
    'pickup_location_id',
    'pickup_branch_id',
  ]) {
    const value = getStringLike(data, key);
    if (value) return value;
  }

  for (const key of [
    'correo_agency_id',
    'pickup_branch_code',
    'pickup_branch_id',
  ]) {
    const value = getStringLike(orderMetadata, key);
    if (value) return value;
  }

  return undefined;
}

// --- Validación de CP vs provincia ---

/**
 * CABA: rango EXACTO 1000–1499 (`C1000…` – `C1499…`).
 *
 * Es el ÚNICO rango que se asevera. El resto de la asignación de CPs argentinos
 * no es contigua por provincia (2600 es Santa Fe y 2700 es Buenos Aires; hay
 * provincias con varios bloques), y un falso positivo acá bloquearía una orden
 * legítima — peor que el 400 de Correo, que al menos es autoritativo.
 *
 * Este rango sí vale la pena: es el mismatch que realmente pasa, porque `B`
 * (Provincia de Buenos Aires) y `C` (CABA) son provincias DISTINTAS que el
 * checkout confunde todo el tiempo, y el `zipCode` se valida CONTRA `state` del
 * lado de Correo.
 */
const CABA_POSTAL_MIN = 1000;
const CABA_POSTAL_MAX = 1499;

export type CorreoPostalProvinceCheck = 'ok' | 'mismatch' | 'unknown';

export function checkCorreoPostalCodeProvince(
  postalCode: string,
  provinceCode: string
): CorreoPostalProvinceCheck {
  const zip = Number(postalCode);
  if (!Number.isInteger(zip) || zip < 1000 || zip > 9999) return 'unknown';

  const inCaba = zip >= CABA_POSTAL_MIN && zip <= CABA_POSTAL_MAX;
  const isCaba = provinceCode.trim().toUpperCase() === 'C';

  if (inCaba !== isCaba) return 'mismatch';
  return isCaba ? 'ok' : 'unknown';
}

// --- Lectura de tickets existentes ---

/** Lee `order.metadata.correo_tickets[]` de forma defensiva. */
export function readCorreoTickets(
  metadata: unknown
): CorreoTicketMetadataEntry[] {
  if (!isRecord(metadata)) return [];
  const raw = metadata[CORREO_TICKETS_METADATA_KEY];
  if (!Array.isArray(raw)) return [];
  return raw.filter((entry): entry is CorreoTicketMetadataEntry =>
    isRecord(entry)
  );
}

/** Último ticket por `generated_at` (fallback: el último del array). */
export function latestCorreoTicket(
  tickets: CorreoTicketMetadataEntry[]
): CorreoTicketMetadataEntry | undefined {
  if (tickets.length === 0) return undefined;
  return [...tickets].sort(
    (a, b) =>
      new Date(a.generated_at ?? 0).getTime() -
      new Date(b.generated_at ?? 0).getTime()
  )[tickets.length - 1];
}

// --- Validación de la orden ---

/** Shape laxo de lo que devuelve `query.graph({ entity: 'order' })`. */
export interface CorreoOrderGraphLike {
  id?: unknown;
  display_id?: unknown;
  email?: unknown;
  metadata?: unknown;
  shipping_address?: unknown;
  items?: unknown;
  shipping_methods?: unknown;
  fulfillments?: unknown;
  payment_collections?: unknown;
  /**
   * De qué tienda es la orden. Es lo que decide CON QUÉ CUENTA se despacha, así
   * que viaja por todos los steps: sin esto, el alta se hace con las credenciales
   * del entorno aunque la tienda tenga las suyas.
   */
  sales_channel_id?: unknown;
}

export interface ValidateCorreoOrderOptions {
  order_id: string;
  /** Default de `serviceType` cuando el shipping method no lo trae. */
  default_service_type: CorreoServiceType;
  force?: boolean;
}

/**
 * Valida la orden y extrae todo lo que el alta necesita. PURA: sin container,
 * sin HTTP — el step le pasa lo que devolvió `query.graph`.
 *
 * Los mensajes arrancan con un prefijo `CODIGO: ` porque las rutas admin mapean
 * ese prefijo a un status HTTP (mismo contrato que
 * `admin/andreani/orders/[orderId]/tickets/route.ts`).
 */
export function validateCorreoOrderForTickets(
  order: CorreoOrderGraphLike | undefined | null,
  options: ValidateCorreoOrderOptions
): ValidatedCorreoOrderData {
  if (!order || !getStringLike(order, 'id')) {
    throw new Error(`ORDER_NOT_FOUND: Order ${options.order_id} not found`);
  }

  const orderId = getStringLike(order, 'id') as string;
  const existingMetadata = isRecord(order.metadata)
    ? (order.metadata as UnknownRecord)
    : {};
  const existingTickets = readCorreoTickets(existingMetadata);
  const displayId = Number(order.display_id) || 0;
  const salesChannelId = getStringLike(order, 'sales_channel_id');

  // Idempotencia: una orden ya ticketeada no vuelve a pegarle a `POST /orders`
  // (cada alta es flete facturado). Se corta ACÁ, antes de cualquier otra
  // validación: si el envío ya existe, que falte un dato hoy es irrelevante.
  if (existingTickets.length > 0 && !options.force) {
    const latest = latestCorreoTicket(existingTickets);
    return {
      order_id: orderId,
      display_id: displayId,
      email: getString(order, 'email') ?? '',
      shipping_address: isRecord(order.shipping_address)
        ? (order.shipping_address as UnknownRecord)
        : {},
      items: [],
      service_type: latest?.service_type ?? options.default_service_type,
      delivery_type: latest?.delivery_type ?? 'homeDelivery',
      agency_id: latest?.agency_id,
      existing_metadata: existingMetadata,
      existing_tickets: existingTickets,
      sales_channel_id: salesChannelId,
      skip_creation: true,
    };
  }

  const paymentCollections = Array.isArray(order.payment_collections)
    ? order.payment_collections
    : [];
  const isPaid = paymentCollections.some((pc) => {
    const status = getString(pc, 'status');
    return Boolean(status && PAID_PAYMENT_STATUSES.has(status));
  });
  if (!isPaid) {
    throw new Error(
      'ORDER_NOT_PAID: Order must be paid before creating a Correo Argentino shipment'
    );
  }

  const fulfillments = Array.isArray(order.fulfillments)
    ? order.fulfillments
    : [];
  if (fulfillments.length === 0) {
    throw new Error(
      'ORDER_NOT_FULFILLED: Order must have at least one fulfillment'
    );
  }

  const shippingMethods = Array.isArray(order.shipping_methods)
    ? order.shipping_methods
    : [];
  const correoMethod = shippingMethods.find((method) =>
    isCorreoShippingMethod(method)
  );
  if (!correoMethod) {
    throw new Error(
      `ORDER_NOT_CORREO: Order ${options.order_id} has no Correo Argentino shipping method`
    );
  }

  const items = mapCorreoOrderItems(order.items);
  if (items.length === 0) {
    throw new Error(
      `ORDER_MISSING_ITEMS: Order ${options.order_id} has no items to ship`
    );
  }

  const shippingAddress = isRecord(order.shipping_address)
    ? (order.shipping_address as UnknownRecord)
    : undefined;
  if (!shippingAddress) {
    throw new Error(
      `ORDER_MISSING_SHIPPING_ADDRESS: Order ${options.order_id} has no shipping address`
    );
  }

  const deliveryType = resolveCorreoDeliveryType(correoMethod);
  const serviceType = resolveCorreoServiceType(
    correoMethod,
    options.default_service_type
  );

  const agencyId = resolveCorreoAgencyId(correoMethod, existingMetadata);
  // `agencyId` es obligatorio salvo en homeDelivery. Se valida ACÁ y no en
  // `buildCorreoOrderPayload` para que el error llegue con prefijo mapeable y
  // antes de consolidar el bulto.
  if (deliveryType === 'agency' && !agencyId) {
    throw new Error(
      `CORREO_AGENCY_ID_MISSING: Order ${options.order_id} ships to a Correo agency but no agencyId was selected`
    );
  }

  const recipientName =
    joinName(
      getString(shippingAddress, 'first_name'),
      getString(shippingAddress, 'last_name')
    ) ?? getString(shippingAddress, 'company');
  if (!recipientName) {
    throw new Error(
      `CORREO_MISSING_RECIPIENT_NAME: Order ${options.order_id} shipping address has no recipient name`
    );
  }

  if (!getString(shippingAddress, 'address_1')) {
    throw new Error(
      `CORREO_MISSING_RECIPIENT_STREET: Order ${options.order_id} shipping address has no street (address_1)`
    );
  }

  if (!getString(shippingAddress, 'city')) {
    throw new Error(
      `CORREO_MISSING_RECIPIENT_CITY: Order ${options.order_id} shipping address has no city`
    );
  }

  const rawProvince = getString(shippingAddress, 'province');
  const provinceCode = normalizeProvinceToCode(rawProvince);
  if (!provinceCode) {
    throw new Error(
      `CORREO_INVALID_PROVINCE: Cannot resolve "${rawProvince ?? ''}" to a Correo Argentino province code ` +
        '(expected a single letter, an ISO 3166-2 code like AR-B, or a known province name)'
    );
  }

  const rawPostalCode = getString(shippingAddress, 'postal_code');
  const postalCode = normalizePostalCode(rawPostalCode);
  if (!postalCode || !/^\d{4}$/.test(postalCode)) {
    throw new Error(
      `CORREO_INVALID_POSTAL_CODE: Invalid postal code "${rawPostalCode ?? ''}" (expected 4 digits or a CPA like C1121AAF)`
    );
  }

  if (checkCorreoPostalCodeProvince(postalCode, provinceCode) === 'mismatch') {
    throw new Error(
      `CORREO_POSTAL_CODE_PROVINCE_MISMATCH: Postal code ${postalCode} does not belong to province "${provinceCode}" ` +
        '(CABA is 1000-1499; Correo validates zipCode against state and rejects the mismatch with a 400)'
    );
  }

  return {
    order_id: orderId,
    display_id: displayId,
    email: getString(order, 'email') ?? '',
    shipping_address: shippingAddress,
    items,
    service_type: serviceType,
    delivery_type: deliveryType,
    agency_id: agencyId,
    existing_metadata: existingMetadata,
    existing_tickets: existingTickets,
    sales_channel_id: salesChannelId,
    skip_creation: false,
    recipient_name: recipientName,
    recipient_phone: getString(shippingAddress, 'phone'),
    province_code: provinceCode,
    postal_code: postalCode,
  };
}

function joinName(
  first: string | undefined,
  last: string | undefined
): string | undefined {
  const joined = [first, last].filter(Boolean).join(' ').trim();
  return joined.length > 0 ? joined : undefined;
}

/**
 * Line items → ítems consolidables. Las dimensiones se buscan en variante →
 * producto → item (mismo orden que Andreani): el catálogo las carga en cualquiera
 * de los tres según cómo se importó el producto.
 */
export function mapCorreoOrderItems(rawItems: unknown): ValidatedCorreoItem[] {
  if (!Array.isArray(rawItems)) return [];

  return rawItems.filter(isRecord).map((item) => {
    const variant = isRecord(item.variant) ? item.variant : undefined;
    const product = isRecord(item.product) ? item.product : undefined;

    const dim = (key: 'weight' | 'length' | 'width' | 'height'): number => {
      for (const source of [variant, product, item]) {
        const value = Number(source?.[key]);
        if (Number.isFinite(value) && value > 0) return value;
      }
      return 0;
    };

    return {
      id: getStringLike(item, 'id') ?? '',
      product_id: getStringLike(item, 'product_id') ?? '',
      title: getStringLike(item, 'title') ?? '',
      quantity: Number(item.quantity) || 1,
      unit_price: Number(item.unit_price) || 0,
      weight: dim('weight'),
      length: dim('length'),
      width: dim('width'),
      height: dim('height'),
      variant_id: getStringLike(item, 'variant_id') ?? '',
    };
  });
}

// --- Armado del ticket y clasificación de errores ---

export interface BuildCorreoTicketInput {
  tracking_number: string;
  options: Pick<CorreoProviderOptions, 'sellerId' | 'agreement'>;
  service_type: CorreoServiceType;
  delivery_type: CorreoDeliveryType;
  agency_id?: string;
  parcel: ConsolidatedParcel;
  self_generated: boolean;
  sequence: number;
  recovered_from_duplicate?: boolean;
  /** Default: ahora. Inyectable para que el test sea determinístico. */
  generated_at?: Date;
}

export function buildCorreoTicketEntry(
  input: BuildCorreoTicketInput
): CorreoTicketMetadataEntry {
  return {
    generated_at: (input.generated_at ?? new Date()).toISOString(),
    tracking_number: input.tracking_number,
    tracking_url: correoPublicTrackingUrl(input.tracking_number),
    seller_id: input.options.sellerId,
    agreement: input.options.agreement,
    service_type: input.service_type,
    delivery_type: input.delivery_type,
    ...(input.agency_id ? { agency_id: input.agency_id } : {}),
    parcel: {
      height: input.parcel.dimensions.height,
      width: input.parcel.dimensions.width,
      depth: input.parcel.dimensions.depth,
      product_weight_g: input.parcel.productWeightG,
      volumetric_weight_g: input.parcel.volumetricWeightG,
      billed_weight_g: input.parcel.billedWeightG,
      declared_value: input.parcel.declaredValue,
      item_count: input.parcel.itemCount,
    },
    self_generated_tracking_number: input.self_generated,
    sequence: input.sequence,
    ...(input.recovered_from_duplicate
      ? { recovered_from_duplicate: true }
      : {}),
  };
}

/**
 * ⚠️ `EP` (Expreso) sobre `POST /orders` está SIN VERIFICAR: el plugin oficial de
 * Correo manda siempre `CP`, incluso cuando el comprador eligió Expreso, y
 * ninguna integración pública ejercita `EP`. Se deja pasar —bloquearlo sería
 * decidir por el negocio— pero se loguea, para que cuando el alta falle con un
 * error opaco el log ya diga por dónde mirar.
 *
 * Devuelve `true` si logueó (para poder pinearlo en un test).
 */
export function warnUnverifiedCorreoServiceType(
  serviceType: CorreoServiceType,
  logger: { warn: (message: string) => void },
  orderId: string
): boolean {
  if (serviceType !== 'EP') return false;
  logger.warn(
    `[correo-tickets] Orden ${orderId} pide serviceType "EP" (Expreso), que está SIN VERIFICAR sobre POST /orders — ` +
      'el plugin oficial de Correo manda siempre "CP". Si el alta falla, probá con CP y pedile al ejecutivo de cuenta ' +
      'que confirme si EP está habilitado en el agreement.'
  );
  return true;
}

/**
 * Prefija el mensaje con el código del error para que las rutas admin lo mapeen
 * a un status HTTP. Usa el `.code` del error tipado de Fase 1 cuando existe
 * (`CORREO_MISSING_PRODUCT_DIMENSIONS`, `CORREO_PARCEL_LIMIT_EXCEEDED`,
 * `CORREO_ORDER_PAYLOAD_INVALID`) y `fallbackCode` cuando no.
 *
 * Lee el código con `extractErrorMessage`/acceso por propiedad y no con
 * `instanceof`: el error puede venir rehidratado por el workflow-engine de Redis,
 * sin prototipo.
 */
export function prefixCorreoError(error: unknown, fallbackCode: string): Error {
  const message = extractErrorMessage(error);
  const code = readErrorCode(error) ?? fallbackCode;
  return message.startsWith(`${code}:`)
    ? new Error(message)
    : new Error(`${code}: ${message}`);
}

function readErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const obj = error as UnknownRecord;
  if (obj.error && obj.error !== error) {
    const nested = readErrorCode(obj.error);
    if (nested) return nested;
  }
  const code = obj.code;
  return typeof code === 'string' && /^[A-Z][A-Z0-9_]+$/.test(code)
    ? code
    : undefined;
}

// --- Step 1: validar la orden ---

const validateOrderForCorreoTicketsStep = createStep(
  'validate-order-for-correo-tickets',
  async (input: CorreoGenerateTicketInput, { container }) => {
    const logger = container.resolve<Logger>('logger');
    const query = container.resolve<Omit<RemoteQueryFunction, symbol>>(ContainerRegistrationKeys.QUERY);

    logger.info(`[correo-tickets] Validando orden ${input.order_id}`);

    const { data: orders } = await query.graph({
      entity: 'order',
      fields: [
        'id',
        'display_id',
        'email',
        'metadata',
        // La tienda dueña de la orden. Se pide ACÁ y no se deduce después porque
        // decide con qué cuenta se cotiza, se da de alta y se cancela.
        'sales_channel_id',
        'shipping_address.*',
        'items.*',
        'items.variant.weight',
        'items.variant.length',
        'items.variant.width',
        'items.variant.height',
        'items.product.weight',
        'items.product.length',
        'items.product.width',
        'items.product.height',
        'shipping_methods.*',
        'fulfillments.*',
        'payment_collections.*',
      ],
      filters: { id: input.order_id },
    });

    // El default de producto sale de la configuración de LA TIENDA de la orden, no
    // del entorno: por eso se resuelven las options DESPUÉS del graph y no antes.
    const { options } = await getCorreoClientsForSite(
      container,
      { salesChannelId: getStringLike(orders?.[0], 'sales_channel_id') },
      logger
    );

    const validated = validateCorreoOrderForTickets(orders?.[0], {
      order_id: input.order_id,
      default_service_type: options.serviceType,
      force: input.force,
    });

    if (validated.skip_creation) {
      logger.info(
        `[correo-tickets] Orden ${validated.order_id} ya tiene ${validated.existing_tickets.length} ticket(s) de Correo — ` +
          'no se crea otro envío (idempotencia). Usá force: true para regenerar.'
      );
      return new StepResponse(validated);
    }

    // Origen del envío = punto de despacho del comerciante: pertenece al stock
    // location del fulfillment, no a la orden. Las CORREO_ARGENTINO_ORIGIN_*
    // quedan como fallback campo por campo.
    const locationId = (
      Array.isArray(orders?.[0]?.fulfillments) ? orders[0].fulfillments : []
    )
      .map((f: unknown) => getStringLike(f, 'location_id'))
      .find((v: string | undefined): v is string => Boolean(v));

    if (locationId) {
      const { data: locations } = await query.graph({
        entity: 'stock_location',
        fields: ['id', 'name', 'address.*'],
        filters: { id: locationId },
      });
      const addr = locations?.[0]?.address;
      if (isRecord(addr)) {
        validated.origin_address = {
          company: getString(addr, 'company'),
          address_1: getString(addr, 'address_1'),
          address_2: getString(addr, 'address_2'),
          city: getString(addr, 'city'),
          province: getString(addr, 'province'),
          postal_code: getString(addr, 'postal_code'),
        };
      } else {
        logger.warn(
          `[correo-tickets] Stock location ${locationId} sin dirección — se usará el origen de CORREO_ARGENTINO_ORIGIN_*`
        );
      }
    }

    logger.info(
      `[correo-tickets] Orden ${validated.order_id} válida — paga, fulfilled, ` +
        `deliveryType: ${validated.delivery_type}, serviceType: ${validated.service_type}` +
        (validated.agency_id ? `, agencyId: ${validated.agency_id}` : '')
    );

    return new StepResponse(validated);
  }
);

// --- Step 2: crear el envío en Correo (`POST /orders`) ---

const createCorreoTicketShipmentStep = createStep(
  'create-correo-ticket-shipment',
  async (input: ValidatedCorreoOrderData, { container }) => {
    const logger = container.resolve<Logger>('logger');

    // Idempotencia: la orden ya tiene envío. Se devuelve el ticket existente sin
    // tocar la API — no hay `when()` en el medio a propósito, así el guard vive
    // en un solo lugar y es testeable como función pura.
    if (input.skip_creation) {
      const latest = latestCorreoTicket(input.existing_tickets);
      if (!latest) {
        throw new Error(
          `CORREO_TICKET_STATE_INVALID: Order ${input.order_id} was marked as already ticketed but has no readable ticket`
        );
      }
      logger.info(
        `[correo-tickets] Orden ${input.order_id} reutiliza el envío ${latest.tracking_number} (idempotencia)`
      );
      // Compensación SIN `tracking_number`: no se creó nada, no hay qué
      // cancelar. Ver el comentario de `CorreoCancelCompensation` sobre por qué
      // no se devuelve `undefined`.
      return new StepResponse<CorreoShipmentResult, CorreoCancelCompensation>(
        { ticket: latest, created: false },
        { order_id: input.order_id, sales_channel_id: input.sales_channel_id }
      );
    }

    // ⚠️ ACÁ ESTABA EL BUG. Este step es el ÚNICO que crea envíos reales y
    // construía sus clientes con `getCorreoClients()`, o sea con las credenciales
    // del ENTORNO — mientras `calculatePrice` ya cotizaba con las de la tienda. La
    // tienda B cotizaba con su cuenta y despachaba contra el acuerdo de la A.
    const { paqar, options, operation } = await getCorreoClientsForSite(
      container,
      { salesChannelId: input.sales_channel_id },
      logger
    );

    // UN bulto: `POST /orders` descarta todo `parcels[]` salvo el primero. El
    // box-packer de Andreani NO se usa acá (§3.1 del plan).
    let parcel: ConsolidatedParcel;
    try {
      parcel = consolidateParcel(
        input.items.map(
          (item): ConsolidateParcelItem => ({
            id: item.id,
            title: item.title,
            quantity: item.quantity,
            weight: item.weight,
            length: item.length,
            width: item.width,
            height: item.height,
            unit_price: item.unit_price,
          })
        ),
        {
          logger,
          weightUnit: options.productWeightUnit,
          aforoDivisor: options.limits.aforoDivisor,
          maxWeightG: options.limits.maxWeightG,
          maxDimensionCm: options.limits.maxDimensionCm,
          dimensionFallback: options.dimensionFallback.enabled
            ? {
                length: options.dimensionFallback.length,
                width: options.dimensionFallback.width,
                height: options.dimensionFallback.height,
                weight: options.dimensionFallback.weight,
              }
            : undefined,
        }
      );
    } catch (error) {
      throw prefixCorreoError(error, 'CORREO_PARCEL_INVALID');
    }

    const sequence = input.existing_tickets.length;
    const decision = resolveCorreoTrackingNumberWith(
      {
        order_id: input.order_id,
        display_id: input.display_id,
        agreement: options.agreement,
        sequence,
      },
      operation
    );

    warnUnverifiedCorreoServiceType(input.service_type, logger, input.order_id);

    // Origen: dirección del stock location primero, ENV rellena los huecos.
    const origin = input.origin_address;
    const originOverride = {
      street: origin?.address_1 || options.origin.street,
      number: origin?.address_2 || options.origin.number,
      city: origin?.city || options.origin.city,
      state: origin?.province || options.origin.state,
      postalCode: origin?.postal_code || options.origin.postalCode,
      floor: options.origin.floor,
      department: options.origin.department,
    };

    let payload: CorreoOrderPayload;
    try {
      payload = buildCorreoOrderPayload(
        {
          // Siempre se arma con el TN determinístico; en la vía por default la
          // clave se elimina abajo (ver applyCorreoTrackingNumberDecision).
          trackingNumber:
            decision.tracking_number ??
            generateCorreoTrackingNumber({
              order_id: input.order_id,
              display_id: input.display_id,
              agreement: options.agreement,
              sequence,
              prefix: operation.trackingNumberPrefix,
            }),
          deliveryType: input.delivery_type,
          serviceType: input.service_type,
          agencyId: input.agency_id,
          parcel,
          recipient: {
            name: input.recipient_name ?? '',
            email: input.email,
            phone: input.recipient_phone,
            address: {
              street: getString(input.shipping_address, 'address_1') ?? '',
              number: getString(input.shipping_address, 'address_2'),
              city: getString(input.shipping_address, 'city') ?? '',
              state:
                input.province_code ??
                getString(input.shipping_address, 'province') ??
                '',
              postalCode:
                input.postal_code ??
                getString(input.shipping_address, 'postal_code') ??
                '',
            },
          },
          originOverride,
          senderNameOverride: origin?.company || options.sender.name,
        },
        options
      );
    } catch (error) {
      throw prefixCorreoError(error, 'CORREO_ORDER_PAYLOAD_INVALID');
    }

    const draft = applyCorreoTrackingNumberDecision(payload, decision);

    logger.info(
      `[correo-tickets] Creando envío para orden ${input.order_id} — ` +
        `deliveryType: ${input.delivery_type}, serviceType: ${input.service_type}, ` +
        `bulto ${parcel.dimensions.height}x${parcel.dimensions.width}x${parcel.dimensions.depth}cm ` +
        `(${parcel.billedWeightG}g facturados), TN: ${decision.self_generated ? draft.trackingNumber : 'lo genera Correo'}`
    );

    let response: CorreoOrderResponse | undefined;
    let recoveredFromDuplicate = false;

    try {
      response = await withPickupRetry(
        // El tipo declara `trackingNumber` obligatorio porque la vía con
        // idempotencia siempre lo manda; la API lo tiene como opcional.
        () => paqar.createOrder(draft as CorreoOrderPayload),
        logger,
        `Alta de envío para la orden ${input.order_id}`
      );
    } catch (error) {
      const message = extractErrorMessage(error);

      // El payoff del TN propio: "duplicado" significa que el envío YA existe
      // del lado de Correo (un POST anterior timeouteó después de persistir), así
      // que se adopta en vez de crear un segundo envío y pagar flete doble.
      if (
        decision.self_generated &&
        decision.tracking_number &&
        isCorreoDuplicateTrackingNumberError(message)
      ) {
        logger.warn(
          `[correo-tickets] Correo rechazó el alta de la orden ${input.order_id} por TN duplicado ` +
            `(${decision.tracking_number}) — el envío ya existía y se adopta sin crear otro: ${message}`
        );
        recoveredFromDuplicate = true;
      } else if (isTransientCorreoError(error)) {
        throw new Error(
          `CORREO_ORDER_CREATE_UNAVAILABLE: Correo Argentino no pudo dar de alta el envío de la orden ${input.order_id}: ${message}`
        );
      } else {
        throw new Error(
          `CORREO_ORDER_CREATE_REJECTED: Correo Argentino rechazó el alta del envío de la orden ${input.order_id}: ${message}`
        );
      }
    }

    const trackingNumber = resolveCorreoTrackingNumberFromResponse(
      response,
      decision.tracking_number
    );
    if (!trackingNumber) {
      throw new Error(
        `CORREO_TRACKING_NUMBER_MISSING: Correo Argentino created the shipment for order ${input.order_id} but returned no trackingNumber`
      );
    }

    const ticket = buildCorreoTicketEntry({
      tracking_number: trackingNumber,
      options,
      service_type: input.service_type,
      delivery_type: input.delivery_type,
      agency_id: input.agency_id,
      parcel,
      self_generated: decision.self_generated,
      sequence,
      recovered_from_duplicate: recoveredFromDuplicate,
    });

    logger.info(
      `[correo-tickets] Envío creado para la orden ${input.order_id} — tracking: ${ticket.tracking_number}`
    );

    return new StepResponse<CorreoShipmentResult, CorreoCancelCompensation>(
      { ticket, created: true },
      {
        tracking_number: ticket.tracking_number,
        order_id: input.order_id,
        // La compensación tiene que cancelar contra LA MISMA cuenta que creó el
        // envío. Sin esto, el rollback le pega a la API con el acuerdo del entorno,
        // Correo responde que el envío no existe y queda vivo (y facturado).
        sales_channel_id: input.sales_channel_id,
      }
    );
  },
  /**
   * Compensación: cancelar el envío recién creado.
   *
   * Andreani no compensa nada y eso es un agujero: si el step siguiente falla, el
   * envío queda vivo en el carrier, el flete se factura y nadie tiene el TN. Acá
   * se intenta `PATCH /orders/{tn}/cancel`.
   *
   * Best-effort A PROPÓSITO: la cancelación solo funciona mientras el envío NO
   * fue impuesto, así que después de la imposición esto falla — y una compensación
   * que tira error enmascara el error ORIGINAL que disparó el rollback. Se loguea
   * con `error` (no `warn`) porque un envío huérfano cuesta plata y tiene que
   * llegar a Sentry.
   */
  async (compensateInput, { container }) => {
    if (!compensateInput?.tracking_number) return;

    const logger = container.resolve<Logger>('logger');
    const { paqar } = await getCorreoClientsForSite(
      container,
      { salesChannelId: compensateInput.sales_channel_id },
      logger
    );

    try {
      await paqar.cancelOrder(compensateInput.tracking_number);
      logger.info(
        `[correo-tickets] Rollback: envío ${compensateInput.tracking_number} de la orden ${compensateInput.order_id} cancelado en Correo`
      );
    } catch (error) {
      logger.error(
        `[correo-tickets] Rollback INCOMPLETO: no se pudo cancelar el envío ${compensateInput.tracking_number} ` +
          `de la orden ${compensateInput.order_id} — queda un envío huérfano en Correo (el flete se factura igual). ` +
          `Cancelalo a mano si todavía no fue impuesto: ${extractErrorMessage(error)}`
      );
    }
  }
);

/**
 * Payload de compensación del step de creación.
 *
 * `tracking_number` es OPCIONAL y ese es el discriminador: ausente significa
 * "este step no creó nada" (rama de idempotencia) y la compensación no tiene
 * qué cancelar.
 *
 * ⚠️ No se modela como `Compensation | undefined`. El `InvokeFn` de Medusa
 * resuelve el slot de compensación a `TOutput | TCompensateInput` y **no acepta
 * `undefined`**: devolver `new StepResponse(x, undefined)` en una rama y
 * `new StepResponse(x, comp)` en otra colapsa el tipo del step entero a
 * `unknown`, y el workflow deja de tipar sin ningún error que apunte a la causa.
 * Siempre se devuelve un objeto; la ausencia se expresa DENTRO del objeto.
 */
interface CorreoCancelCompensation {
  tracking_number?: string;
  order_id: string;
  /** La tienda con cuya cuenta se creó el envío. Ver el comentario del `StepResponse`. */
  sales_channel_id?: string;
}

// --- Step 3: guardar el ticket en metadata ---

interface SaveCorreoTicketMetadataInput {
  order_id: string;
  existing_metadata: Record<string, unknown>;
  existing_tickets: CorreoTicketMetadataEntry[];
  ticket: CorreoTicketMetadataEntry;
  created: boolean;
}

/** Mismo criterio que `CorreoCancelCompensation`: `saved: false` = no-op. */
interface SaveCorreoTicketMetadataCompensation {
  saved: boolean;
  order_id: string;
  existing_metadata: Record<string, unknown>;
  existing_tickets: CorreoTicketMetadataEntry[];
}

const saveCorreoTicketMetadataStep = createStep(
  'save-correo-ticket-metadata',
  async (input: SaveCorreoTicketMetadataInput, { container }) => {
    const logger = container.resolve<Logger>('logger');

    // Idempotencia: no se creó nada, no hay nada que appendear.
    if (!input.created) {
      // Mismo motivo que en create-correo-ticket-shipment: la compensación
      // siempre es un objeto; `saved: false` es lo que la vuelve no-op.
      return new StepResponse<
        { total_tickets: number; saved: boolean },
        SaveCorreoTicketMetadataCompensation
      >(
        { total_tickets: input.existing_tickets.length, saved: false },
        {
          saved: false,
          order_id: input.order_id,
          existing_metadata: input.existing_metadata,
          existing_tickets: input.existing_tickets,
        }
      );
    }

    const orderModuleService = container.resolve(
      Modules.ORDER
    ) as IOrderModuleService;

    const updatedTickets = [...input.existing_tickets, input.ticket];

    await orderModuleService.updateOrders([
      {
        id: input.order_id,
        metadata: {
          ...input.existing_metadata,
          [CORREO_TICKETS_METADATA_KEY]: updatedTickets,
        },
      },
    ]);

    logger.info(
      `[correo-tickets] Ticket #${updatedTickets.length} guardado en la orden ${input.order_id}`
    );

    return new StepResponse<
      { total_tickets: number; saved: boolean },
      SaveCorreoTicketMetadataCompensation
    >(
      { total_tickets: updatedTickets.length, saved: true },
      {
        saved: true,
        order_id: input.order_id,
        existing_metadata: input.existing_metadata,
        existing_tickets: input.existing_tickets,
      }
    );
  },
  // Rollback: dejar `correo_tickets` como estaba. Sin esto, un fallo aguas abajo
  // dejaría un ticket apuntando a un envío que la compensación del step anterior
  // ya canceló.
  async (compensateInput, { container }) => {
    // `saved: false` ⇒ el step no escribió metadata (rama de idempotencia):
    // restaurarla igual pisaría tickets que este workflow nunca tocó.
    if (!compensateInput?.saved) return;

    const logger = container.resolve<Logger>('logger');
    const orderModuleService = container.resolve(
      Modules.ORDER
    ) as IOrderModuleService;

    try {
      await orderModuleService.updateOrders([
        {
          id: compensateInput.order_id,
          metadata: {
            ...compensateInput.existing_metadata,
            [CORREO_TICKETS_METADATA_KEY]: compensateInput.existing_tickets,
          },
        },
      ]);
      logger.info(
        `[correo-tickets] Rollback: metadata de tickets de la orden ${compensateInput.order_id} restaurada`
      );
    } catch (error) {
      logger.error(
        `[correo-tickets] Rollback INCOMPLETO: no se pudo restaurar correo_tickets de la orden ` +
          `${compensateInput.order_id}: ${extractErrorMessage(error)}`
      );
    }
  }
);

// --- Step 4: linkear el tracking a la DeliveryExecution (sidecar) ---

/**
 * Escribe `tracking_number` + `external_shipment_id` del ticket en la
 * DeliveryExecution de la orden, para que `sync-correo-tracking-status` pueda
 * pollear el estado.
 *
 * Mismo motivo que en Andreani: la DeliveryExecution se crea VACÍA en
 * `order.fulfillment_created`, y con `tracking_number` en null el poller hace
 * early-return y el estado de la orden nunca avanza.
 *
 * Para Correo el TN ES el identificador del envío, así que `external_shipment_id`
 * lleva el mismo valor (Andreani tiene además un agrupador de bultos).
 *
 * Robustez deliberada: cualquier fallo se traga como `warn`. Un problema del
 * sidecar NO debe romper la generación del envío, que ya está creado y facturado.
 * Sin compensación: nada que revertir aguas abajo.
 */
const linkCorreoTicketToDeliveryExecutionStep = createStep(
  'link-correo-ticket-to-delivery-execution',
  async (
    input: { order_id: string; ticket: CorreoTicketMetadataEntry },
    { container }
  ) => {
    const logger = container.resolve<Logger>('logger');

    try {
      const query = container.resolve<Omit<RemoteQueryFunction, symbol>>(ContainerRegistrationKeys.QUERY);

      const { data: orders } = await query.graph({
        entity: 'order',
        fields: [
          'id',
          'delivery_executions.id',
          'delivery_executions.provider_type',
          'delivery_executions.status',
        ],
        filters: { id: input.order_id },
      });

      const executions = (orders?.[0]?.delivery_executions ?? []) as Array<{
        id?: string;
        provider_type?: string;
        status?: string;
      } | null>;

      const terminal = new Set<string>(DELIVERY_TERMINAL_STATUSES);
      const targets = executions
        .filter(
          (e): e is { id: string; provider_type?: string; status?: string } =>
            Boolean(e?.id) &&
            e?.provider_type === CORREO_DELIVERY_PROVIDER_TYPE &&
            !terminal.has(e?.status ?? '')
        )
        .map((e) => e.id);

      if (targets.length === 0) {
        logger.warn(
          `[correo-tickets] Orden ${input.order_id} sin DeliveryExecution de Correo activa — ` +
            'el envío se creó OK, pero el sync de tracking no aplica (execution terminal o inexistente).'
        );
        return new StepResponse({ updated: 0 });
      }

      const service = container.resolve<DeliveryModuleService>(DELIVERY_MODULE);

      await service.updateDeliveryExecutions(
        targets.map((id) => ({
          id,
          tracking_number: input.ticket.tracking_number || null,
          external_shipment_id: input.ticket.tracking_number || null,
        }))
      );

      logger.info(
        `[correo-tickets] Tracking ${input.ticket.tracking_number} linkeado a ${targets.length} DeliveryExecution(s) de la orden ${input.order_id}`
      );

      return new StepResponse({ updated: targets.length });
    } catch (error) {
      logger.warn(
        `[correo-tickets] No se pudo linkear el tracking a la DeliveryExecution de la orden ${input.order_id} ` +
          `(el envío se creó OK): ${extractErrorMessage(error)}`
      );
      return new StepResponse({ updated: 0 });
    }
  }
);

// --- Step 5: emitir `correo.ticket_generated` ---

/**
 * Emite `correo.ticket_generated` con `{ order_id, tracking_number }` — el primer
 * momento determinístico en que existe un tracking real de Correo. Lo consume el
 * subscriber de WhatsApp que manda el mensaje con seguimiento.
 *
 * Guard de idempotencia: SOLO en la primera generación (`existing_ticket_count
 * === 0`) y solo si efectivamente se creó un envío. Las regeneraciones acumulan
 * tickets y no re-disparan el mensaje.
 *
 * Best-effort/no-fatal: un fallo del event bus (o aguas abajo, de WhatsApp) NO
 * debe romper la generación del envío. Sin compensación: nada que revertir.
 */
const emitCorreoTicketGeneratedStep = createStep(
  'emit-correo-ticket-generated',
  async (
    input: {
      order_id: string;
      tracking_number: string;
      existing_ticket_count: number;
      created: boolean;
    },
    { container }
  ) => {
    const logger = container.resolve<Logger>('logger');

    if (!input.created || input.existing_ticket_count > 0) {
      return new StepResponse({ emitted: false });
    }

    try {
      const eventBus = container.resolve<IEventBusModuleService>(Modules.EVENT_BUS);
      await eventBus.emit({
        name: CORREO_TICKET_GENERATED_EVENT,
        data: {
          order_id: input.order_id,
          tracking_number: input.tracking_number,
        },
      });
      logger.info(
        `[correo-tickets] Evento ${CORREO_TICKET_GENERATED_EVENT} emitido para la orden ${input.order_id} (tracking ${input.tracking_number})`
      );
      return new StepResponse({ emitted: true });
    } catch (error) {
      logger.warn(
        `[correo-tickets] No se pudo emitir ${CORREO_TICKET_GENERATED_EVENT} para la orden ${input.order_id} ` +
          `(el envío se creó OK): ${extractErrorMessage(error)}`
      );
      return new StepResponse({ emitted: false });
    }
  }
);

// --- Workflow ---

export const correoGenerateTicketsWorkflow = createWorkflow(
  'correo-generate-tickets',
  (input: CorreoGenerateTicketInput) => {
    const validatedOrder = validateOrderForCorreoTicketsStep(input);
    const shipmentResult = createCorreoTicketShipmentStep(validatedOrder);

    const metadataInput = transform(
      { validatedOrder, shipmentResult },
      ({ validatedOrder, shipmentResult }) => ({
        order_id: validatedOrder.order_id,
        existing_metadata: validatedOrder.existing_metadata,
        existing_tickets: validatedOrder.existing_tickets,
        ticket: shipmentResult.ticket,
        created: shipmentResult.created,
      })
    );

    const saveResult = saveCorreoTicketMetadataStep(metadataInput);

    // Habilita el sync de estado. Best-effort: no rompe nada si el sidecar falla
    // o no existe.
    const linkInput = transform(
      { validatedOrder, shipmentResult },
      ({ validatedOrder, shipmentResult }) => ({
        order_id: validatedOrder.order_id,
        ticket: shipmentResult.ticket,
      })
    );
    linkCorreoTicketToDeliveryExecutionStep(linkInput);

    // Notifica el tracking real por WhatsApp — solo en la primera generación (el
    // guard vive en el step, leyendo existing_tickets ANTES de acumular).
    const emitInput = transform(
      { validatedOrder, shipmentResult },
      ({ validatedOrder, shipmentResult }) => ({
        order_id: validatedOrder.order_id,
        tracking_number: shipmentResult.ticket.tracking_number,
        existing_ticket_count: validatedOrder.existing_tickets.length,
        created: shipmentResult.created,
      })
    );
    emitCorreoTicketGeneratedStep(emitInput);

    return new WorkflowResponse(
      transform(
        { validatedOrder, shipmentResult, saveResult },
        ({ validatedOrder, shipmentResult, saveResult }) => ({
          order_id: validatedOrder.order_id,
          display_id: validatedOrder.display_id,
          ticket: shipmentResult.ticket,
          created: shipmentResult.created,
          total_tickets: saveResult.total_tickets,
        })
      )
    );
  }
);

export default correoGenerateTicketsWorkflow;
