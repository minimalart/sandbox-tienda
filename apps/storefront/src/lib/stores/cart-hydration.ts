/**
 * Decisión de hidratación del store del carrito al montar un `StoreProvider`.
 *
 * Cada grupo de rutas (`(main)`, `(checkout)`, `(b2b)`) tiene su propio layout
 * con su propio `<StoreProvider cart={cart}>`, así que al navegar entre grupos
 * se monta un provider NUEVO con el carrito que trajo ese layout desde el
 * servidor. El store de Zustand, en cambio, es de módulo: vive toda la sesión
 * SPA y sólo se reinicia con una carga completa de página.
 *
 * El `cart` que llega por props puede ser VIEJO: el Router Cache del cliente
 * reutiliza el payload de un layout dinámico por 30 s (`staleTimes.dynamic` en
 * `next.config.js`) y los shells prefetcheados por 3 min. Volver del checkout
 * a la tienda dentro de esa ventana traía el layout `(main)` con el carrito tal
 * cual estaba ANTES de entrar al checkout. Si en el medio el usuario lo vació
 * (o compró), el provider lo re-hidrataba con los ítems viejos y el carrito
 * "resucitaba" hasta un refresh duro, que es lo único que vacía ese cache.
 *
 * Regla: el primer provider de la sesión hidrata con lo que trae el server
 * (no hay nada mejor); los siguientes NO pisan el store, que ya refleja todo
 * lo que hizo el usuario, y reconcilian contra el server de verdad con un
 * fetch en segundo plano, salvo que haya mutaciones optimistas en vuelo (el
 * mismo resguardo que ya usa el re-fetch por `visibilitychange`).
 */
export type CartHydrationDecision =
  /** Primer montaje con carrito del server: `hydrate(cart)`. */
  | "hydrate-server-cart"
  /** Primer montaje sin carrito del server: `fetchCart()`. */
  | "fetch-initial"
  /** Store ya vivo, sin operaciones pendientes: `fetchCart()` para reconciliar. */
  | "reconcile"
  /** Store ya vivo con mutaciones optimistas en vuelo: no tocar nada. */
  | "keep-store";

export function resolveCartHydration({
  isHydrated,
  hasServerCart,
  hasPendingMutations,
}: {
  isHydrated: boolean;
  hasServerCart: boolean;
  hasPendingMutations: boolean;
}): CartHydrationDecision {
  if (isHydrated) {
    return hasPendingMutations ? "keep-store" : "reconcile";
  }
  return hasServerCart ? "hydrate-server-cart" : "fetch-initial";
}
