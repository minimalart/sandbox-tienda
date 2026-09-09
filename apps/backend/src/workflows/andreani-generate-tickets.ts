import type { Logger, IEventBusModuleService, RemoteQueryFunction } from '@medusajs/framework/types';
/**
 * Andreani — workflow de generación de etiquetas on-demand.
 *
 * Orquesta: validar orden → crear envío en Andreani → guardar ticket en
 * `order.metadata.andreani_tickets[]`. Cada corrida crea un envío NUEVO; los
 * tickets se acumulan (versionado).
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ ESTE WORKFLOW DESPACHA CON LA CUENTA DE LA TIENDA DUEÑA DE LA ORDEN.      │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * No siempre fue así, y el bug era caro. `service.ts:calculatePrice` ya resolvía
 * las credenciales por tienda desde `site_credential`, pero este workflow —que es
 * el ÚNICO camino que da de alta el envío real— construía su cliente con
 * `getAndreaniClient(logger)` y sus opciones con `loadAndreaniOptionsFromEnv()`.
 * Resultado: una tienda COTIZABA con su cuenta y DESPACHABA con la del entorno.
 * El envío salía igual, el cliente recibía el paquete, y la factura de Andreani le
 * llegaba al titular equivocado con un contrato que nadie había cotizado. Sin un
 * solo error en los logs.
 *
 * El arreglo es `getAndreaniContextForSite`, que resuelve las TRES capas —
 * `site_setting` (origen, remitente, contratos por servicio, bultos),
 * `site_credential` (las cuatro credenciales) y el entorno como piso — con la
 * tienda de la orden. La pista fuerte es el `sales_channel_id`, que se trae en el
 * step de validación.
 */

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
import type {
  FulfillmentItemDTO,
  FulfillmentOrderDTO,
  IOrderModuleService,
} from '@medusajs/framework/types';
import { getAndreaniContextForSite } from '../modules/andreani-fulfillment/get-client';
import {
  packIntoBoxes,
  type PackerBox,
} from '../modules/andreani-fulfillment/transformers/box-packer';
import { isTransientAndreaniError } from '../modules/andreani-fulfillment/utils/errors';
import { ANDREANI_DATA_MODULE } from '../modules/andreani-data';
import type { AndreaniDataModuleService } from '../modules/andreani-data';
import type {
  AndreaniServiceType,
  BultoData,
} from '../modules/andreani-fulfillment/types';
import { DELIVERY_MODULE } from '../modules/delivery';
import type DeliveryModuleService from '../modules/delivery/service';
import { DELIVERY_TERMINAL_STATUSES } from '../modules/delivery/types';

// --- Tipos ---

interface GenerateTicketInput {
  order_id: string;
}

interface TicketBultoEntry {
  numero_de_bulto: string;
  numero_de_envio: string;
  label_url: string;
}

interface BoxUsageEntry {
  name: string;
  count: number;
  height?: number;
  width?: number;
  deep?: number;
}

interface TicketMetadataEntry {
  generated_at: string;
  andreani_order_id: string;
  tracking_number: string;
  grouped_label_url: string;
  bultos: TicketBultoEntry[];
  boxes_used: BoxUsageEntry[];
  boxes_summary: string;
  service_type: AndreaniServiceType;
  contract: string;
}

interface ValidatedItem {
  id: string;
  product_id: string;
  title: string;
  quantity: number;
  unit_price: number;
  weight: number;
  length: number;
  width: number;
  height: number;
  variant_id: string;
}

interface ValidatedOrderData {
  order_id: string;
  display_id: number;
  /**
   * Canal de venta de la orden. Es la PISTA con la que se resuelve la tienda —y
   * por lo tanto la cuenta de Andreani— en el step de creación del envío.
   * `undefined` en órdenes sin canal: ahí se despacha con la cuenta de la
   * instancia, que es el comportamiento de siempre.
   */
  sales_channel_id?: string;
  email: string;
  shipping_address: Record<string, unknown>;
  items: ValidatedItem[];
  service_type: AndreaniServiceType;
  existing_metadata: Record<string, unknown>;
  existing_tickets: TicketMetadataEntry[];
  pickup_location_id?: string;
  /**
   * Pickup-point address persisted in order metadata at checkout (when the
   * customer picked the branch). When present, the shipment step uses it instead
   * of re-querying Andreani — so a momentary Andreani outage can't block the
   * label. Absent on older orders → falls back to the live lookup.
   */
  pickup_address?: {
    street?: string;
    city?: string;
    province?: string;
    postal_code?: string;
  };
  recipient_phone?: string;
  /**
   * Shipping origin resolved from the fulfillment's stock location. Each field
   * is optional; the shipment step fills the gaps with the ANDREANI_* env vars.
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

interface ShipmentResult {
  ticket: TicketMetadataEntry;
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

/**
 * Runs `fn`, retrying on transient Andreani failures (5xx / timeout / 429) with
 * linear backoff. Non-transient errors (e.g. 4xx) and the final attempt rethrow
 * immediately. Used for the pickup-location lookup so a momentary Andreani 503
 * doesn't abort label generation.
 */
async function withPickupRetry<T>(
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
      if (!isTransientAndreaniError(error) || attempt === maxAttempts) {
        throw error;
      }
      const backoff = 500 * attempt;
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(
        `[andreani-tickets] ${label} falló (intento ${attempt}/${maxAttempts}, reintento en ${backoff}ms): ${message}`
      );
      await sleep(backoff);
    }
  }
  throw lastError;
}

const hasAndreaniHint = (value: string | undefined): boolean => {
  if (!value) return false;
  const n = value.trim().toLowerCase();
  return (
    n.includes('andreani') ||
    n.includes('domicilio') ||
    n.includes('sucursal') ||
    n.includes('punto') ||
    n.includes('hop')
  );
};

// --- Step 1: validar la orden ---

const validateOrderForTicketsStep = createStep(
  'validate-order-for-andreani-tickets',
  async (input: GenerateTicketInput, { container }) => {
    const logger = container.resolve<Logger>('logger');
    const query = container.resolve<Omit<RemoteQueryFunction, symbol>>(ContainerRegistrationKeys.QUERY);

    logger.info(`[andreani-tickets] Validando orden ${input.order_id}`);

    const { data: orders } = await query.graph({
      entity: 'order',
      fields: [
        'id',
        'display_id',
        'email',
        // Sin esto no hay forma de saber de qué tienda es la orden, y el envío se
        // da de alta con la cuenta de la instancia. Ver el encabezado del archivo.
        'sales_channel_id',
        'metadata',
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

    const order = orders?.[0];
    if (!order) {
      throw new Error(`ORDER_NOT_FOUND: Order ${input.order_id} not found`);
    }

    const isPaid = order.payment_collections?.some(
      (pc: { status?: string } | null) =>
        pc &&
        (pc.status === 'completed' ||
          pc.status === 'partially_captured' ||
          pc.status === 'authorized')
    );
    if (!isPaid) {
      throw new Error(
        'ORDER_NOT_PAID: Order must be paid before generating labels'
      );
    }

    if (!order.fulfillments?.length) {
      throw new Error(
        'ORDER_NOT_FULFILLED: Order must have at least one fulfillment'
      );
    }

    // Detectar servicio Andreani desde los métodos de envío.
    let hasAndreaniEvidence = false;
    let serviceType: AndreaniServiceType = 'Domicilio';
    for (const method of order.shipping_methods ?? []) {
      const direct = getString(method?.data, 'service_type');
      if (
        direct === 'Sucursal' ||
        direct === 'PuntoDeTercero' ||
        direct === 'Domicilio'
      ) {
        hasAndreaniEvidence = true;
        serviceType = direct;
        break;
      }
      if (
        hasAndreaniHint(typeof method?.name === 'string' ? method.name : undefined) ||
        hasAndreaniHint(getString(method?.data, 'provider'))
      ) {
        hasAndreaniEvidence = true;
        const name = (method?.name || '').toLowerCase();
        if (name.includes('sucursal')) serviceType = 'Sucursal';
        else if (name.includes('punto') || name.includes('hop'))
          serviceType = 'PuntoDeTercero';
      }
    }

    if (!hasAndreaniEvidence) {
      throw new Error(
        `ORDER_NOT_ANDREANI: Order ${input.order_id} has no Andreani shipping method`
      );
    }

    // Resolve the shipping origin from the fulfillment's stock location. The
    // origin/sender is the merchant's dispatch point — it belongs to the
    // warehouse, not the order. Env vars stay as a per-field fallback.
    let originAddress: ValidatedOrderData['origin_address'];
    const locationId = (order.fulfillments ?? [])
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
        originAddress = {
          company: getString(addr, 'company'),
          address_1: getString(addr, 'address_1'),
          address_2: getString(addr, 'address_2'),
          city: getString(addr, 'city'),
          province: getString(addr, 'province'),
          postal_code: getString(addr, 'postal_code'),
        };
      } else {
        logger.warn(
          `[andreani-tickets] Stock location ${locationId} sin dirección — se usará el origen de ANDREANI_ORIGIN_*`
        );
      }
    }

    const existingMetadata = (order.metadata || {}) as UnknownRecord;
    const existingTickets = (existingMetadata.andreani_tickets ||
      []) as TicketMetadataEntry[];

    const pickupLocationId =
      getStringLike(existingMetadata, 'pickup_branch_id') ||
      (order.shipping_methods ?? [])
        .map(
          (m: { data?: unknown }) =>
            getStringLike(m?.data, 'pickup_location_id') ||
            getStringLike(m?.data, 'pickup_branch_id')
        )
        .find((v: string | undefined): v is string => Boolean(v));

    // Pickup-point address persisted at checkout (storefront writes these when
    // the customer selects a branch). Lets the shipment step skip the live
    // Andreani lookup. Old orders won't have them → undefined → lookup fallback.
    const pickupStreet = getString(existingMetadata, 'pickup_branch_address');
    const pickupCity = getString(existingMetadata, 'pickup_branch_city');
    const pickupPostal = getString(existingMetadata, 'pickup_branch_postal');
    const pickupAddress =
      pickupStreet && pickupCity && pickupPostal
        ? {
            street: pickupStreet,
            city: pickupCity,
            province: getString(existingMetadata, 'pickup_branch_province'),
            postal_code: pickupPostal,
          }
        : undefined;

    const items: ValidatedItem[] = (order.items ?? [])
      .filter(Boolean)
      .map((item: UnknownRecord) => {
        const variant = isRecord(item.variant) ? item.variant : undefined;
        const product = isRecord(item.product) ? item.product : undefined;
        const dim = (key: 'weight' | 'length' | 'width' | 'height'): number => {
          const fromVariant = Number(variant?.[key]);
          if (Number.isFinite(fromVariant) && fromVariant > 0) return fromVariant;
          const fromProduct = Number(product?.[key]);
          if (Number.isFinite(fromProduct) && fromProduct > 0) return fromProduct;
          const fromItem = Number(item[key]);
          if (Number.isFinite(fromItem) && fromItem > 0) return fromItem;
          return 0;
        };
        return {
          id: (item.id as string) || '',
          product_id: (item.product_id as string) || '',
          title: (item.title as string) || '',
          quantity: Number(item.quantity) || 1,
          unit_price: Number(item.unit_price || 0),
          weight: dim('weight'),
          length: dim('length'),
          width: dim('width'),
          height: dim('height'),
          variant_id: (item.variant_id as string) || '',
        };
      });

    const validated: ValidatedOrderData = {
      order_id: order.id,
      display_id: Number(order.display_id) || 0,
      sales_channel_id: getString(order, 'sales_channel_id'),
      email: order.email || '',
      shipping_address: (order.shipping_address || {}) as UnknownRecord,
      items,
      service_type: serviceType,
      existing_metadata: existingMetadata,
      existing_tickets: existingTickets,
      pickup_location_id: pickupLocationId,
      pickup_address: pickupAddress,
      recipient_phone: getString(order.shipping_address, 'phone'),
      origin_address: originAddress,
    };

    logger.info(
      `[andreani-tickets] Orden ${order.id} válida — paga, fulfilled, servicio: ${serviceType}`
    );

    return new StepResponse(validated);
  }
);

// --- Step 2: crear el envío en Andreani ---

const createAndreaniTicketShipmentStep = createStep(
  'create-andreani-ticket-shipment',
  async (input: ValidatedOrderData, { container }) => {
    const logger = container.resolve<Logger>('logger');

    // LA cuenta con la que se despacha. `{ orderId, salesChannelId }` son dos
    // pistas de la misma tienda: el canal resuelve directo y el id de la orden es
    // el respaldo para órdenes sin canal asignado. Si la tienda no tiene nada
    // propio, esto devuelve el contexto de la instancia — el comportamiento de
    // siempre, así que el arreglo se despliega sin migrar ninguna tienda.
    const { client, transformer, options, contractFor, credentialSource, configured } =
      await getAndreaniContextForSite(
        container,
        { orderId: input.order_id, salesChannelId: input.sales_channel_id ?? null },
        logger,
      );

    if (!configured) {
      throw new Error(
        'ANDREANI_NOT_CONFIGURED: faltan usuario, contraseña o contrato de Andreani ' +
          'para esta tienda. Cargalos en Ajustes → Andreani o en las credenciales de la tienda.',
      );
    }

    const contract = contractFor(input.service_type);

    // Cajas activas (globales).
    const dataService = container.resolve(
      ANDREANI_DATA_MODULE
    ) as AndreaniDataModuleService;
    const boxRecords = await dataService.listAndreaniBoxes({ is_active: true });
    const boxes: PackerBox[] = boxRecords.map((b) => ({
      name: String(b.name),
      height: Number(b.height) || 0,
      width: Number(b.width) || 0,
      deep: Number(b.deep) || 0,
      max_capacity: Number(b.max_capacity) || 0,
    }));

    // Armar bultos con el box-packer.
    const packed = packIntoBoxes(
      input.items.map((i) => ({
        id: i.id,
        title: i.title,
        quantity: i.quantity,
        weight: i.weight,
        length: i.length,
        width: i.width,
        height: i.height,
      })),
      boxes,
      {
        logger,
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

    // Valor declarado total → distribuido por volumen entre los bultos.
    const declaredTotal = Math.max(
      input.items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0),
      1
    );
    const volumeTotal =
      packed.reduce((sum, b) => sum + (b.volumenCm || 0), 0) || 1;

    const bultos: BultoData[] = packed.map((b) => {
      const proportion = (b.volumenCm || 0) / volumeTotal;
      const declared = Math.max(Math.round(declaredTotal * proportion), 1);
      return {
        kilos: Math.min(Math.max(b.kilos || 0.1, 0.1), 30),
        largoCm: b.largoCm,
        altoCm: b.altoCm,
        anchoCm: b.anchoCm,
        volumenCm: b.volumenCm,
        valorDeclaradoSinImpuestos: declared,
        valorDeclaradoConImpuestos: declared,
      };
    });

    // Resumen de cajas usadas.
    const aggregated = new Map<string, BoxUsageEntry>();
    for (const b of packed) {
      const existing = aggregated.get(b.name);
      if (existing) {
        existing.count += 1;
        continue;
      }
      aggregated.set(
        b.name,
        b.isKit
          ? { name: b.name, count: 1 }
          : {
              name: b.name,
              count: 1,
              height: b.altoCm,
              width: b.anchoCm,
              deep: b.largoCm,
            }
      );
    }
    const boxesUsed = Array.from(aggregated.values()).sort(
      (a, b) => b.count - a.count
    );
    const boxesSummary = boxesUsed.map((b) => `${b.count}x ${b.name}`).join(', ');

    // Pickup location (Sucursal / PuntoDeTercero).
    let pickupLocation;
    if (
      input.pickup_location_id &&
      (input.service_type === 'Sucursal' ||
        input.service_type === 'PuntoDeTercero')
    ) {
      if (input.pickup_address) {
        // Address captured at checkout — skip the live Andreani lookup entirely.
        // The storefront stores street+number combined in `street`, so number
        // is left as 'S/N' (the destination is identified by the branch id).
        pickupLocation = {
          id: input.pickup_location_id,
          postalCode: input.pickup_address.postal_code || '',
          street: input.pickup_address.street || '',
          number: 'S/N',
          city: input.pickup_address.city || '',
        };
        logger.info(
          `[andreani-tickets] Punto ${input.pickup_location_id} resuelto desde metadata de la orden (sin lookup a Andreani)`
        );
      } else {
        const postalCode = getString(input.shipping_address, 'postal_code');

        // No persisted address (old order) — look up against Andreani, retried
        // on transient 5xx/timeout. A failure here is an API/connectivity
        // problem, NOT a missing location — keep the two distinct so the caller
        // can tell a retryable outage from a bad id.
        let locations;
        try {
          const raw = await withPickupRetry(
            () =>
              input.service_type === 'Sucursal'
                ? client.getSucursales(postalCode)
                : client.getPuntosDeTercero(postalCode),
            logger,
            `Lookup ${input.service_type} para ${input.pickup_location_id}`
          );
          locations = transformer.transformPickupLocations(raw);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          throw new Error(
            `PICKUP_LOOKUP_FAILED: Andreani pickup lookup failed for ${input.pickup_location_id}: ${message}`
          );
        }

        // Match by the Andreani numeric id OR the human codigo — selections
        // made before the id fix were stored as the codigo (e.g. "HOP501").
        const wanted = input.pickup_location_id!.trim();
        const match = locations.find(
          (l) => l.id.trim() === wanted || l.codigo?.trim() === wanted
        );
        if (!match) {
          throw new Error(
            `PICKUP_LOCATION_NOT_FOUND: Could not resolve pickup location ${input.pickup_location_id}`
          );
        }

        // Always send Andreani the numeric idgla (match.id), never the codigo.
        logger.info(
          `[andreani-tickets] Punto ${input.pickup_location_id} → sucursal idgla ${match.id}`
        );

        pickupLocation = {
          id: match.id,
          postalCode: match.address.postal_code,
          street: match.address.street,
          number: match.address.number,
          city: match.address.city,
        };
      }
    }

    // Origin/sender: stock location address takes precedence, env fills gaps.
    const origin = input.origin_address;
    const originOverride = {
      postalCode: origin?.postal_code || options.origin.postalCode,
      street: origin?.address_1 || options.origin.street,
      number: origin?.address_2 || options.origin.number,
      city: origin?.city || options.origin.city,
      province: origin?.province || options.origin.province,
    };
    const senderNameOverride = origin?.company || options.sender.name;

    const shipmentRequest = {
      ...transformer.buildShipmentRequest({
        serviceType: input.service_type,
        order: {
          shipping_address: input.shipping_address,
          email: input.email,
        } as unknown as Partial<FulfillmentOrderDTO>,
        items: input.items as unknown as Partial<
          Omit<FulfillmentItemDTO, 'fulfillment'>
        >[],
        recipientPhone: input.recipient_phone,
        bultos,
        pickupLocation,
        originOverride,
        senderNameOverride,
      }),
      contrato: contract,
    };

    // `credentialSource` en el log y NUNCA la credencial: es lo único que permite
    // diagnosticar "esta tienda despachó con la cuenta equivocada" sin filtrar nada.
    logger.info(
      `[andreani-tickets] Creando envío para orden ${input.order_id} — contrato: ${contract}, servicio: ${input.service_type}, cuenta: ${credentialSource}`
    );

    const response = await client.createShipment(shipmentRequest);

    const ticketBultos: TicketBultoEntry[] = (response.bultos || []).map((b) => {
      const etiqueta = b.linking?.find((l) => l.meta === 'Etiqueta');
      return {
        numero_de_bulto: b.numeroDeBulto || '',
        numero_de_envio: b.numeroDeEnvio || '',
        label_url: etiqueta?.contenido || '',
      };
    });

    const ticket: TicketMetadataEntry = {
      generated_at: new Date().toISOString(),
      andreani_order_id: response.agrupadorDeBultos || '',
      tracking_number:
        response.bultos?.[0]?.numeroDeEnvio ||
        response.numeroDeEnvio ||
        response.agrupadorDeBultos ||
        '',
      grouped_label_url:
        response.etiquetasPorAgrupador || response.etiqueta || '',
      bultos: ticketBultos,
      boxes_used: boxesUsed,
      boxes_summary: boxesSummary,
      service_type: input.service_type,
      contract,
    };

    logger.info(
      `[andreani-tickets] Envío creado — andreani_order: ${ticket.andreani_order_id}, tracking: ${ticket.tracking_number}`
    );

    return new StepResponse({ ticket } as ShipmentResult);
  }
);

// --- Step 3: guardar el ticket en metadata ---

const saveTicketMetadataStep = createStep(
  'save-andreani-ticket-metadata',
  async (
    input: {
      order_id: string;
      existing_metadata: Record<string, unknown>;
      existing_tickets: TicketMetadataEntry[];
      ticket: TicketMetadataEntry;
    },
    { container }
  ) => {
    const logger = container.resolve<Logger>('logger');
    const orderModuleService = container.resolve(
      Modules.ORDER
    ) as IOrderModuleService;

    const updatedTickets = [...input.existing_tickets, input.ticket];

    await orderModuleService.updateOrders([
      {
        id: input.order_id,
        metadata: {
          ...input.existing_metadata,
          andreani_tickets: updatedTickets,
        },
      },
    ]);

    logger.info(
      `[andreani-tickets] Ticket #${updatedTickets.length} guardado en orden ${input.order_id}`
    );

    return new StepResponse({ total_tickets: updatedTickets.length });
  }
);

// --- Step 4: linkear el tracking a la DeliveryExecution (sidecar) ---

/**
 * Escribe `tracking_number` + `external_shipment_id` del ticket recién generado
 * en la DeliveryExecution de la orden, para que el job
 * `sync-andreani-tracking-status` pueda pollear el estado.
 *
 * Por qué existe: la generación on-demand de etiquetas solo guardaba el ticket en
 * `order.metadata.andreani_tickets[]`. La DeliveryExecution (sidecar del módulo
 * delivery) se crea VACÍA en `order.fulfillment_created`. Como su
 * `tracking_number` quedaba null, `AndreaniDeliveryProvider.pollStatus` hacía
 * early-return y el sync NUNCA actualizaba el estado de la orden. Este step cierra
 * esa brecha escribiendo el tracking en la execution.
 *
 * Robustez (deliberada):
 *  - Si la orden NO tiene DeliveryExecution (órdenes viejas pre-sidecar), loguea
 *    un warn y sigue: la etiqueta ya se generó OK; el sync simplemente no aplica.
 *  - Si hay varias executions, actualiza las de Andreani NO terminales de la
 *    orden (las que el job de sync efectivamente recorre). Se evita tocar
 *    executions ya entregadas/canceladas.
 *  - Idempotencia: re-generar la etiqueta sobreescribe el tracking con el del
 *    último ticket. Es el comportamiento deseado (el último envío manda).
 *  - Cualquier fallo (query/update) se traga como warn: un problema del sidecar
 *    NO debe hacer fallar la generación de la etiqueta. Sin compensación: nada
 *    que revertir aguas abajo.
 */
const linkTicketToDeliveryExecutionStep = createStep(
  'link-andreani-ticket-to-delivery-execution',
  async (
    input: { order_id: string; ticket: TicketMetadataEntry },
    { container }
  ) => {
    const logger = container.resolve<Logger>('logger');

    try {
      const query = container.resolve<Omit<RemoteQueryFunction, symbol>>(ContainerRegistrationKeys.QUERY);

      // Resolvemos las executions de la orden por el link order↔execution
      // (traversal `order.delivery_executions`). No hay columnas FK; el vínculo
      // vive en el module link.
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
      // Targets: executions Andreani NO terminales — exactamente las que el job
      // sync-andreani-tracking-status recorre. Saltamos las ya cerradas.
      const targets = executions
        .filter(
          (e): e is { id: string; provider_type?: string; status?: string } =>
            Boolean(e?.id) &&
            e?.provider_type === 'andreani' &&
            !terminal.has(e?.status ?? '')
        )
        .map((e) => e.id);

      if (targets.length === 0) {
        logger.warn(
          `[andreani-tickets] Orden ${input.order_id} sin DeliveryExecution Andreani activa — etiqueta generada OK, pero el sync de tracking no aplica (orden pre-sidecar o execution terminal).`
        );
        return new StepResponse({ updated: 0 });
      }

      const trackingNumber = input.ticket.tracking_number || null;
      const externalShipmentId = input.ticket.andreani_order_id || null;

      const service =
        container.resolve<DeliveryModuleService>(DELIVERY_MODULE);

      await service.updateDeliveryExecutions(
        targets.map((id) => ({
          id,
          tracking_number: trackingNumber,
          external_shipment_id: externalShipmentId,
          label_url: input.ticket.grouped_label_url || null,
        }))
      );

      logger.info(
        `[andreani-tickets] Tracking ${trackingNumber} linkeado a ${targets.length} DeliveryExecution(s) de la orden ${input.order_id}`
      );

      return new StepResponse({ updated: targets.length });
    } catch (error) {
      // Un fallo del sidecar NO debe romper la generación de la etiqueta.
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(
        `[andreani-tickets] No se pudo linkear el tracking a la DeliveryExecution de la orden ${input.order_id} (la etiqueta se generó OK): ${message}`
      );
      return new StepResponse({ updated: 0 });
    }
  }
);

// --- Step 5: emitir evento de dominio `andreani.ticket_generated` ---

/**
 * Emite `andreani.ticket_generated` con `{ order_id, tracking_number }` — el
 * primer momento determinístico en que existe un tracking real de Andreani. Lo
 * consume el subscriber de WhatsApp que manda el mensaje con seguimiento.
 *
 * Guard de idempotencia: SOLO en la primera generación (cuando la orden no tenía
 * tickets previos, `existing_ticket_count === 0`). Las regeneraciones acumulan
 * tickets y NO deben re-disparar el mensaje.
 *
 * Best-effort/no-fatal: un fallo del event bus (o aguas abajo, WhatsApp) NO debe
 * romper la generación de la etiqueta — misma tolerancia que
 * `linkTicketToDeliveryExecutionStep`. Sin compensación: nada que revertir.
 */
const emitTicketGeneratedStep = createStep(
  'emit-andreani-ticket-generated',
  async (
    input: {
      order_id: string;
      tracking_number: string;
      existing_ticket_count: number;
    },
    { container }
  ) => {
    const logger = container.resolve<Logger>('logger');

    // Solo la primera generación notifica. Las re-generaciones acumulan tickets
    // (existing_ticket_count > 0) y no re-spammean.
    if (input.existing_ticket_count > 0) {
      return new StepResponse({ emitted: false });
    }

    try {
      const eventBus = container.resolve<IEventBusModuleService>(Modules.EVENT_BUS);
      await eventBus.emit({
        name: 'andreani.ticket_generated',
        data: {
          order_id: input.order_id,
          tracking_number: input.tracking_number,
        },
      });
      logger.info(
        `[andreani-tickets] Evento andreani.ticket_generated emitido para orden ${input.order_id} (tracking ${input.tracking_number})`
      );
      return new StepResponse({ emitted: true });
    } catch (error) {
      // Un fallo al emitir el evento NO debe romper la generación de la etiqueta.
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(
        `[andreani-tickets] No se pudo emitir andreani.ticket_generated para la orden ${input.order_id} (la etiqueta se generó OK): ${message}`
      );
      return new StepResponse({ emitted: false });
    }
  }
);

// --- Workflow ---

export const andreaniGenerateTicketsWorkflow = createWorkflow(
  'andreani-generate-tickets',
  (input: GenerateTicketInput) => {
    const validatedOrder = validateOrderForTicketsStep(input);
    const shipmentResult = createAndreaniTicketShipmentStep(validatedOrder);

    const metadataInput = transform(
      { validatedOrder, shipmentResult },
      ({ validatedOrder, shipmentResult }) => ({
        order_id: validatedOrder.order_id,
        existing_metadata: validatedOrder.existing_metadata,
        existing_tickets: validatedOrder.existing_tickets,
        ticket: shipmentResult.ticket,
      })
    );

    const saveResult = saveTicketMetadataStep(metadataInput);

    // Escribe el tracking en la DeliveryExecution para habilitar el sync de
    // estado. Best-effort: no rompe la generación si el sidecar falla o no existe.
    const linkInput = transform(
      { validatedOrder, shipmentResult },
      ({ validatedOrder, shipmentResult }) => ({
        order_id: validatedOrder.order_id,
        ticket: shipmentResult.ticket,
      })
    );
    linkTicketToDeliveryExecutionStep(linkInput);

    // Notifica tracking real por WhatsApp — solo en la primera generación (el
    // guard vive en el step, leyendo existing_tickets ANTES de acumular).
    const emitInput = transform(
      { validatedOrder, shipmentResult },
      ({ validatedOrder, shipmentResult }) => ({
        order_id: validatedOrder.order_id,
        tracking_number: shipmentResult.ticket.tracking_number,
        existing_ticket_count: validatedOrder.existing_tickets.length,
      })
    );
    emitTicketGeneratedStep(emitInput);

    return new WorkflowResponse(
      transform(
        { validatedOrder, shipmentResult, saveResult },
        ({ validatedOrder, shipmentResult, saveResult }) => ({
          order_id: validatedOrder.order_id,
          display_id: validatedOrder.display_id,
          ticket: shipmentResult.ticket,
          total_tickets: saveResult.total_tickets,
        })
      )
    );
  }
);

export default andreaniGenerateTicketsWorkflow;
