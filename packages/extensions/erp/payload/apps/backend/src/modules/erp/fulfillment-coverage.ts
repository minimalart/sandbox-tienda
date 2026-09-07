/**
 * Regla de COBERTURA del fulfillment: ¿este despacho cubre todo lo que falta de
 * la orden?
 *
 * Vive en un módulo puro (sin nada de `@medusajs/framework`) por la misma razón
 * que los `plan-*.ts` del sync: es la regla de negocio que garantiza UNA factura
 * por orden, y tiene que poder testearse sin container ni base. El glue HTTP que
 * la usa está en `api/admin/erp/fulfillment-gate.ts`.
 *
 * Por qué la regla existe: el ERP emite un comprobante por orden. Un fulfillment
 * parcial la partiría en dos comprobantes, o —peor— facturaría de menos y nadie
 * se enteraría hasta el cierre contable.
 */

export type CoverageOrderItem = {
  id: string;
  quantity?: number | null;
  detail?: { quantity?: number | null; fulfilled_quantity?: number | null } | null;
};

export type CoverageRequestedItem = { id?: unknown; quantity?: unknown };

export type CoverageGap = { id: string; pending: number; requested: number };

/**
 * Cantidad todavía sin despachar de un ítem.
 *
 * Se prefiere `detail` (el `OrderItem`, que es quien lleva
 * `fulfilled_quantity`) y se cae a `item.quantity` cuando no vino hidratado.
 * Nunca devuelve negativos: un ítem sobre-despachado no puede "descontar"
 * pendiente de otro.
 */
export function pendingQuantity(item: CoverageOrderItem): number {
  const ordered = Number(item.detail?.quantity ?? item.quantity ?? 0);
  const fulfilled = Number(item.detail?.fulfilled_quantity ?? 0);
  const pending = ordered - fulfilled;
  return Number.isFinite(pending) && pending > 0 ? pending : 0;
}

/**
 * Ítems que el request NO cubre por completo. Vacío = se puede despachar (y por
 * lo tanto facturar).
 *
 * Defensivo con el body a propósito: llega del cliente. Un `id` que no es string
 * o una `quantity` que no es número se ignoran en vez de contarse, así que un
 * body raro nunca puede resultar en "cubre todo" por accidente.
 */
export function findUncoveredItems(
  orderItems: CoverageOrderItem[],
  requested: CoverageRequestedItem[]
): CoverageGap[] {
  const requestedById = new Map<string, number>();
  for (const row of requested) {
    if (typeof row?.id !== 'string') continue;
    const quantity = Number(row.quantity ?? 0);
    requestedById.set(
      row.id,
      (requestedById.get(row.id) ?? 0) + (Number.isFinite(quantity) ? quantity : 0)
    );
  }

  const gaps: CoverageGap[] = [];
  for (const item of orderItems) {
    const pending = pendingQuantity(item);
    if (pending <= 0) continue;
    const got = requestedById.get(item.id) ?? 0;
    if (got < pending) gaps.push({ id: item.id, pending, requested: got });
  }
  return gaps;
}
