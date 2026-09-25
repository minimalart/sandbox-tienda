import type { HttpTypes } from '@medusajs/types';
import { toast } from '@medusajs/ui';
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { triggerHaptic } from '@lib/util/haptics';
import { clampToStock, getLineItemMaxQuantity } from '@lib/util/max-purchasable-quantity';
import {
  isOptimisticLineId,
  keepPendingOptimisticLines,
  OPTIMISTIC_LINE_PREFIX,
} from './cart-pending-lines';

// ============================================================================
// TYPES
// ============================================================================

interface CartState {
  // Estado
  cart: HttpTypes.StoreCart | null;
  isOpen: boolean;
  isLoading: boolean;
  isHydrated: boolean;
  error: string | null;

  // Optimistic state
  pendingQuantityUpdates: Map<string, number>;
  pendingAdditions: Set<string>;
  quantityDebounceTimers: Map<string, NodeJS.Timeout>;
}

interface CartActions {
  // Hydration
  setCart: (cart: HttpTypes.StoreCart | null) => void;
  hydrate: (cart: HttpTypes.StoreCart | null) => void;

  // Drawer
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;

  // Loading/Error
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Cart operations (optimistic)
  fetchCart: () => Promise<void>;
  addItem: (
    variantId: string,
    quantity: number,
    countryCode: string,
    productId?: string,
    metadata?: Record<string, unknown>,
    optimistic?: OptimisticLineOptions
  ) => Promise<boolean>;
  setPendingAdditionQuantity: (
    variantId: string,
    productId: string | undefined,
    quantity: number
  ) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  /**
   * Ajuste RELATIVO de cantidad para los steppers +/-. Lee la cantidad actual
   * del store (no una capturada en el render), así N clicks rápidos suman N.
   */
  changeItemQuantity: (lineId: string, delta: number) => void;
  removeItem: (lineId: string) => Promise<boolean>;
  /**
   * Saca un kit entero (todas las líneas con ese `bundle_instance_id`) con
   * UNA llamada al servidor, en vez de un `removeItem` por producto.
   */
  removeBundleInstance: (bundleInstanceId: string) => Promise<boolean>;

  // Helpers
  getItemByVariantId: (variantId: string) => HttpTypes.StoreCartLineItem | undefined;
  isAddingItem: (variantId: string) => boolean;

  // Computed
  itemCount: () => number;
  subtotal: () => number;

  // Internal
  _syncQuantityToServer: (
    lineId: string,
    quantity: number,
    version?: number
  ) => Promise<void>;
  _clearPendingUpdate: (lineId: string) => void;

  // Reset
  clearCart: () => void;
}

type CartStore = CartState & CartActions;

type OptimisticLineOptions = {
  title?: string | null;
  handle?: string | null;
  thumbnail?: string | null;
  unitPrice?: number | null;
  currencyCode?: string | null;
};

const isOptimisticLine = (item: HttpTypes.StoreCartLineItem) => isOptimisticLineId(item.id);

// Variantes cuya línea OPTIMISTA el usuario sacó (tacho o cantidad 0) mientras
// su "add" seguía en la cola. Es la única señal válida de "la sacó mientras se
// agregaba": inferirlo porque la variante no está en el carrito local fallaba
// cada vez que un snapshot del server pisaba las líneas optimistas, y cada add
// encolado terminaba borrando la línea que acababa de crear.
const removedWhilePendingVariantIds = new Set<string>();

const markOptimisticLineRemoved = (line: HttpTypes.StoreCartLineItem | undefined) => {
  if (line && isOptimisticLine(line) && line.variant_id) {
    removedWhilePendingVariantIds.add(line.variant_id);
  }
};

/**
 * Firma del entonado de una línea: `''` para una línea normal, o el color +
 * fórmula si va entonada. Sirve para que la identidad optimista de la línea
 * coincida con la del backend, que mergea comparando la metadata completa.
 */
const tintSignatureOf = (metadata: Record<string, unknown> | null | undefined): string => {
  const tint = metadata?.tint as { cod_formula?: unknown; color_code?: unknown } | undefined;
  if (!tint || typeof tint !== 'object') return '';
  const formula = typeof tint.cod_formula === 'string' ? tint.cod_formula : '';
  const color = typeof tint.color_code === 'string' ? tint.color_code : '';
  return `${color}|${formula}`;
};

const createOptimisticLine = ({
  variantId,
  productId,
  quantity,
  cart,
  optimistic,
}: {
  variantId: string;
  productId?: string;
  quantity: number;
  cart: HttpTypes.StoreCart | null;
  optimistic?: OptimisticLineOptions;
}) => {
  const now = new Date().toISOString();
  const unitPrice = optimistic?.unitPrice ?? 0;
  const title = optimistic?.title || 'Producto';
  const thumbnail = optimistic?.thumbnail || null;
  const productHandle = optimistic?.handle || '';

  return {
    id: `${OPTIMISTIC_LINE_PREFIX}-${variantId}-${Date.now()}`,
    title,
    product_title: title,
    product_id: productId,
    product_handle: productHandle,
    variant_id: variantId,
    thumbnail,
    quantity,
    unit_price: unitPrice,
    total: unitPrice * quantity,
    original_total: unitPrice * quantity,
    subtotal: unitPrice * quantity,
    created_at: now,
    updated_at: now,
    variant: {
      id: variantId,
      title,
      product: {
        id: productId,
        title,
        handle: productHandle,
        thumbnail,
        images: thumbnail ? [{ url: thumbnail }] : [],
      },
    },
    metadata: {
      optimistic: true,
    },
  } as unknown as HttpTypes.StoreCartLineItem;
};

const createOptimisticCart = (
  cart: HttpTypes.StoreCart | null,
  line: HttpTypes.StoreCartLineItem,
  countryCode: string
) =>
  ({
    ...(cart ?? {}),
    id: cart?.id ?? 'optimistic-cart',
    currency_code: cart?.currency_code ?? 'ars',
    region: cart?.region ?? {
      countries: [{ iso_2: countryCode }],
    },
    // Keep the items already in the cart and append the new optimistic line.
    // Replacing with just [line] dropped the existing items, so a cart with
    // 5 items briefly showed only the 1 just added until the server responded.
    items: [...(cart?.items ?? []), line],
  }) as HttpTypes.StoreCart;

const mergeServerCartWithPendingOptimisticItems = (
  serverCart: HttpTypes.StoreCart,
  currentCart: HttpTypes.StoreCart | null
) => {
  // La identidad de una línea es SIEMPRE el variant_id: matchear por product_id
  // mezclaría dos variantes distintas del mismo producto (misma card, distinta
  // presentación) en la misma línea. Las líneas optimistas ya llevan el
  // variant_id real, así que el match por variante reconcilia sin ambigüedad.
  const serverItems = (serverCart.items ?? []).map((serverItem) => {
    const currentMatch = currentCart?.items?.find(
      (item) => item.variant_id === serverItem.variant_id
    );

    if (currentMatch && currentMatch.quantity > serverItem.quantity) {
      return {
        ...serverItem,
        quantity: currentMatch.quantity,
      };
    }

    return serverItem;
  });
  const pendingOptimisticItems =
    currentCart?.items?.filter((item) => {
      if (!isOptimisticLine(item)) return false;
      return !serverItems.some(
        (serverItem) => serverItem.variant_id === item.variant_id
      );
    }) ?? [];

  if (!pendingOptimisticItems.length) {
    return {
      ...serverCart,
      items: serverItems,
    };
  }

  return {
    ...serverCart,
    items: [...serverItems, ...pendingOptimisticItems],
  };
};

// ============================================================================
// CONFIG
// ============================================================================

const QUANTITY_DEBOUNCE_MS = 500;

// ============================================================================
// SERIALIZACIÓN DE MUTACIONES
// ============================================================================

// add / update / remove mutan el MISMO carrito en el server. Disparadas en
// paralelo (clicks rápidos, agregar varios productos seguidos) las requests
// compiten: con el carrito aún sin crear, dos "add" concurrentes crean DOS
// carritos y se pierde un ítem; sobre un carrito existente, dos writes a Medusa
// a la vez pueden chocar y devolver error. Encolamos las llamadas de red para
// que corran de a una. La UI optimista NO se serializa (se aplica de inmediato
// antes de encolar), así el usuario ve el cambio al instante.
let cartMutationChain: Promise<unknown> = Promise.resolve();
function enqueueCartMutation<T>(task: () => Promise<T>): Promise<T> {
  const result = cartMutationChain.then(task, task);
  // La cadena sigue viva pase lo que pase con cada tarea (éxito o error).
  cartMutationChain = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

// ============================================================================
// VERSIONADO OPTIMISTA (anti-clobber por respuestas fuera de orden)
// ============================================================================

// El backend es lento y cada op dispara varios fetches; las respuestas llegan
// fuera de orden. Una respuesta vieja (con una línea en su cantidad previa)
// hacía `set({ cart })` y PISABA la cantidad optimista recién editada → la
// cantidad "bajaba a 1 y tardaba en volver". Contador monotónico: cada cambio
// optimista lo incrementa; una respuesta del server solo aplica si NO hubo un
// cambio más nuevo desde que salió su request (si lo hubo, se descarta y gana
// el estado optimista; la respuesta del último cambio, ya sin nada más nuevo,
// aplica y deja totales correctos).
let cartOptimisticVersion = 0;
const bumpCartOptimisticVersion = (): number => (cartOptimisticVersion += 1);

// ============================================================================
// STORE
// ============================================================================

export const useCartStore = create<CartStore>()(
  subscribeWithSelector((set, get) => ({
    // Estado inicial
    cart: null,
    isOpen: false,
    isLoading: false,
    isHydrated: false,
    error: null,
    pendingQuantityUpdates: new Map(),
    pendingAdditions: new Set(),
    quantityDebounceTimers: new Map(),

    // ========================================================================
    // HYDRATION
    // ========================================================================

    setCart: (cart) => set({ cart }),

    hydrate: (cart) => set({ cart, isHydrated: true }),

    // ========================================================================
    // DRAWER
    // ========================================================================

    openCart: () => {
      const state = get();
      console.log('[CART] Cart opened');
      console.log('[CART] Items in cart:', state.cart?.items || []);
      console.log(
        '[CART] Total items:',
        state.cart?.items?.reduce((sum, item) => sum + item.quantity, 0) ?? 0
      );
      console.log('[CART] Cart subtotal:', state.cart?.subtotal);
      set({ isOpen: true });
    },
    closeCart: () => set({ isOpen: false }),
    toggleCart: () => set((state) => ({ isOpen: !state.isOpen })),

    // ========================================================================
    // LOADING/ERROR
    // ========================================================================

    setLoading: (isLoading) => set({ isLoading }),
    setError: (error) => set({ error }),

    // ========================================================================
    // FETCH CART
    // ========================================================================

    fetchCart: async () => {
      console.log('[CART] Fetching cart from server');
      const version = cartOptimisticVersion;
      set({ isLoading: true, error: null });

      try {
        const response = await fetch('/api/store/cart');
        const data = await response.json();
        const incoming = data?.cart;
        const hasValidCart = Boolean(
          incoming &&
            typeof incoming === 'object' &&
            (incoming as { id?: string }).id
        );

        // Si hubo un cambio optimista mientras se leía, NO pisar el carrito con
        // esta respuesta (sería vieja): dejamos el estado optimista intacto.
        if (cartOptimisticVersion !== version) {
          set({ isLoading: false, isHydrated: true });
        } else if (hasValidCart) {
          set({
            cart: keepPendingOptimisticLines(incoming, get().cart, get().pendingAdditions),
            isLoading: false,
            isHydrated: true,
          });
        } else if (get().pendingAdditions.size > 0) {
          // Hay un "add" en vuelo: el carrito todavía no se persistió en el
          // server, así que un `{}` vacío NO significa "carrito vacío". Pisarlo
          // borraría el estado optimista y el usuario perdería el carrito.
          set({ isLoading: false });
        } else {
          set({ cart: incoming ?? null, isLoading: false, isHydrated: true });
        }
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Error fetching cart',
          isLoading: false,
        });
      }
    },

    // ========================================================================
    // ADD ITEM (Optimistic)
    // ========================================================================

    addItem: async (variantId, quantity, countryCode, productId, metadata, optimistic) => {
      const { cart, pendingAdditions } = get();
      console.log(
        '[CART] Adding item - variantId:',
        variantId,
        'quantity:',
        quantity,
        'productId:',
        productId
      );

      // Feedback háptico sutil al confirmar "agregar al carrito" (móvil).
      triggerHaptic('light');

      // Mark as pending
      const newPending = new Set(pendingAdditions);
      newPending.add(variantId);

      const currentItems = cart?.items ?? [];
      // Solo se acumula sobre una línea existente si es la MISMA variante Y el
      // MISMO entonado. Dos variantes del mismo producto son líneas distintas
      // (identidad = variant_id), y dos colores sobre la misma base también: el
      // backend mergea comparando la metadata completa, así que si acá se
      // dedupara sólo por variante, dos colores se colapsarían en el optimista y
      // saltarían a dos líneas al responder el server.
      const addedTint = tintSignatureOf(metadata);
      const existingLine = currentItems.find(
        (item) =>
          item.variant_id === variantId &&
          tintSignatureOf(item.metadata as Record<string, unknown> | null | undefined) === addedTint
      );
      const optimisticLine = existingLine
        ? null
        : createOptimisticLine({
            variantId,
            productId,
            quantity,
            cart,
            optimistic,
          });
      const optimisticCart = existingLine
        ? ({
            ...cart,
            items: currentItems.map((item) =>
              item.id === existingLine.id
                ? {
                    ...item,
                    quantity: item.quantity + quantity,
                    total:
                      typeof item.total === 'number'
                        ? item.total + (item.unit_price ?? 0) * quantity
                        : item.total,
                    original_total:
                      typeof item.original_total === 'number'
                        ? item.original_total + (item.unit_price ?? 0) * quantity
                        : item.original_total,
                    subtotal:
                      typeof item.subtotal === 'number'
                        ? item.subtotal + (item.unit_price ?? 0) * quantity
                        : item.subtotal,
                  }
                : item
            ),
          } as HttpTypes.StoreCart)
        : createOptimisticCart(cart, optimisticLine!, countryCode);

      set({
        cart: optimisticCart,
        pendingAdditions: newPending,
        error: null,
      });
      bumpCartOptimisticVersion();

      // La red se serializa (la UI optimista ya se aplicó arriba).
      return enqueueCartMutation(async () => {
      try {
        const response = await fetch('/api/store/cart', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'add',
            variantId,
            quantity,
            countryCode,
            productId,
            ...(metadata ? { metadata } : {}),
          }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || 'Failed to add item');
        }

        // Update cart with server response
        const localCartBeforeMerge = get().cart;
        const mergedCart = mergeServerCartWithPendingOptimisticItems(
          data.cart,
          localCartBeforeMerge
        );

        // ¿El usuario sacó la línea mientras el add estaba en vuelo? Esa baja
        // apuntó al id OPTIMISTA (`optimistic-line-…`), que el server no
        // conoce, así que nunca se sincronizó — y el merge de acá arriba la
        // trae de vuelta desde el server. El producto reaparecía después de
        // tirarlo al tacho.
        //
        // Ahora que tenemos el id real, aplicamos la baja y la sacamos ya de la
        // UI para que no parpadee de vuelta.
        //
        // La baja tiene que estar REGISTRADA (ver removedWhilePendingVariantIds):
        // que la variante no esté en el carrito local no alcanza como prueba.
        // Si el usuario la volvió a agregar después de sacarla, está de nuevo en
        // el carrito y no se borra.
        const removedWhileAdding =
          removedWhilePendingVariantIds.has(variantId) &&
          !localCartBeforeMerge?.items?.some(
            (item) => item.variant_id === variantId
          );
        const serverLineForVariant = (
          (data.cart?.items ?? []) as HttpTypes.StoreCartLineItem[]
        ).find((item) => item.variant_id === variantId);

        if (removedWhileAdding && serverLineForVariant) {
          set({
            cart: {
              ...mergedCart,
              items: mergedCart.items?.filter(
                (item) => item.variant_id !== variantId
              ),
            },
          });
          void get()._syncQuantityToServer(
            serverLineForVariant.id,
            0,
            bumpCartOptimisticVersion()
          );
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('cart-updated'));
          }
          return true;
        }

        set({ cart: mergedCart });

        // Si el usuario subió la cantidad mientras el add estaba en vuelo, el
        // merge dejó la cantidad optimista (mayor) en la UI, pero el server quedó
        // en la cantidad original. La línea optimista no se pudo sincronizar
        // (ver _syncQuantityToServer), así que reconciliamos ahora con el id REAL.
        const serverLine = (
          (data.cart?.items ?? []) as HttpTypes.StoreCartLineItem[]
        ).find((item) => item.variant_id === variantId);
        const mergedLine = mergedCart.items?.find(
          (item) => item.variant_id === variantId
        );
        if (
          serverLine &&
          mergedLine &&
          !isOptimisticLine(mergedLine) &&
          mergedLine.quantity > serverLine.quantity
        ) {
          // El carrito del server viene enriquecido con el stock real por
          // variante, así que ACÁ recién sabemos el techo de una línea que hasta
          // hace un instante era optimista. Si los increments encolados durante
          // el add se pasaron, sincronizamos el TECHO en vez de la cantidad
          // pedida: el burst termina en el máximo disponible en lugar de rebotar
          // al inicial por un rechazo de inventario.
          const clamped = clampToStock(
            mergedLine.quantity,
            getLineItemMaxQuantity(serverLine)
          );
          // Sincronizamos también cuando el techo coincide con lo que el server
          // ya tiene: el request es idempotente y su respuesta reemplaza el
          // carrito completo, corrigiendo la cantidad optimista de más y los
          // totales que se habían inflado con ella.
          void get()._syncQuantityToServer(
            serverLine.id,
            clamped,
            cartOptimisticVersion
          );
        }

        // Dispatch event for other components
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('cart-updated'));
        }

        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Error adding item';
        set({ error: message });
        const latestCart = get().cart;
        const rollbackItems = latestCart?.items
          ?.map((item) => {
            if (optimisticLine && item.id === optimisticLine.id) {
              return null;
            }
            if (existingLine && item.id === existingLine.id) {
              return {
                ...item,
                quantity: Math.max(0, item.quantity - quantity),
                total:
                  typeof item.total === 'number'
                    ? Math.max(0, item.total - (item.unit_price ?? 0) * quantity)
                    : item.total,
                original_total:
                  typeof item.original_total === 'number'
                    ? Math.max(0, item.original_total - (item.unit_price ?? 0) * quantity)
                    : item.original_total,
                subtotal:
                  typeof item.subtotal === 'number'
                    ? Math.max(0, item.subtotal - (item.unit_price ?? 0) * quantity)
                    : item.subtotal,
              };
            }
            return item;
          })
          .filter((item): item is HttpTypes.StoreCartLineItem =>
            Boolean(item && item.quantity > 0)
          );

        if (latestCart && rollbackItems) {
          set({
            cart:
              !cart && rollbackItems.length === 0
                ? null
                : {
                    ...latestCart,
                    items: rollbackItems,
                  },
          });
        }
        toast.error('No se pudo agregar al carrito', {
          description:
            'Este producto no está disponible en este momento. Intentá de nuevo más tarde.',
          duration: 4000,
        });
        return false;
      } finally {
        removedWhilePendingVariantIds.delete(variantId);
        // Remove from pending
        const currentPending = get().pendingAdditions;
        const updatedPending = new Set(currentPending);
        updatedPending.delete(variantId);
        set({ pendingAdditions: updatedPending });
      }
      });
    },

    setPendingAdditionQuantity: (variantId, _productId, quantity) => {
      const { cart, pendingAdditions } = get();
      if (!cart || !pendingAdditions.has(variantId)) {
        return;
      }

      // Mismo techo que el resto de los steppers. Durante un add-desde-cero la
      // línea es optimista (sin variante enriquecida) y el techo es desconocido:
      // ahí no clampeamos y la reconciliación de `addItem` corrige con el stock
      // real que devuelve el server.
      const matchedLine = cart.items?.find((item) => item.variant_id === variantId);
      const nextQuantity = clampToStock(quantity, getLineItemMaxQuantity(matchedLine));
      let amountDelta = 0;
      const items = cart.items?.map((item) => {
        // Identidad por variante: no tocar otras presentaciones del mismo producto.
        const isMatch = item.variant_id === variantId;
        if (!isMatch) {
          return item;
        }

        const unitPrice = item.unit_price ?? 0;
        amountDelta = (nextQuantity - item.quantity) * unitPrice;
        return {
          ...item,
          quantity: nextQuantity,
          total: unitPrice * nextQuantity,
          original_total: unitPrice * nextQuantity,
          subtotal: unitPrice * nextQuantity,
        };
      });

      set({
        cart: {
          ...cart,
          subtotal:
            typeof cart.subtotal === 'number'
              ? Math.max(0, cart.subtotal + amountDelta)
              : cart.subtotal,
          total:
            typeof cart.total === 'number' ? Math.max(0, cart.total + amountDelta) : cart.total,
          item_total:
            typeof cart.item_total === 'number'
              ? Math.max(0, cart.item_total + amountDelta)
              : cart.item_total,
          original_total:
            typeof cart.original_total === 'number'
              ? Math.max(0, cart.original_total + amountDelta)
              : cart.original_total,
          original_item_total:
            typeof cart.original_item_total === 'number'
              ? Math.max(0, cart.original_item_total + amountDelta)
              : cart.original_item_total,
          items,
        },
      });
      bumpCartOptimisticVersion();
    },

    // ========================================================================
    // UPDATE QUANTITY (Optimistic + Debounced)
    // ========================================================================

    updateQuantity: (lineId, quantity) => {
      const { cart, pendingQuantityUpdates, quantityDebounceTimers, _syncQuantityToServer } = get();

      if (!cart) return;

      // TECHO DE STOCK. El sync al server está debounceado, así que N clicks
      // rápidos colapsan en UN request con la cantidad FINAL. Si esa cantidad se
      // pasa del stock, Medusa la rechaza y el rollback (`fetchCart`) devuelve la
      // última cantidad SINCRONIZADA — que en un burst es la de antes del burst
      // (típicamente 1), no el máximo. Clickear de a uno "funcionaba" solo porque
      // cada paso se sincronizaba y el que fallaba era el que pasaba el techo.
      //
      // Clampeamos acá, que es el único camino por el que pasan todos los
      // steppers (cards, PDP, minicarrito, entonado), así ningún componente
      // puede volver a mandar una cantidad imposible.
      const line = cart.items?.find((item) => item.id === lineId);
      const target =
        quantity <= 0 ? quantity : clampToStock(quantity, getLineItemMaxQuantity(line));
      if (target <= 0) markOptimisticLineRemoved(line);

      console.log('[CART] Updating quantity - lineId:', lineId, 'new quantity:', target);

      // Cancel existing timer
      const existingTimer = quantityDebounceTimers.get(lineId);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // Optimistic update immediately
      const newPendingUpdates = new Map(pendingQuantityUpdates);
      newPendingUpdates.set(lineId, target);

      const optimisticCart = {
        ...cart,
        items:
          target <= 0
            ? cart.items?.filter((item) => item.id !== lineId)
            : cart.items?.map((item) =>
                item.id === lineId ? { ...item, quantity: target } : item
              ),
      };

      set({
        cart: optimisticCart,
        pendingQuantityUpdates: newPendingUpdates,
        error: null,
      });
      // Versión de ESTE cambio: el sync solo aplicará su respuesta si sigue
      // siendo la última (sin cambios más nuevos), para no parpadear.
      const version = bumpCartOptimisticVersion();

      // Debounce server sync
      const timer = setTimeout(() => {
        _syncQuantityToServer(lineId, target, version);
      }, QUANTITY_DEBOUNCE_MS);

      const newTimers = new Map(quantityDebounceTimers);
      newTimers.set(lineId, timer);
      set({ quantityDebounceTimers: newTimers });
    },

    // ========================================================================
    // CHANGE QUANTITY (relativo, inmune a closures viejas)
    // ========================================================================

    // Los steppers +/- pasan un delta en vez de una cantidad absoluta calculada
    // en el render (que queda vieja entre clicks rápidos o durante la animación
    // de la card). Acá leemos la cantidad ACTUAL del store, así N clicks suman N.
    // Mínimo 1: los steppers nunca eliminan la línea (eso es una acción
    // explícita — botón de tacho / quitar), por eso un "-" rápido no la deja en 0.
    // El techo de stock lo pone `updateQuantity` (un solo lugar para todos los
    // steppers), así que acá solo cuidamos el piso.
    changeItemQuantity: (lineId, delta) => {
      const { cart, updateQuantity } = get();
      const item = cart?.items?.find((i) => i.id === lineId);
      if (!item) return;
      updateQuantity(lineId, Math.max(1, item.quantity + delta));
    },

    // ========================================================================
    // SYNC TO SERVER (Internal)
    // ========================================================================

    _syncQuantityToServer: async (lineId, quantity, version) => {
      const { _clearPendingUpdate, fetchCart } = get();

      // Una línea optimista todavía no existe en el server (el "add" que la crea
      // puede seguir en vuelo). Mandar su id provoca "No cart found" y el rollback
      // borra el carrito. No la sincronizamos: addItem reconcilia la cantidad con
      // el id REAL en cuanto el add resuelve.
      if (lineId.startsWith(OPTIMISTIC_LINE_PREFIX)) {
        _clearPendingUpdate(lineId);
        return;
      }

      return enqueueCartMutation(async () => {
      try {
        const action = quantity <= 0 ? 'delete' : 'update';
        const body = quantity <= 0 ? { action, lineId } : { action, lineId, quantity };

        const response = await fetch('/api/store/cart', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || 'Failed to update quantity');
        }

        // Solo aplicamos la respuesta si NO hubo un cambio optimista más nuevo
        // desde que salió este sync. Si lo hubo, esta respuesta ya es vieja y
        // pisaría la cantidad recién editada (el parpadeo a 1): la descartamos y
        // el sync del último cambio dejará el estado correcto.
        if (version === undefined || cartOptimisticVersion === version) {
          set({
            cart: keepPendingOptimisticLines(data.cart, get().cart, get().pendingAdditions),
          });
        }

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('cart-updated'));
        }
      } catch (error) {
        // Rollback: re-fetch cart
        await fetchCart();
        set({
          error: error instanceof Error ? error.message : 'Error updating quantity',
        });
        // Sin aviso, el rollback se veía como un número que salta solo y parecía
        // un bug de la UI. Con el clamp esto ya no debería dispararse por stock,
        // pero sigue siendo el camino cuando el inventario cambió entre medio.
        toast.error('No se pudo actualizar la cantidad', {
          description: 'Puede que no haya stock suficiente. Revisá el carrito.',
          duration: 4000,
        });
      } finally {
        _clearPendingUpdate(lineId);
      }
      });
    },

    _clearPendingUpdate: (lineId) => {
      const { pendingQuantityUpdates, quantityDebounceTimers } = get();

      const newPending = new Map(pendingQuantityUpdates);
      newPending.delete(lineId);

      const newTimers = new Map(quantityDebounceTimers);
      newTimers.delete(lineId);

      set({
        pendingQuantityUpdates: newPending,
        quantityDebounceTimers: newTimers,
      });
    },

    // ========================================================================
    // REMOVE ITEM (Optimistic)
    // ========================================================================

    removeItem: async (lineId) => {
      const { cart, fetchCart } = get();
      console.log('[CART] Removing item - lineId:', lineId);

      if (!cart) return false;

      // Optimistic removal
      const optimisticCart = {
        ...cart,
        items: cart.items?.filter((item) => item.id !== lineId),
      };
      set({ cart: optimisticCart, error: null });
      const version = bumpCartOptimisticVersion();

      // Una línea optimista todavía no existe en el server: mandar su id
      // fallaba, y el rollback (`fetchCart`) pisaba el resto de las líneas en
      // cola. Registramos la baja y la aplica `addItem` con el id REAL.
      if (isOptimisticLineId(lineId)) {
        markOptimisticLineRemoved(cart.items?.find((item) => item.id === lineId));
        return true;
      }

      return enqueueCartMutation(async () => {
      try {
        const response = await fetch('/api/store/cart', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete', lineId }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || 'Failed to remove item');
        }

        // No pisar si hubo un cambio optimista más nuevo (evita el parpadeo).
        if (cartOptimisticVersion === version) {
          set({
            cart: keepPendingOptimisticLines(data.cart, get().cart, get().pendingAdditions),
          });
        }

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('cart-updated'));
        }

        return true;
      } catch (error) {
        // Rollback
        await fetchCart();
        set({
          error: error instanceof Error ? error.message : 'Error removing item',
        });
        return false;
      }
      });
    },

    removeBundleInstance: async (bundleInstanceId) => {
      const { cart, fetchCart } = get();
      if (!cart) return false;

      // Optimista: desaparecen todas las líneas del kit de una, igual que van
      // a desaparecer en el servidor.
      const optimisticCart = {
        ...cart,
        items: cart.items?.filter(
          (item) =>
            (item.metadata as Record<string, unknown> | null | undefined)
              ?.bundle_instance_id !== bundleInstanceId,
        ),
      };
      set({ cart: optimisticCart, error: null });
      const version = bumpCartOptimisticVersion();

      return enqueueCartMutation(async () => {
        try {
          const response = await fetch('/api/store/cart', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'deleteBundle', bundleInstanceId }),
          });

          const data = await response.json();

          if (!response.ok || !data.success) {
            throw new Error(data.message || 'Failed to remove bundle');
          }

          if (cartOptimisticVersion === version) {
            set({ cart: data.cart });
          }

          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('cart-updated'));
          }

          return true;
        } catch (error) {
          await fetchCart();
          set({
            error: error instanceof Error ? error.message : 'Error removing bundle',
          });
          return false;
        }
      });
    },

    // ========================================================================
    // HELPERS
    // ========================================================================

    getItemByVariantId: (variantId) => {
      const { cart } = get();
      return cart?.items?.find((item) => item.variant_id === variantId);
    },

    isAddingItem: (variantId) => {
      const { pendingAdditions } = get();
      return pendingAdditions.has(variantId);
    },

    // ========================================================================
    // COMPUTED
    // ========================================================================

    itemCount: () => {
      const { cart } = get();
      return cart?.items?.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
    },

    subtotal: () => {
      const { cart } = get();
      return cart?.subtotal ?? 0;
    },

    // ========================================================================
    // RESET
    // ========================================================================

    clearCart: () => {
      const { quantityDebounceTimers } = get();
      quantityDebounceTimers.forEach((timer) => clearTimeout(timer));

      set({
        cart: null,
        isLoading: false,
        error: null,
        pendingQuantityUpdates: new Map(),
        pendingAdditions: new Set(),
        quantityDebounceTimers: new Map(),
      });
    },
  }))
);

// ============================================================================
// SELECTORS
// ============================================================================

export const selectCart = (state: CartStore) => state.cart;
export const selectCartItems = (state: CartStore) => state.cart?.items || [];
export const selectTotalItems = (state: CartStore) =>
  state.cart?.items?.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
export const selectIsOpen = (state: CartStore) => state.isOpen;
export const selectIsLoading = (state: CartStore) => state.isLoading;
export const selectError = (state: CartStore) => state.error;
