import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { MedusaContainer } from '@medusajs/framework/types';

/**
 * pickup-context — los datos de "retiro en tienda" que necesitan los mails.
 *
 * Tres mails lo consumen y cada uno usa una parte:
 *  - `order-confirmation` (cliente): sólo `is_store_pickup` + `pickup_store`,
 *    para mostrar el aviso de las 24 h y decir en qué local retira.
 *  - `order-notification-admin` (interno): además `pickup_items`, la
 *    disponibilidad real de cada línea EN ESA SUCURSAL.
 *  - `order-ready-for-pickup` (cliente): `pickup_store` con horarios.
 *
 * TODO lo que sale de acá es OPCIONAL en las plantillas: una orden que no es de
 * retiro devuelve `null` y los `{{#if}}` no dibujan nada. Nunca lanza — un mail
 * no se pierde porque no se pudo leer una sucursal.
 *
 * NO IMPORTA NADA DE `store-location` NI DE `delivery` A PROPÓSITO. Este archivo
 * lo posee la extensión `email-templates`, y una instalación puede tener los
 * mails sin ninguna de las otras dos. Un import cruzado dejaría el backend sin
 * bootear en esa combinación. Todo se lee por `query.graph`, que devuelve vacío
 * —no explota— cuando el módulo no está registrado. Es la misma decisión, y por
 * la misma razón, que `tintOfItem` en `subscribers/order-placed-email.ts`.
 */

type UnknownRecord = Record<string, unknown>;

const isRecord = (v: unknown): v is UnknownRecord =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const getString = (source: unknown, key: string): string | undefined => {
  if (!isRecord(source)) return undefined;
  const value = source[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
};

/**
 * La sucursal que ELIGIÓ el comprador, o `null`.
 *
 * DUPLICADO A PROPÓSITO de `workflows/create-delivery-execution.ts`
 * (`resolveChosenStoreLocationId`), que es de la extensión `delivery`. Son cinco
 * líneas contra un acople entre extensiones — ver el encabezado del archivo.
 *
 * Que `getString` descarte el string vacío no es un detalle: al cambiar de modo
 * de entrega el storefront LIMPIA el campo escribiendo `store_id: ''` en vez de
 * borrarlo, así que un `''` tiene que leerse como "no eligió", no como id.
 */
export const chosenStoreLocationId = (
  orderMetadata: unknown,
  shippingMethods: UnknownRecord[],
): string | null =>
  getString(orderMetadata, 'store_id') ??
  shippingMethods
    .map((m) => getString(m?.data, 'store_id'))
    .find((v): v is string => Boolean(v)) ??
  null;

/**
 * Días de `business_hours` EN ESPAÑOL, que es como los escribe el editor del
 * admin (`admin/routes/store-locations/components/business-hours-editor.tsx`) y
 * como están las 4 sucursales de producción.
 *
 * Se aceptan además los nombres en inglés como alias de LECTURA: no los produce
 * nadie hoy, pero leerlos no cuesta nada y evita que una fila importada de otra
 * fuente muestre el bloque de horarios vacío sin decir por qué.
 */
const DAY_LABELS: Array<[string, string, string]> = [
  ['lunes', 'monday', 'Lunes'],
  ['martes', 'tuesday', 'Martes'],
  ['miercoles', 'wednesday', 'Miércoles'],
  ['jueves', 'thursday', 'Jueves'],
  ['viernes', 'friday', 'Viernes'],
  ['sabado', 'saturday', 'Sábado'],
  ['domingo', 'sunday', 'Domingo'],
];

/**
 * `business_hours` es `Record<día, { closed, is24Hours, slots: [{open, close}] }>`.
 *
 * Los días consecutivos con el MISMO horario se agrupan ("Lunes a Viernes: 09:00
 * a 18:00") y los cerrados no se listan: siete líneas por sucursal en un mail de
 * "vení a retirar" es ruido, no información.
 *
 * Devuelve `[]` cuando no hay nada configurado, y el ticket pide justamente eso:
 * los horarios van "si se encuentran configurados".
 */
export function formatBusinessHours(raw: unknown): string[] {
  if (!isRecord(raw)) return [];

  const perDay = DAY_LABELS.map(([esKey, enKey, label]) => {
    const day = (raw[esKey] ?? raw[enKey]) as UnknownRecord | undefined;
    if (!isRecord(day) || day.closed === true) return { label, text: 'cerrado' };
    if (day.is24Hours === true) return { label, text: '24 h' };
    const slots = Array.isArray(day.slots) ? (day.slots as UnknownRecord[]) : [];
    const text = slots
      .map((s) => (getString(s, 'open') && getString(s, 'close') ? `${s.open} a ${s.close}` : null))
      .filter(Boolean)
      .join(' y ');
    return { label, text: text || 'cerrado' };
  });

  const lines: string[] = [];
  let runStart = 0;
  for (let i = 1; i <= perDay.length; i++) {
    const changed = i === perDay.length || perDay[i]!.text !== perDay[runStart]!.text;
    if (!changed) continue;
    const { text } = perDay[runStart]!;
    if (text !== 'cerrado') {
      const from = perDay[runStart]!.label;
      const to = perDay[i - 1]!.label;
      lines.push(runStart === i - 1 ? `${from}: ${text}` : `${from} a ${to}: ${text}`);
    }
    runStart = i;
  }
  return lines;
}

/** El estado de una línea contra el stock de la sucursal elegida. */
export type PickupStockStatus = 'available' | 'insufficient' | 'none';

export type PickupItemStock = {
  title: string;
  variant_title?: string;
  sku?: string;
  /** Lo que pidió el cliente. */
  quantity: number;
  /** Lo que hay en ESA sucursal. `null` = no se pudo determinar. */
  available: number | null;
  /**
   * `available` ya formateado para pintar. EXISTE porque la plantilla no puede
   * hacerlo: `{{#if available}}` es FALSO cuando hay 0 unidades, así que la celda
   * de la línea sin stock —justo la que hay que mirar— saldría vacía. Y el
   * renderer es Handlebars pelado, sin helpers registrados: un `{{#eq}}` no
   * resuelve el caso, lanza "Missing helper" y se cae el mail entero.
   */
  available_label: string;
  status: PickupStockStatus;
  /** Etiqueta lista para pintar ("Stock disponible" / "Stock insuficiente" / "Sin stock"). */
  status_label: string;
  /** Color del badge, ya resuelto acá para que la plantilla no decida. */
  status_color: string;
};

export type PickupStore = {
  id: string;
  name: string;
  address: string;
  phone?: string;
  /** Líneas ya agrupadas y formateadas. Vacío si la sucursal no tiene horarios. */
  hours: string[];
  map_url?: string;
};

export type PickupContext = {
  is_store_pickup: true;
  pickup_store?: PickupStore;
  /** Sólo para el mail interno. Vacío si no se pudo leer el inventario. */
  pickup_items: PickupItemStock[];
  /** True si ALGUNA línea no llega a la cantidad pedida. Para el asunto/banner. */
  pickup_has_stock_issues: boolean;
};

const STATUS_PRESENTATION: Record<PickupStockStatus, { label: string; color: string }> = {
  // Verde / ámbar / rojo. No son los colores de la marca a propósito: es un
  // semáforo operativo y tiene que leerse igual en cualquier tienda.
  available: { label: 'Stock disponible', color: '#15803d' },
  insufficient: { label: 'Stock insuficiente', color: '#b45309' },
  none: { label: 'Sin stock', color: '#b91c1c' },
};

/**
 * Clasifica una línea. `available === null` (no se pudo leer el inventario) NO
 * se reporta como "sin stock": decirle a Gonzalo que no hay mercadería cuando en
 * realidad no pudimos consultar es peor que no decirle nada. Cae en
 * `insufficient`, que es el estado que pide mirar.
 */
export function classifyStock(quantity: number, available: number | null): PickupStockStatus {
  if (available === null) return 'insufficient';
  if (available <= 0) return 'none';
  return available >= quantity ? 'available' : 'insufficient';
}

type OrderLike = {
  metadata?: UnknownRecord | null;
  shipping_methods?: UnknownRecord[];
  items?: Array<{
    title?: string | null;
    variant_title?: string | null;
    variant_id?: string | null;
    quantity?: number | null;
    detail?: { quantity?: number | null } | null;
  }>;
};

type QueryGraph = {
  graph: (input: unknown) => Promise<{ data: unknown[] }>;
};

/** Mapa variant_id → unidades disponibles en `stockLocationId`. */
async function availabilityByVariant(
  query: QueryGraph,
  variantIds: string[],
  stockLocationId: string,
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (!variantIds.length) return result;

  const { data: variants } = (await query.graph({
    entity: 'variant',
    fields: [
      'id',
      'sku',
      // Misma selección que usa el indexador de Typesense (`modules/typesense/
      // reindex.ts`) y el hidratador de recomendaciones: variante → inventory
      // item → niveles por ubicación. `location_levels` trae UNA fila por stock
      // location, así que hay que filtrar por la de la sucursal a mano.
      'inventory_items.inventory.location_levels.location_id',
      'inventory_items.inventory.location_levels.available_quantity',
    ],
    filters: { id: variantIds },
  })) as { data: UnknownRecord[] };

  for (const variant of variants ?? []) {
    const id = getString(variant, 'id');
    if (!id) continue;
    const inventoryItems = Array.isArray(variant.inventory_items)
      ? (variant.inventory_items as UnknownRecord[])
      : [];

    /**
     * Una variante con VARIOS inventory items (un kit) está disponible tantas
     * veces como su componente más escaso: es un mínimo, no una suma. Sumar daría
     * "hay 12" cuando de uno de los dos componentes hay 1.
     */
    let minimum: number | null = null;
    for (const item of inventoryItems) {
      const inventory = isRecord(item.inventory) ? item.inventory : undefined;
      const levels = Array.isArray(inventory?.location_levels)
        ? (inventory!.location_levels as UnknownRecord[])
        : [];
      const level = levels.find((l) => getString(l, 'location_id') === stockLocationId);
      // Sin fila de nivel para esa ubicación, Medusa considera 0: el item existe
      // pero esa sucursal no lo stockea.
      const qty = level ? Number(level.available_quantity) || 0 : 0;
      minimum = minimum === null ? qty : Math.min(minimum, qty);
    }

    if (minimum !== null) result.set(id, minimum);
  }

  return result;
}

/**
 * Arma el contexto de retiro de una orden, o `null` si no es de retiro en tienda.
 *
 * `withStock` controla la consulta de inventario, que es la parte cara: el mail
 * del cliente no la necesita y pedirla igual sería una consulta por orden para
 * datos que nadie mira.
 */
export async function buildPickupContext(
  container: MedusaContainer,
  order: OrderLike,
  opts: { withStock?: boolean } = {},
): Promise<PickupContext | null> {
  const storeLocationId = chosenStoreLocationId(
    order.metadata,
    Array.isArray(order.shipping_methods) ? order.shipping_methods : [],
  );
  if (!storeLocationId) return null;

  const query = container.resolve<QueryGraph>(ContainerRegistrationKeys.QUERY);

  let location: UnknownRecord | undefined;
  try {
    const { data: rows } = (await query.graph({
      entity: 'store_location',
      fields: [
        'id',
        'name',
        'street',
        'city',
        'province',
        'phone',
        'business_hours',
        'lat',
        'lng',
        'stock_location_id',
      ],
      filters: { id: storeLocationId },
    })) as { data: UnknownRecord[] };
    location = rows?.[0];
  } catch {
    // Extensión `store-locations` ausente, o la fila se borró. La orden SIGUE
    // siendo de retiro —el comprador eligió uno— así que se devuelve el contexto
    // sin sucursal en vez de null: el aviso de las 24 h tiene que salir igual.
    location = undefined;
  }

  const pickupStore: PickupStore | undefined = location
    ? {
        id: storeLocationId,
        name: getString(location, 'name') ?? '',
        address: [location.street, location.city, location.province]
          .map((p) => (typeof p === 'string' ? p.trim() : ''))
          .filter(Boolean)
          .join(', '),
        phone: getString(location, 'phone'),
        hours: formatBusinessHours(location.business_hours),
        map_url: buildMapUrl(location),
      }
    : undefined;

  const items = Array.isArray(order.items) ? order.items : [];
  const stockLocationId = getString(location, 'stock_location_id');

  let availability = new Map<string, number>();
  if (opts.withStock && stockLocationId) {
    const variantIds = items
      .map((i) => (typeof i.variant_id === 'string' ? i.variant_id : null))
      .filter((v): v is string => Boolean(v));
    try {
      availability = await availabilityByVariant(query, [...new Set(variantIds)], stockLocationId);
    } catch {
      // Se sigue con el mapa vacío: cada línea queda en `available: null` y se
      // clasifica como 'insufficient' (ver classifyStock). El mail sale.
      availability = new Map();
    }
  }

  const pickupItems: PickupItemStock[] = opts.withStock
    ? items.map((item) => {
        const quantity = Number(item.quantity ?? item.detail?.quantity ?? undefined) || 0;
        const variantId = typeof item.variant_id === 'string' ? item.variant_id : null;
        const available = variantId && availability.has(variantId)
          ? (availability.get(variantId) as number)
          : null;
        const status = classifyStock(quantity, available);
        const presentation = STATUS_PRESENTATION[status];
        return {
          title: item.title ?? '',
          variant_title: item.variant_title ?? undefined,
          quantity,
          available,
          // El guion largo es "no lo sabemos", que NO es lo mismo que "no hay".
          available_label: available === null ? '—' : String(available),
          status,
          status_label: presentation.label,
          status_color: presentation.color,
        };
      })
    : [];

  return {
    is_store_pickup: true,
    pickup_store: pickupStore,
    pickup_items: pickupItems,
    pickup_has_stock_issues: pickupItems.some((i) => i.status !== 'available'),
  };
}

/** Link a Google Maps desde las coordenadas guardadas (nunca se consulta en vivo). */
export function buildMapUrl(location: UnknownRecord): string | undefined {
  const lat = getString(location, 'lat');
  const lng = getString(location, 'lng');
  if (lat && lng) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
  }
  const parts = [location.street, location.city, location.province]
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter(Boolean);
  if (!parts.length) return undefined;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts.join(', '))}`;
}
