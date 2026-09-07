/**
 * Andreani data transformer (simplified, single-bulto).
 *
 * Converts Medusa fulfillment DTOs + env-sourced origin/sender into the
 * Andreani shipment payload, and normalizes pickup locations / tracking.
 *
 * The multi-tenant version used a box-packer to split items across boxes.
 * Here we collapse all items into a single bulto with aggregate weight and
 * declared value — sufficient for the boilerplate. If per-box packing is
 * needed later, reintroduce a box-packer here.
 */

import type {
  FulfillmentItemDTO,
  FulfillmentOrderDTO,
} from '@medusajs/types';
import type {
  AndreaniCreateShipmentRequest,
  AndreaniProviderOptions,
  AndreaniServiceType,
  AndreaniShipmentDestination,
  BultoData,
  TrackingEvent,
} from '../types';

type UnknownRecord = Record<string, unknown>;

export interface PickupLocation {
  /** Andreani numeric sucursal/point id (the "idgla") — what the shipment
   * destino must reference. NOT the human `codigo` (e.g. "HOP501"). */
  id: string;
  /** Human pickup code (e.g. "HOP501"). Kept to match selections that were
   * stored as the codigo before the id fix. */
  codigo?: string;
  description: string;
  address: {
    street: string;
    number: string;
    city: string;
    province: string;
    postal_code: string;
    country: string;
  };
}

export interface BuildShipmentInput {
  serviceType: AndreaniServiceType;
  order: Partial<FulfillmentOrderDTO>;
  items: Partial<Omit<FulfillmentItemDTO, 'fulfillment'>>[];
  recipientPhone?: string;
  /**
   * Pre-packed bultos (from the box-packer). When provided, they REPLACE the
   * single-bulto aggregation. Used by the on-demand ticket workflow; the native
   * fulfillment flow omits this and gets the simple single bulto.
   */
  bultos?: BultoData[];
  /** Required for Sucursal / PuntoDeTercero shipments. */
  pickupLocation?: {
    id: string;
    postalCode: string;
    street: string;
    number: string;
    city: string;
  };
  /**
   * Shipping origin resolved by the caller (e.g. from the fulfillment's stock
   * location). When present, REPLACES the env-sourced origin. Each field should
   * already have its env fallback applied by the caller.
   */
  originOverride?: {
    postalCode: string;
    street: string;
    number: string;
    city: string;
    province: string;
  };
  /** Sender name resolved by the caller. Falls back to env when omitted. */
  senderNameOverride?: string;
}

export class AndreaniDataTransformer {
  private readonly options: AndreaniProviderOptions;

  constructor(options: AndreaniProviderOptions) {
    this.options = options;
  }

  buildShipmentRequest(input: BuildShipmentInput): AndreaniCreateShipmentRequest {
    const { order, items, serviceType } = input;

    const shippingAddress = (order.shipping_address ?? {}) as UnknownRecord;

    const recipientName =
      this.joinName(
        this.str(shippingAddress, 'first_name'),
        this.str(shippingAddress, 'last_name')
      ) || 'Destinatario';

    const recipientEmail =
      this.str(order as unknown as UnknownRecord, 'email') ?? undefined;

    const phone = input.recipientPhone ?? this.str(shippingAddress, 'phone');

    const destino = this.buildDestination(serviceType, shippingAddress, input);

    const bultos =
      input.bultos && input.bultos.length > 0
        ? input.bultos
        : [this.buildBulto(items)];

    const origin = input.originOverride ?? {
      postalCode: this.options.origin.postalCode,
      street: this.options.origin.street,
      number: this.options.origin.number,
      city: this.options.origin.city,
      province: this.options.origin.province,
    };

    return {
      contrato: this.options.contract,
      cliente: this.options.clientCode || undefined,
      tipoServicio: serviceType,
      origen: {
        postal: {
          codigoPostal: origin.postalCode,
          calle: origin.street,
          numero: origin.number || 'S/N',
          localidad: origin.city,
        },
      },
      destino,
      remitente: {
        nombreCompleto: input.senderNameOverride ?? this.options.sender.name,
        email: this.options.sender.email,
        documentoTipo: this.options.sender.documentType,
        documentoNumero: this.options.sender.documentNumber,
        telefonos: this.options.sender.phone
          ? [{ tipo: 1, numero: this.options.sender.phone }]
          : undefined,
      },
      destinatario: [
        {
          nombreCompleto: recipientName,
          email: recipientEmail,
          telefonos: phone ? [{ tipo: 1, numero: phone }] : undefined,
        },
      ],
      bultos,
    };
  }

  private buildDestination(
    serviceType: AndreaniServiceType,
    shippingAddress: UnknownRecord,
    input: BuildShipmentInput
  ): AndreaniShipmentDestination {
    if (serviceType === 'Domicilio') {
      return {
        postal: {
          codigoPostal: this.str(shippingAddress, 'postal_code') ?? '',
          calle: this.str(shippingAddress, 'address_1') ?? '',
          numero: this.str(shippingAddress, 'address_2') ?? 'S/N',
          localidad: this.str(shippingAddress, 'city') ?? '',
        },
      };
    }

    // Sucursal / PuntoDeTercero require a pickup location.
    const pickup = input.pickupLocation;
    if (!pickup) {
      throw new Error(
        `A pickup location is required for service type "${serviceType}"`
      );
    }

    return {
      sucursal: {
        id: pickup.id,
        direccion: {
          codigoPostal: pickup.postalCode,
          calle: pickup.street,
          numero: pickup.number,
          localidad: pickup.city,
        },
      },
    };
  }

  private buildBulto(
    items: Partial<Omit<FulfillmentItemDTO, 'fulfillment'>>[]
  ): BultoData {
    let totalWeight = 0;
    let declaredValue = 0;

    for (const item of items) {
      const record = item as unknown as UnknownRecord;
      const quantity = this.num(record, 'quantity') ?? 1;
      const weight = this.num(record, 'weight');
      if (weight) {
        totalWeight += weight * quantity;
      }
      const unitPrice =
        this.num(record, 'unit_price') ?? this.num(record, 'raw_unit_price');
      if (unitPrice) {
        declaredValue += unitPrice * quantity;
      }
    }

    // Andreani requires weight between 0.1 and 30 kg per bulto.
    const kilos = Math.min(Math.max(totalWeight || 1, 0.1), 30);
    const declared = declaredValue > 0 ? declaredValue : 1000;

    // Default 10x10x10 cm box when dimensions are unknown.
    const largoCm = 10;
    const altoCm = 10;
    const anchoCm = 10;

    return {
      kilos,
      largoCm,
      altoCm,
      anchoCm,
      volumenCm: largoCm * altoCm * anchoCm,
      valorDeclaradoSinImpuestos: declared,
      valorDeclaradoConImpuestos: declared,
    };
  }

  transformPickupLocations(locations: Array<UnknownRecord>): PickupLocation[] {
    return locations.map((raw) => {
      const addressData = (this.rec(raw, 'direccion') ??
        this.rec(raw, 'address') ??
        raw) as UnknownRecord;

      return {
        // Andreani's numeric `id` is the idgla the shipment needs. It comes as a
        // number, so `str` skips it — use `strOrNum` and only fall back to the
        // human code/descripcion if there's no numeric id.
        id:
          this.strOrNum(raw, 'id') ??
          this.str(raw, 'codigo') ??
          this.str(raw, 'descripcion') ??
          '',
        codigo: this.str(raw, 'codigo'),
        description:
          this.str(raw, 'descripcion') ?? this.str(raw, 'nombre') ?? 'Punto',
        address: {
          street:
            this.str(addressData, 'calle') ?? this.str(raw, 'calle') ?? '',
          number:
            this.str(addressData, 'numero') ??
            this.str(raw, 'numero') ??
            this.str(addressData, 'altura') ??
            '',
          city:
            this.str(addressData, 'localidad') ??
            this.str(raw, 'localidad') ??
            this.str(addressData, 'ciudad') ??
            '',
          province:
            this.str(addressData, 'provincia') ??
            this.str(raw, 'provincia') ??
            '',
          postal_code:
            this.str(addressData, 'codigoPostal') ??
            this.str(raw, 'codigoPostal') ??
            this.str(addressData, 'cp') ??
            '',
          country: 'AR',
        },
      };
    });
  }

  transformTrackingEvents(
    trazas: Array<{
      fecha?: string;
      estado?: string;
      descripcion?: string;
      ubicacion?: string;
    }>
  ): TrackingEvent[] {
    return trazas.map((traza) => ({
      timestamp: traza.fecha ?? new Date().toISOString(),
      status: traza.estado ?? 'unknown',
      description: traza.descripcion ?? 'Sin descripción',
      location: traza.ubicacion,
    }));
  }

  // --- helpers ---

  private isRecord(value: unknown): value is UnknownRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private rec(source: UnknownRecord, key: string): UnknownRecord | undefined {
    const value = source[key];
    return this.isRecord(value) ? value : undefined;
  }

  private str(source: UnknownRecord, key: string): string | undefined {
    const value = source[key];
    if (typeof value !== 'string') {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  /** Like `str`, but also accepts a finite number (Andreani returns the point
   * `id` as a number) and stringifies it. */
  private strOrNum(source: UnknownRecord, key: string): string | undefined {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
    return this.str(source, key);
  }

  private num(source: UnknownRecord, key: string): number | undefined {
    const value = source[key];
    if (typeof value === 'number' && !Number.isNaN(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isNaN(parsed) ? undefined : parsed;
    }
    return undefined;
  }

  private joinName(first?: string, last?: string): string {
    return [first, last].filter(Boolean).join(' ').trim();
  }
}

export default AndreaniDataTransformer;
