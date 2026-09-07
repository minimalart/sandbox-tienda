/**
 * Payload de `POST /orders` de paqar/v1.
 *
 * Tres cosas del contrato que no son negociables y que este transformer
 * garantiza:
 *
 *  1. **Todos los valores del payload son STRINGS**, incluso los numéricos
 *     (`streetNumber`, `zipCode`, `productWeight`, `declaredValue`, cada
 *     dimensión). Mandar un number es un 400.
 *  2. `agencyId` es **obligatorio** salvo cuando `deliveryType = homeDelivery`,
 *     donde tiene que ir AUSENTE (no vacío).
 *  3. `saleDate` tiene formato exacto `YYYY-MM-DDTHH:mm:ss-03:00`.
 *
 * `parcels` sale con UN solo elemento a propósito: la API descarta el resto
 * (ver transformers/consolidate-parcel.ts).
 */

import { normalizeProvinceToCode, normalizePostalCode } from './province-codes';
import type { ConsolidatedParcel } from './consolidate-parcel';
import type {
  CorreoAddressPayload,
  CorreoDeliveryType,
  CorreoOrderPayload,
  CorreoParcelPayload,
  CorreoProviderOptions,
  CorreoServiceType,
} from '../types';

/** `trackingNumber` de `POST /orders`: máx 30 chars, único por agreement. */
export const CORREO_MAX_TRACKING_NUMBER_LENGTH = 30;

/** Error de armado del payload: falta un campo que la API exige. */
export class CorreoOrderPayloadError extends Error {
  public readonly code: string;
  public readonly field: string;

  constructor(field: string, message: string) {
    super(message);
    this.name = 'CorreoOrderPayloadError';
    this.code = 'CORREO_ORDER_PAYLOAD_INVALID';
    this.field = field;
  }
}

export interface CorreoPhone {
  areaCode: string;
  number: string;
}

export interface CorreoPartyAddressInput {
  street: string;
  number?: string;
  city: string;
  /** Código de una letra, ISO 3166-2 o nombre — se normaliza acá. */
  state: string;
  postalCode: string;
  floor?: string;
  department?: string;
}

export interface CorreoRecipientInput {
  name: string;
  email?: string;
  /** Teléfono en cualquier formato; se parte con `splitArgentinePhone`. */
  phone?: string;
  cellphone?: string;
  /** Pre-partidos, si el caller los tiene: evitan la heurística. */
  phoneParts?: CorreoPhone;
  cellphoneParts?: CorreoPhone;
  observation?: string;
  address: CorreoPartyAddressInput;
}

export interface BuildCorreoOrderInput {
  /**
   * TN propio (idempotencia: si `POST /orders` timeoutea pero el alta ocurrió,
   * el reintento falla con "duplicado" y sabemos que ya está creado).
   * Ver §5.3 del plan — pendiente de confirmar el formato con Correo.
   */
  trackingNumber: string;
  deliveryType: CorreoDeliveryType;
  /** Default: `options.serviceType`. */
  serviceType?: CorreoServiceType;
  /** Obligatorio cuando `deliveryType === 'agency'`. */
  agencyId?: string;
  parcel: ConsolidatedParcel;
  recipient: CorreoRecipientInput;
  /** Default: ahora. */
  saleDate?: Date | string;
  /** Documentado como NO funcional; solo se incluye si el caller lo pasa. */
  shipmentClientId?: string;
  /** Default: `options.productCategory`. */
  productCategory?: string;
  /** Reemplaza el origen de ENV (ej. el stock location del fulfillment). */
  originOverride?: CorreoPartyAddressInput;
  senderNameOverride?: string;
}

export function buildCorreoOrderPayload(
  input: BuildCorreoOrderInput,
  options: CorreoProviderOptions
): CorreoOrderPayload {
  const trackingNumber = required(
    input.trackingNumber,
    'trackingNumber',
    'A trackingNumber is required to create a Correo Argentino order'
  );

  if (trackingNumber.length > CORREO_MAX_TRACKING_NUMBER_LENGTH) {
    throw new CorreoOrderPayloadError(
      'trackingNumber',
      `trackingNumber exceeds ${CORREO_MAX_TRACKING_NUMBER_LENGTH} characters: "${trackingNumber}"`
    );
  }

  const sellerId = required(
    options.sellerId,
    'sellerId',
    'A sellerId is required (set CORREO_ARGENTINO_SELLER_ID or CORREO_ARGENTINO_AGREEMENT).'
  );

  const senderPhone =
    resolvePhone(undefined, options.sender.phone) ?? emptyPhone();
  const senderCellphone =
    resolvePhone(undefined, options.sender.cellphone) ?? emptyPhone();

  const recipientPhone =
    resolvePhone(input.recipient.phoneParts, input.recipient.phone) ??
    emptyPhone();
  // El checkout suele traer un solo teléfono. Correo pide fijo Y celular: se
  // duplica el que haya en los dos pares antes que mandar el celular vacío, que
  // es el que usa el repartidor para avisar.
  const recipientCellphone =
    resolvePhone(input.recipient.cellphoneParts, input.recipient.cellphone) ??
    recipientPhone;

  const origin = input.originOverride ?? {
    street: options.origin.street,
    number: options.origin.number,
    city: options.origin.city,
    state: options.origin.state,
    postalCode: options.origin.postalCode,
    floor: options.origin.floor,
    department: options.origin.department,
  };

  const order: CorreoOrderPayload['order'] = {
    senderData: {
      // El manual no define qué es `senderData.id` más allá de un identificador
      // del remitente; se usa el sellerId, que es la identidad que Correo ya
      // conoce para este acuerdo.
      id: sellerId,
      businessName: required(
        input.senderNameOverride ?? options.sender.name,
        'sender.name',
        'A sender name is required (set CORREO_ARGENTINO_SENDER_NAME).'
      ),
      areaCodePhone: senderPhone.areaCode,
      phoneNumber: senderPhone.number,
      areaCodeCellphone: senderCellphone.areaCode,
      cellphoneNumber: senderCellphone.number,
      email: options.sender.email ?? '',
      observation: options.sender.observation ?? '',
      address: buildAddress(origin, 'origin'),
    },
    shippingData: {
      name: required(
        input.recipient.name,
        'recipient.name',
        'A recipient name is required to create a Correo Argentino order'
      ),
      areaCodePhone: recipientPhone.areaCode,
      phoneNumber: recipientPhone.number,
      areaCodeCellphone: recipientCellphone.areaCode,
      cellphoneNumber: recipientCellphone.number,
      email: input.recipient.email ?? '',
      observation: input.recipient.observation ?? '',
      address: buildAddress(input.recipient.address, 'recipient.address'),
    },
    parcels: [
      buildParcel(
        input.parcel,
        input.productCategory ?? options.productCategory
      ),
    ],
    deliveryType: input.deliveryType,
    saleDate: formatCorreoSaleDate(input.saleDate ?? new Date()),
    serviceType: input.serviceType ?? options.serviceType,
  };

  if (input.deliveryType === 'agency') {
    order.agencyId = required(
      input.agencyId,
      'agencyId',
      'agencyId is required when deliveryType is "agency"'
    );
  }

  if (input.shipmentClientId?.trim()) {
    order.shipmentClientId = input.shipmentClientId.trim();
  }

  return { sellerId, trackingNumber, order };
}

/**
 * `saleDate` con el formato exacto que pide el manual:
 * `YYYY-MM-DDTHH:mm:ss-03:00`. Correo opera en hora argentina fija (Argentina no
 * tiene DST desde 2009), así que el offset es literalmente `-03:00` y la fecha
 * se convierte a ese huso antes de formatear — usar el huso del servidor (UTC en
 * producción) desplazaría la fecha 3 horas y puede cambiar el DÍA.
 */
export function formatCorreoSaleDate(date: Date | string): string {
  const parsed = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    throw new CorreoOrderPayloadError(
      'saleDate',
      `Invalid saleDate: ${String(date)}`
    );
  }

  const art = new Date(parsed.getTime() - 3 * 60 * 60 * 1000);
  const pad = (value: number): string => String(value).padStart(2, '0');

  return (
    `${art.getUTCFullYear()}-${pad(art.getUTCMonth() + 1)}-${pad(art.getUTCDate())}` +
    `T${pad(art.getUTCHours())}:${pad(art.getUTCMinutes())}:${pad(art.getUTCSeconds())}` +
    '-03:00'
  );
}

/**
 * Parte un teléfono argentino en `{ areaCode, number }`, que es como los pide
 * Correo.
 *
 * Heurística, no exactitud: se limpia el `+54`, el `9` de móvil y el `0` de
 * larga distancia, y después el área son los 2 primeros dígitos si arranca en
 * `11` (CABA/GBA) o los 3 primeros en cualquier otro caso. Los códigos de área
 * argentinos tienen 2, 3 o 4 dígitos y no hay forma de discriminarlos sin la
 * tabla completa del ENACOM; el corte de 3 dígitos deja mal partido un área de 4
 * (ej. 2954), pero Correo reconcatena los dos campos para que el repartidor
 * llame, así que el impacto es nulo. Cuando el caller tiene los campos por
 * separado, debe pasar `phoneParts` y saltear esto.
 */
export function splitArgentinePhone(raw: string | undefined): CorreoPhone {
  const digits = (raw ?? '').replace(/\D/g, '');
  if (digits.length === 0) {
    return emptyPhone();
  }

  let local = digits;
  if (local.startsWith('54')) {
    local = local.slice(2);
  }
  if (local.startsWith('0')) {
    local = local.slice(1);
  }
  // El `9` de móvil solo aplica al formato internacional (54 9 ...), donde el
  // número local queda en 11 dígitos.
  if (local.length === 11 && local.startsWith('9')) {
    local = local.slice(1);
  }

  if (local.length <= 4) {
    return { areaCode: '', number: local };
  }

  const areaLength = local.startsWith('11') ? 2 : 3;
  const areaCode = local.slice(0, areaLength);
  let number = local.slice(areaLength);

  // El `15` de celular local viejo va DESPUÉS del código de área
  // (`011 15 5555-6666`), así que se descarta acá y no antes de partir.
  if (number.startsWith('15') && number.length > 8) {
    number = number.slice(2);
  }

  return { areaCode, number };
}

// --- internals ---

function emptyPhone(): CorreoPhone {
  return { areaCode: '', number: '' };
}

function resolvePhone(
  parts: CorreoPhone | undefined,
  raw: string | undefined
): CorreoPhone | undefined {
  if (parts && (parts.areaCode || parts.number)) {
    return { areaCode: parts.areaCode ?? '', number: parts.number ?? '' };
  }
  const split = splitArgentinePhone(raw);
  return split.number ? split : undefined;
}

function buildAddress(
  address: CorreoPartyAddressInput,
  fieldPrefix: string
): CorreoAddressPayload {
  const state = normalizeProvinceToCode(address.state);
  if (!state) {
    throw new CorreoOrderPayloadError(
      `${fieldPrefix}.state`,
      `Cannot resolve "${address.state ?? ''}" to a Correo Argentino province code. ` +
        'Expected a single letter, an ISO 3166-2 code (AR-B) or a known province name.'
    );
  }

  const zipCode = normalizePostalCode(address.postalCode);
  if (!zipCode || !/^\d{4}$/.test(zipCode)) {
    throw new CorreoOrderPayloadError(
      `${fieldPrefix}.postalCode`,
      `Invalid postal code "${address.postalCode ?? ''}" (expected 4 digits or a CPA like C1121AAF)`
    );
  }

  return {
    streetName: required(
      address.street,
      `${fieldPrefix}.street`,
      `${fieldPrefix}.street is required`
    ),
    // `streetNumber` es string y obligatorio: 'S/N' cuando la dirección no lo
    // trae (mismo criterio que Andreani).
    streetNumber: address.number?.trim() || 'S/N',
    cityName: required(
      address.city,
      `${fieldPrefix}.city`,
      `${fieldPrefix}.city is required`
    ),
    floor: address.floor?.trim() ?? '',
    department: address.department?.trim() ?? '',
    state,
    zipCode,
  };
}

function buildParcel(
  parcel: ConsolidatedParcel,
  productCategory: string
): CorreoParcelPayload {
  return {
    dimensions: {
      height: String(parcel.dimensions.height),
      width: String(parcel.dimensions.width),
      depth: String(parcel.dimensions.depth),
    },
    // Peso FACTURADO (max entre real y volumétrico): es el que Correo cobra, y
    // declarar el real cuando el volumétrico es mayor termina en ajuste de
    // factura.
    productWeight: String(parcel.billedWeightG),
    productCategory,
    declaredValue: String(parcel.declaredValue),
  };
}

function required(
  value: string | undefined,
  field: string,
  message: string
): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new CorreoOrderPayloadError(field, message);
  }
  return trimmed;
}
