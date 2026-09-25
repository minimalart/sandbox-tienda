/**
 * Aritmética PURA de disponibilidad de stock para los mails de orden.
 *
 * Existe separada de `pickup-context.ts` y `order-stock-context.ts` porque los
 * dos necesitan la MISMA corrección sobre el MISMO bug.
 *
 * ── EL BUG (DESDEELSUR, pedido #80, retiro en Elordi) ────────────────────────
 *
 * En `@medusajs/inventory` 2.18, `InventoryLevel.available_quantity` es
 * `model.bigNumber().computed()`: NO es una columna ni una propiedad real del
 * ORM. La llena un hook `onInit` (`dist/utils/apply-decorators.js`) SÓLO si
 * `stocked_quantity` y `reserved_quantity` vinieron cargados junto con la fila.
 * Pedir por `query.graph` ÚNICAMENTE `location_levels.available_quantity` (sin
 * los otros dos) deja el campo `undefined` → `Number(undefined) || 0` = 0 →
 * TODA línea sale "Sin stock", así haya mercadería (el SKU V16 tenía stocked 3 /
 * reserved 0 en la sucursal Elordi y el mail dijo que no había).
 *
 * La forma correcta es el SERVICIO de inventario
 * (`IInventoryService.retrieveAvailableQuantity`, ver `order-stock-context.ts` y
 * el `availabilityByVariant` de `pickup-context.ts`): resuelve contra el
 * REPOSITORIO (`inventoryLevelRepository.getAvailableQuantity`), no contra el
 * grafo, así que no pisa el computed field. Este módulo NO llama a ese servicio
 * (no tiene el container): sólo hace la cuenta con el número que YA vino bien.
 *
 * ── LA SEGUNDA TRAMPA: LA RESERVA DE ESTA MISMA ORDEN ────────────────────────
 *
 * El mail sale en `order.placed`, con la reserva de ESTA orden ya creada. Si esa
 * reserva vive en la ubicación que se está evaluando, el disponible que devuelve
 * el servicio YA la descontó — hay que sumarla de vuelta, porque es mercadería
 * que ya está comprometida para ESTA línea (el comprador la pagó), no stock de
 * un tercero que haya que reservarle. Sumar una reserva AJENA sería el error
 * inverso: mostrarle al operador que hay más de lo que realmente puede preparar.
 */

/** Un componente de inventario de una variante, con cuánto necesita por unidad. */
export type InventoryItemLink = {
  inventory_item_id?: string | null;
  required_quantity?: number | null;
};

/** Lo mínimo que hace falta de una variante para calcular su disponibilidad. */
export type VariantForStock = {
  manage_inventory?: boolean | null;
  allow_backorder?: boolean | null;
  inventory_items?: InventoryItemLink[] | null;
};

/** Una reserva viva, tal como la devuelve `inventory.listReservationItems`. */
export type ReservationForStock = {
  line_item_id?: string | null;
  inventory_item_id?: string | null;
  location_id?: string | null;
  quantity?: number | null;
};

const toNumber = (value: unknown, fallback = 0): number => {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : fallback;
};

/**
 * ¿Esta variante participa del control de stock?
 *
 * `allow_backorder` gobierna el CHECKOUT (si se puede comprar sin stock): una
 * variante así no tiene un "disponible" que reportar sin mentir — no es que
 * falte, es que la tienda decidió no mirarlo. `manage_inventory !== true`
 * (incluye `undefined`, un dato que el llamador no pidió) se saltea igual: es
 * responsabilidad de quien arma la consulta pedir el campo, no de acá inventar
 * un valor.
 *
 * Mismo criterio que `participatesInStockCheck` de `lib/shared/fulfillment-stock.ts`
 * (el gate de despacho): se DUPLICA a propósito en vez de importarse, porque ese
 * archivo es código compartido del backend y este vive en la extensión
 * `email-templates` — ver la nota de imports cruzados en `pickup-context.ts`.
 */
export function variantTracksStock(variant: VariantForStock): boolean {
  return variant.manage_inventory === true && variant.allow_backorder !== true;
}

/**
 * Cuánto hay REALMENTE disponible de una variante en `locationId`, ya sumando de
 * vuelta las reservas de ESTA orden ahí. `null` = la variante no gestiona
 * inventario (`variantTracksStock` en falso): no hay un número que mostrar sin
 * mentir, y el llamador tiene que tratarlo como "no aplica", nunca como "sin
 * stock".
 *
 * Un kit (varios inventory items) vale lo que vale su componente más escaso, EN
 * UNIDADES DE LA VARIANTE: cada componente se divide por su `required_quantity`
 * antes de tomar el mínimo. Sin esa división, un componente que se gasta de a 2
 * o 3 por unidad mostraría dos o tres veces la disponibilidad real.
 */
export function netAvailableForVariant(params: {
  variant: VariantForStock;
  lineItemId: string;
  locationId: string;
  /** `inventory_item_id` → disponible crudo, YA leído del servicio de inventario. */
  rawAvailableByItem: Map<string, number>;
  reservations: readonly ReservationForStock[];
}): number | null {
  if (!variantTracksStock(params.variant)) return null;

  const links = params.variant.inventory_items ?? [];
  // Gestiona inventario pero no tiene ningún inventory item enlazado: no hay de
  // dónde sacar una cantidad, así que no hay nada disponible.
  if (links.length === 0) return 0;

  let minimum: number | null = null;
  for (const link of links) {
    const itemId = link.inventory_item_id;
    if (!itemId) continue;

    const required = toNumber(link.required_quantity, 1) || 1;
    const raw = params.rawAvailableByItem.get(itemId) ?? 0;
    const ownReserved = params.reservations.reduce((sum, reservation) => {
      const matches =
        reservation.inventory_item_id === itemId &&
        reservation.location_id === params.locationId &&
        reservation.line_item_id === params.lineItemId;
      return matches ? sum + toNumber(reservation.quantity, 0) : sum;
    }, 0);

    const net = raw + ownReserved;
    const perUnit = Math.floor(net / required);
    minimum = minimum === null ? perUnit : Math.min(minimum, perUnit);
  }
  return minimum ?? 0;
}

/**
 * Todos los `inventory_item_id` que hace falta consultarle al servicio de
 * inventario para resolver estas variantes. Deduplicado: dos variantes pueden
 * compartir un componente de kit.
 */
export function inventoryItemIdsOf(variants: readonly VariantForStock[]): string[] {
  const ids = new Set<string>();
  for (const variant of variants) {
    for (const link of variant.inventory_items ?? []) {
      if (link.inventory_item_id) ids.add(link.inventory_item_id);
    }
  }
  return [...ids];
}
