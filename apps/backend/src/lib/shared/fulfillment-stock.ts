/**
 * ¿Este fulfillment deja stock negativo en la ubicación elegida?
 *
 * ── EL COMPORTAMIENTO DEL CORE QUE ESTO CUBRE ────────────────────────────────
 *
 * En `createOrderFulfillmentWorkflow`, `prepareInventoryUpdate` arma cada ajuste
 * de inventario así:
 *
 *     location_id: input.location_id ?? reservation.location_id
 *
 * O sea: el descuento se aplica en la ubicación que eligió el operador, NO en la
 * de la reserva. Cuando las dos coinciden no pasa nada — la reserva ya tenía la
 * mercadería tomada ahí y se libera en el mismo movimiento. Cuando NO coinciden,
 * se le resta a una ubicación que nunca reservó nada, y el core no mira si hay:
 * el nivel queda en negativo, sin error y sin log.
 *
 * `allow_backorder` no lo evita: ese campo gobierna el CHECKOUT (si se puede
 * comprar sin stock), no el despacho.
 *
 * ── POR QUÉ ESTO NO LLEVA UN FLAG NUEVO ──────────────────────────────────────
 *
 * Porque la opción ya existe y es del core: `variant.allow_backorder`. Una tienda
 * que a propósito despacha sin stock —dropshipping, fabricación contra pedido—
 * ya lo tiene en `true`, y este chequeo la saltea. Agregar un flag propio sería
 * un segundo interruptor para la misma decisión, con la mitad de la semántica.
 *
 * ── LA REGLA, Y POR QUÉ NO ES "HAY STOCK SUFICIENTE" ─────────────────────────
 *
 * El corte no es contra el stock: es contra lo que el movimiento REALMENTE saca
 * de la disponibilidad de esa ubicación. Si la reserva ya está ahí, el descuento
 * y la liberación se cancelan y no hace falta nada disponible — pedir stock libre
 * ahí rechazaría despachos perfectamente válidos (todo pedido normal, de hecho).
 *
 * Por ubicación elegida L y por inventory item:
 *
 *     necesita   = Σ (cantidad pedida × required_quantity)
 *     cubierto   = Σ de esas mismas unidades que YA están reservadas en L
 *     descubierto = necesita − cubierto
 *
 * y el movimiento es válido mientras `descubierto <= disponible(L)`, donde
 * `disponible` es el `stocked − reserved` que devuelve el módulo de inventario.
 *
 * Es un módulo puro a propósito: la aritmética es la parte que se puede equivocar
 * en silencio, y probarla no debería exigir levantar Medusa ni una base.
 */

/** Lo que el operador manda en el body de `POST /admin/orders/:id/fulfillments`. */
export type FulfillmentRequestItem = {
  id: string;
  quantity?: number | null;
};

/** Lo mínimo que hace falta de cada línea de la orden. */
export type OrderLineForStock = {
  id: string;
  title?: string | null;
  variant?: {
    manage_inventory?: boolean | null;
    allow_backorder?: boolean | null;
    inventory_items?: Array<{
      inventory_item_id?: string | null;
      required_quantity?: number | null;
    }> | null;
  } | null;
};

/** Una reserva viva de una línea de esta orden. */
export type ReservationForStock = {
  line_item_id?: string | null;
  inventory_item_id?: string | null;
  location_id?: string | null;
  quantity?: number | null;
};

/** Cuánto sale de la disponibilidad de la ubicación elegida, por inventory item. */
export type StockDemand = {
  inventory_item_id: string;
  /** Unidades a descontar en la ubicación (ya multiplicado por `required_quantity`). */
  needed: number;
  /** De esas unidades, las que ya están reservadas EN esa misma ubicación. */
  covered: number;
  /** `needed - covered`: lo que efectivamente sale de la disponibilidad. */
  uncovered: number;
  /** Títulos de las líneas que lo piden. Es para el mensaje al operador, que lee nombres. */
  titles: string[];
};

export type StockShortfall = StockDemand & {
  available: number;
  /** Cuántas unidades faltan. Es exactamente cuánto quedaría en negativo el nivel. */
  missing: number;
};

const toNumber = (value: unknown, fallback: number): number => {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : fallback;
};

/**
 * ¿Esta línea participa del control?
 *
 * Sólo las que Medusa realmente descuenta (`manage_inventory`) y que no declaran
 * explícitamente que aceptan quedar en negativo (`allow_backorder`). Un
 * `undefined` en `manage_inventory` significa "no pedimos el campo", no "no
 * gestiona": el llamador tiene que pedirlo, y si no está, la línea se saltea en
 * vez de inventar un corte.
 */
export function participatesInStockCheck(line: OrderLineForStock): boolean {
  const variant = line.variant;
  if (!variant) return false;
  if (variant.manage_inventory !== true) return false;
  if (variant.allow_backorder === true) return false;
  return true;
}

/**
 * Qué le sale a la ubicación `locationId` este fulfillment, por inventory item.
 *
 * `requested` son los ítems del body. Una línea que no está ahí no se despacha y
 * no cuenta. Una cantidad ausente o no numérica se toma como 0: no inventamos un
 * descuento que el operador no pidió.
 */
export function planStockDemand(
  lines: OrderLineForStock[] | null | undefined,
  requested: FulfillmentRequestItem[] | null | undefined,
  reservations: ReservationForStock[] | null | undefined,
  locationId: string,
): StockDemand[] {
  const requestedById = new Map<string, number>();
  for (const item of requested ?? []) {
    if (!item?.id) continue;
    const quantity = toNumber(item.quantity, 0);
    if (quantity <= 0) continue;
    requestedById.set(item.id, (requestedById.get(item.id) ?? 0) + quantity);
  }
  if (requestedById.size === 0) return [];

  // Reservas por línea. Ojo: una línea puede tener varias (un inventory item por
  // componente del kit), y pueden estar en ubicaciones distintas entre sí.
  const reservationsByLine = new Map<string, ReservationForStock[]>();
  for (const reservation of reservations ?? []) {
    const lineId = reservation?.line_item_id;
    if (!lineId) continue;
    const bucket = reservationsByLine.get(lineId);
    if (bucket) bucket.push(reservation);
    else reservationsByLine.set(lineId, [reservation]);
  }

  const demands = new Map<string, StockDemand>();

  for (const line of lines ?? []) {
    const quantity = requestedById.get(line.id);
    if (!quantity) continue;
    if (!participatesInStockCheck(line)) continue;

    const inventoryItems = line.variant?.inventory_items ?? [];
    for (const link of inventoryItems) {
      const inventoryItemId = link?.inventory_item_id;
      if (!inventoryItemId) continue;

      // Es el mismo cálculo que hace el core para el ajuste.
      const needed = quantity * toNumber(link.required_quantity, 1);
      if (needed <= 0) continue;

      // Lo ya reservado en ESTA ubicación para esta línea y este inventory item.
      // El core consume como mucho lo que la reserva tiene, así que el tope es
      // `reservation.quantity` — una reserva parcial cubre parcialmente.
      const covered = (reservationsByLine.get(line.id) ?? [])
        .filter(
          (reservation) =>
            reservation.inventory_item_id === inventoryItemId &&
            reservation.location_id === locationId,
        )
        .reduce((total, reservation) => total + Math.max(0, toNumber(reservation.quantity, 0)), 0);

      const entry = demands.get(inventoryItemId) ?? {
        inventory_item_id: inventoryItemId,
        needed: 0,
        covered: 0,
        uncovered: 0,
        titles: [],
      };
      entry.needed += needed;
      entry.covered += Math.min(covered, needed);
      entry.uncovered = Math.max(0, entry.needed - entry.covered);

      const title = line.title?.trim();
      if (title && !entry.titles.includes(title)) entry.titles.push(title);

      demands.set(inventoryItemId, entry);
    }
  }

  return [...demands.values()].filter((demand) => demand.uncovered > 0);
}

/**
 * Cuáles de esas demandas no entran en lo disponible.
 *
 * `availableByItem` es lo que devuelve el módulo de inventario para la ubicación
 * elegida. Un inventory item ausente del mapa se trata como 0 y no como "no sé":
 * que no haya nivel en esa ubicación es justamente el caso de despachar desde un
 * lugar que no stockea el producto, y es el que hay que frenar.
 */
export function findStockShortfalls(
  demands: StockDemand[],
  availableByItem: Map<string, number>,
): StockShortfall[] {
  const shortfalls: StockShortfall[] = [];
  for (const demand of demands) {
    const available = Math.max(0, toNumber(availableByItem.get(demand.inventory_item_id), 0));
    if (demand.uncovered <= available) continue;
    shortfalls.push({ ...demand, available, missing: demand.uncovered - available });
  }
  return shortfalls;
}

/**
 * El mensaje que ve el operador (DESDEELSUR-80).
 *
 * Qué pasó + qué hacer, y nada más: ni cantidades, ni ids, ni la aritmética de
 * reservas. Eso queda en el log del gate. Los productos tampoco se listan: el
 * formulario de fulfillment ya muestra el stock disponible de cada línea en la
 * ubicación elegida, que es donde el operador mira cuál falta.
 *
 * ── EL CONTRATO CON EL DASHBOARD ─────────────────────────────────────────────
 *
 * La primera línea es el TÍTULO y el resto la descripción: el patch de
 * `@medusajs/dashboard` parte el mensaje en el primer `\n` y lo muestra en una
 * alerta dentro del form, no en un toast (se iba antes de poder leerlo). Sin el
 * patch se ve todo junto, que sigue siendo legible.
 *
 * El mismo texto vive DUPLICADO en la tarjeta preventiva del form (DESDEELSUR-78,
 * `hasStockShortage` en el patch), que es lo que el operador ve casi siempre:
 * con stock corto el botón se deshabilita y este rechazo sólo llega en carreras.
 * Si cambia uno, cambiar el otro. La tarjeta dice "en el ERP" porque el
 * dashboard no sabe qué ERP hay.
 *
 * `erpName` es el sistema donde se transfiere la mercadería ("Zeus"); sin ERP
 * activo la instrucción no nombra ninguno.
 */
export function describeShortfalls(locationName: string | null, erpName: string | null): string {
  const where = locationName ?? 'la ubicación elegida';
  const transferIn = erpName ? `Transferí en ${erpName}` : 'Transferí';

  return [
    `No podés preparar este pedido desde ${where}`,
    'Hay productos que todavía no tienen stock suficiente en esta sucursal.',
    `${transferIn} los productos faltantes a ${where}. Una vez actualizado el stock, volvé a intentar preparar el pedido.`,
  ].join('\n');
}
