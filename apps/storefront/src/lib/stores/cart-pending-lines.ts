/**
 * Líneas optimistas con un "add" todavía en la cola de mutaciones.
 *
 * La red del carrito se serializa y cada operación tarda varios segundos, así
 * que agregar varios productos seguidos deja una cola de "add" esperando. Sus
 * líneas viven SÓLO en el store (id `optimistic-line-…`): el server todavía no
 * las conoce.
 *
 * Cualquier snapshot del server que se aplique mientras tanto (un `fetchCart`,
 * la respuesta de un update o de un delete) llega SIN esas líneas. Aplicarlo
 * tal cual las borraba de la UI, y cuando cada "add" encolado resolvía no
 * encontraba su variante en el carrito local, lo interpretaba como "el usuario
 * la sacó mientras se agregaba" y mandaba un delete. Una sola pisada vaciaba en
 * cascada todo lo que estaba en la cola (DESDEELSUR: el carrito "me sacó
 * productos" sin que nadie tocara el tacho).
 */

type LineLike = {
  id: string;
  variant_id?: string | null;
};

type CartLike<L extends LineLike> = {
  items?: L[] | null;
};

export const OPTIMISTIC_LINE_PREFIX = 'optimistic-line';

export const isOptimisticLineId = (id: string) => id.startsWith(OPTIMISTIC_LINE_PREFIX);

/**
 * Devuelve el snapshot del server con las líneas optimistas cuyo "add" sigue
 * pendiente. Sólo se conservan las de variantes en `pendingVariantIds`: una
 * línea optimista huérfana (su add ya terminó) no debe quedar pegada.
 */
export function keepPendingOptimisticLines<L extends LineLike, C extends CartLike<L>>(
  serverCart: C,
  localCart: CartLike<L> | null | undefined,
  pendingVariantIds: ReadonlySet<string>,
): C {
  if (pendingVariantIds.size === 0) return serverCart;

  const serverItems = serverCart.items ?? [];
  const pending = (localCart?.items ?? []).filter(
    (item) =>
      isOptimisticLineId(item.id) &&
      Boolean(item.variant_id) &&
      pendingVariantIds.has(item.variant_id as string) &&
      !serverItems.some((serverItem) => serverItem.variant_id === item.variant_id),
  );

  if (!pending.length) return serverCart;
  return { ...serverCart, items: [...serverItems, ...pending] };
}
