import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import type { IInventoryService, MedusaContainer } from '@medusajs/framework/types';
import { chosenStoreLocationId } from './pickup-context';
import {
  inventoryItemIdsOf,
  netAvailableForVariant,
  variantTracksStock,
  type ReservationForStock,
  type VariantForStock,
} from './stock-availability';

/**
 * order-stock-context — el estado de stock de CADA LÍNEA de una orden, para
 * CUALQUIER método de envío, con destino al mail interno `order-notification-admin`.
 *
 * Generaliza a `pickup-context.ts` (que sólo cubre retiro en tienda) a partir de
 * DESDEELSUR-80: el pedido #81 (envío a domicilio) no mostraba stock para nada
 * porque `buildPickupContext` devuelve `null` sin `store_id`. `buildPickupContext`
 * SIGUE existiendo tal cual — lo consumen `order-confirmation` y
 * `order-ready-for-pickup`, y el mail admin sigue emitiendo `pickup_items` /
 * `pickup_has_stock_issues` por compatibilidad con la plantilla que desdeelsur ya
 * tiene editada a mano en su base. Esto es una SEGUNDA fuente, más general, para
 * el badge por ítem del "Resumen del pedido".
 *
 * ── QUÉ UBICACIÓN SE EVALÚA (decisión del ticket) ────────────────────────────
 *
 * "El stock de la sucursal desde la que la orden hará el fulfillment":
 *  - Retiro en tienda: la sucursal elegida (`chosenStoreLocationId`), igual que
 *    `pickup-context.ts`.
 *  - Cualquier otro envío: la ubicación de la shipping option del PRIMER
 *    shipping method que la resuelva. Al momento de `order.placed` no hay
 *    fulfillment todavía; la ubicación la da el link `service_zone.fulfillment_set
 *    ↔ stock_location` — es la misma que el admin nativo de Medusa preselecciona
 *    al crear el fulfillment.
 *  - Si ninguna se puede resolver: TODA línea queda "no determinada" (`unknown`,
 *    label "—"). Nunca "Sin stock" — eso sería afirmar algo que no se pudo leer.
 *
 * NO IMPORTA NADA DE `store-location`, `delivery` NI `erp`: todo por
 * `query.graph`, que devuelve vacío —no explota— si el módulo no está. Mismo
 * criterio que `pickup-context.ts` (ver su encabezado).
 */

type UnknownRecord = Record<string, unknown>;

const isRecord = (v: unknown): v is UnknownRecord =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const getString = (source: unknown, key: string): string | undefined => {
  if (!isRecord(source)) return undefined;
  const value = source[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
};

type QueryGraph = {
  graph: (input: unknown) => Promise<{ data: unknown[] }>;
};

/** El estado de una línea contra el stock de la ubicación resuelta. */
export type OrderStockStatus = 'available' | 'insufficient' | 'none' | 'not_tracked' | 'unknown';

export type OrderStockItemView = {
  status: OrderStockStatus;
  status_label: string;
  status_color: string;
  /** Ya formateado para pintar. `'—'` cuando no hay un número (ver `status`). */
  available_label: string;
};

export type OrderStockContext = {
  /** Nombre de la ubicación cuyo stock se evaluó. Ausente si no se pudo resolver. */
  stock_location_name?: string;
  /** True si ALGUNA línea es `insufficient` o `none`. Nunca por `not_tracked`/`unknown`. */
  has_stock_issues: boolean;
  by_line_item_id: Map<string, OrderStockItemView>;
};

export type OrderStockLineInput = {
  line_item_id: string;
  variant_id?: string | null;
  /** Ya resuelta por el llamador (ver `quantityOf` del subscriber). */
  quantity: number;
};

const STATUS_PRESENTATION: Record<OrderStockStatus, { label: string; color: string }> = {
  // Mismo semáforo que `pickup-context.ts` (verde/ámbar/rojo, no son los colores
  // de marca a propósito). Gris para los dos estados que NO son un hecho sobre
  // el inventario: uno dice "no corresponde" y el otro "no se sabe".
  available: { label: 'Stock disponible', color: '#15803d' },
  insufficient: { label: 'Stock insuficiente', color: '#b45309' },
  none: { label: 'Sin stock', color: '#b91c1c' },
  not_tracked: { label: 'Sin control de stock', color: '#6b7280' },
  unknown: { label: '—', color: '#6b7280' },
};

/** Disponibilidad de una línea, ya resuelta a uno de tres casos. */
type ItemAvailability =
  | { kind: 'tracked'; available: number }
  | { kind: 'not_tracked' }
  | { kind: 'unknown' };

/**
 * Clasifica una línea. PURA: no toca el container, así que se prueba sin base
 * de datos ni mocks. Es el punto exacto donde el ticket pide DOS estados nuevos
 * además de los tres de `pickup-context.classifyStock`:
 *
 *  - `not_tracked`: la variante no participa del control (`variantTracksStock`
 *    en falso — no gestiona inventario, o acepta backorder). No es "Sin stock":
 *    es "acá no corresponde mirar".
 *  - `unknown`: no se pudo determinar (no se resolvió NINGUNA ubicación para la
 *    orden, o falló puntualmente la lectura de este ítem). Tampoco es "Sin
 *    stock": es "no lo sabemos", y decir que no hay sería peor que no decir nada.
 */
export function classifyOrderStock(quantity: number, availability: ItemAvailability): OrderStockStatus {
  if (availability.kind === 'not_tracked') return 'not_tracked';
  if (availability.kind === 'unknown') return 'unknown';
  if (availability.available <= 0) return 'none';
  return availability.available >= quantity ? 'available' : 'insufficient';
}

/** Los `shipping_option_id` de los métodos de envío de la orden, en orden. */
export function shippingOptionIdsOf(
  shippingMethods: Array<{ shipping_option_id?: string | null }> | null | undefined,
): string[] {
  return (shippingMethods ?? [])
    .map((m) => getString(m, 'shipping_option_id'))
    .filter((v): v is string => Boolean(v));
}

function viewFor(status: OrderStockStatus, availability: ItemAvailability): OrderStockItemView {
  const presentation = STATUS_PRESENTATION[status];
  return {
    status,
    status_label: presentation.label,
    status_color: presentation.color,
    available_label: availability.kind === 'tracked' ? String(availability.available) : '—',
  };
}

/**
 * Ubicación cuyo stock hay que mirar, más su nombre. `null` si no se pudo
 * resolver ninguna — nunca lanza.
 */
async function resolveStockLocation(
  query: QueryGraph,
  metadata: unknown,
  shippingMethods: UnknownRecord[],
): Promise<{ locationId: string; locationName?: string } | null> {
  const pickupStoreLocationId = chosenStoreLocationId(metadata, shippingMethods);
  if (pickupStoreLocationId) {
    try {
      const { data } = (await query.graph({
        entity: 'store_location',
        fields: ['id', 'name', 'stock_location_id'],
        filters: { id: pickupStoreLocationId },
      })) as { data: UnknownRecord[] };
      const stockLocationId = getString(data?.[0], 'stock_location_id');
      if (stockLocationId) {
        return { locationId: stockLocationId, locationName: getString(data?.[0], 'name') };
      }
    } catch {
      // Sigue como "no resuelta" — nunca lanza.
    }
    // Es de retiro pero la sucursal no se pudo leer o no tiene stock location
    // propio: no cae a la resolución por envío (esta orden NO se despacha por
    // shipping option), queda "no determinada".
    return null;
  }

  for (const shippingOptionId of shippingOptionIdsOf(shippingMethods)) {
    const stockLocationId = await resolveLocationForShippingOption(query, shippingOptionId);
    if (stockLocationId) {
      return { locationId: stockLocationId, locationName: await resolveStockLocationName(query, stockLocationId) };
    }
  }
  return null;
}

/**
 * `shipping_option → service_zone.fulfillment_set_id → location_fulfillment_set
 * .stock_location_id`. Es la misma cadena que preselecciona el admin nativo de
 * Medusa al crear un fulfillment (`service_zone.fulfillment_set_id` es el campo
 * que el propio core usa para filtrar `/admin/shipping-options` por ubicación —
 * ver `@medusajs/medusa/dist/api/admin/shipping-options/middlewares.js`, y
 * `location_fulfillment_set` es el nombre del link que crea
 * `link.create({ [Modules.STOCK_LOCATION]: {...}, [Modules.FULFILLMENT]: {...} })`,
 * como en `scripts/seed-operational.ts`).
 */
async function resolveLocationForShippingOption(
  query: QueryGraph,
  shippingOptionId: string,
): Promise<string | null> {
  try {
    const { data } = (await query.graph({
      entity: 'shipping_option',
      fields: ['id', 'service_zone.fulfillment_set_id'],
      filters: { id: shippingOptionId },
    })) as { data: UnknownRecord[] };
    const serviceZone = data?.[0]?.service_zone;
    const fulfillmentSetId = getString(serviceZone, 'fulfillment_set_id');
    if (!fulfillmentSetId) return null;

    const { data: links } = (await query.graph({
      entity: 'location_fulfillment_set',
      fields: ['stock_location_id'],
      filters: { fulfillment_set_id: fulfillmentSetId },
    })) as { data: UnknownRecord[] };
    return getString(links?.[0], 'stock_location_id') ?? null;
  } catch {
    return null;
  }
}

async function resolveStockLocationName(query: QueryGraph, stockLocationId: string): Promise<string | undefined> {
  try {
    const { data } = (await query.graph({
      entity: 'stock_location',
      fields: ['id', 'name'],
      filters: { id: stockLocationId },
    })) as { data: UnknownRecord[] };
    return getString(data?.[0], 'name');
  } catch {
    return undefined;
  }
}

/**
 * Arma el estado de stock de cada línea de la orden, para el mail interno.
 *
 * Nunca lanza: cualquier falla de lectura (ubicación, variantes, inventario,
 * reservas) deja las líneas afectadas en `unknown` y el mail sale igual. Es la
 * misma garantía que `buildPickupContext`.
 */
export async function buildOrderStockContext(
  container: MedusaContainer,
  order: {
    metadata?: unknown;
    shipping_methods?: Array<{ data?: unknown; shipping_option_id?: string | null }> | null;
    items: OrderStockLineInput[];
  },
): Promise<OrderStockContext> {
  const byLineItemId = new Map<string, OrderStockItemView>();
  const query = container.resolve<QueryGraph>(ContainerRegistrationKeys.QUERY);
  const shippingMethods = Array.isArray(order.shipping_methods) ? (order.shipping_methods as UnknownRecord[]) : [];

  let resolved: { locationId: string; locationName?: string } | null = null;
  try {
    resolved = await resolveStockLocation(query, order.metadata, shippingMethods);
  } catch {
    resolved = null;
  }

  if (!resolved) {
    for (const item of order.items) {
      byLineItemId.set(item.line_item_id, viewFor('unknown', { kind: 'unknown' }));
    }
    return { stock_location_name: undefined, has_stock_issues: false, by_line_item_id: byLineItemId };
  }

  const { locationId, locationName } = resolved;

  const variantIds = [...new Set(order.items.map((i) => i.variant_id).filter((v): v is string => Boolean(v)))];
  const variantById = new Map<string, VariantForStock>();
  if (variantIds.length) {
    try {
      const { data: variants } = (await query.graph({
        entity: 'variant',
        fields: [
          'id',
          'manage_inventory',
          'allow_backorder',
          'inventory_items.inventory_item_id',
          'inventory_items.required_quantity',
        ],
        filters: { id: variantIds },
      })) as { data: UnknownRecord[] };
      for (const variant of variants ?? []) {
        const id = getString(variant, 'id');
        if (!id) continue;
        const links = Array.isArray(variant.inventory_items) ? (variant.inventory_items as UnknownRecord[]) : [];
        variantById.set(id, {
          manage_inventory: (variant.manage_inventory as boolean | null | undefined) ?? null,
          allow_backorder: (variant.allow_backorder as boolean | null | undefined) ?? null,
          inventory_items: links.map((link) => ({
            inventory_item_id: getString(link, 'inventory_item_id') ?? null,
            required_quantity:
              typeof link.required_quantity === 'number' ? link.required_quantity : Number(link.required_quantity) || null,
          })),
        });
      }
    } catch {
      // Se sigue con el mapa vacío: cada línea con variante cae a `unknown` más
      // abajo (no hay fila de variante que decida si trackea o no).
    }
  }

  const itemIds = inventoryItemIdsOf([...variantById.values()]);
  const rawAvailableByItem = new Map<string, number>();
  const unresolvedItemIds = new Set<string>();
  let reservations: ReservationForStock[] = [];

  if (itemIds.length) {
    const inventory = container.resolve<IInventoryService>(Modules.INVENTORY);
    for (const itemId of itemIds) {
      try {
        const available = await inventory.retrieveAvailableQuantity(itemId, [locationId]);
        rawAvailableByItem.set(itemId, Number(available) || 0);
      } catch {
        // No saber cuánto hay no es lo mismo que saber que no hay: esta línea
        // (y cualquier otra que comparta el componente) cae a `unknown`.
        unresolvedItemIds.add(itemId);
      }
    }
    try {
      reservations = (await inventory.listReservationItems({
        line_item_id: order.items.map((i) => i.line_item_id),
      })) as ReservationForStock[];
    } catch {
      // Sin reservas propias para sumar de vuelta: pesimista (puede mostrar
      // "insuficiente" de más), nunca al revés. El mail sale igual.
      reservations = [];
    }
  }

  let hasIssues = false;
  for (const item of order.items) {
    const variant = item.variant_id ? variantById.get(item.variant_id) : undefined;

    let availability: ItemAvailability;
    if (!variant) {
      availability = { kind: 'unknown' };
    } else if (!variantTracksStock(variant)) {
      availability = { kind: 'not_tracked' };
    } else {
      const links = variant.inventory_items ?? [];
      const blocked = links.some((link) => link.inventory_item_id && unresolvedItemIds.has(link.inventory_item_id));
      if (blocked) {
        availability = { kind: 'unknown' };
      } else {
        const available = netAvailableForVariant({
          variant,
          lineItemId: item.line_item_id,
          locationId,
          rawAvailableByItem,
          reservations,
        });
        availability = available === null ? { kind: 'not_tracked' } : { kind: 'tracked', available };
      }
    }

    const status = classifyOrderStock(item.quantity, availability);
    byLineItemId.set(item.line_item_id, viewFor(status, availability));
    if (status === 'insufficient' || status === 'none') hasIssues = true;
  }

  return { stock_location_name: locationName, has_stock_issues: hasIssues, by_line_item_id: byLineItemId };
}
