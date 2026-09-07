'use client';

import { useAddToCartAnimation } from '@lib/context/add-to-cart-animation';
import { useCartStore } from '@lib/stores/cart.store';
import type { TypesenseProductDocument } from '@lib/typesense';
import { getIndividualVariantIdFromDoc } from '@lib/util/card-variant';
import {
  canIncrementQuantity,
  getLineItemMaxQuantity,
} from '@lib/util/max-purchasable-quantity';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type CartProduct = TypesenseProductDocument;

type CartQuantityOptions = {
  openCartOnAdd?: boolean;
};

export function useCartQuantityForVariant(
  product: CartProduct,
  countryCode: string,
  options: CartQuantityOptions = {}
) {
  const addItem = useCartStore((s) => s.addItem);
  const openCart = useCartStore((s) => s.openCart);
  const setPendingAdditionQuantity = useCartStore((s) => s.setPendingAdditionQuantity);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const changeItemQuantity = useCartStore((s) => s.changeItemQuantity);
  const cart = useCartStore((s) => s.cart);
  const pendingAdditions = useCartStore((s) => s.pendingAdditions);
  const pendingQuantityUpdates = useCartStore((s) => s.pendingQuantityUpdates);
  const { triggerAnimation } = useAddToCartAnimation();

  const buttonRef = useRef<HTMLDivElement>(null);
  const queuedIncrements = useRef(0);
  const [, forceRender] = useState(0);

  // Siempre la variante Individual del documento (nunca `variants[0]` a ciegas,
  // que podía ser la de Bulto según el orden del índice).
  const variantId = useMemo(
    () => getIndividualVariantIdFromDoc(product),
    [product]
  );

  const cartItems = cart?.items;
  const lineItem = useMemo(() => {
    if (!cartItems) return null;
    if (variantId) {
      const exactMatch = cartItems.find((item) => item.variant_id === variantId);
      if (exactMatch) return exactMatch;
    }
    // Fallback por producto SOLO cuando hay una única línea de este producto en
    // el carrito: así toleramos ids de variante viejos de Typesense sin arriesgar
    // mezclar dos variantes distintas del mismo producto (la identidad real es el
    // variant_id). Con 2+ líneas del mismo producto no adivinamos.
    const sameProduct = cartItems.filter((item) => item.product_id === product.id);
    return sameProduct.length === 1 ? sameProduct[0] : null;
  }, [cartItems, variantId, product.id]);

  const isAdding = variantId ? pendingAdditions.has(variantId) : false;
  const isUpdating = lineItem ? pendingQuantityUpdates.has(lineItem.id) : false;
  const isLoading = isAdding || isUpdating;

  useEffect(() => {
    if (lineItem && !isAdding && queuedIncrements.current > 0) {
      queuedIncrements.current = 0;
      updateQuantity(lineItem.id, lineItem.quantity);
    }
  }, [isAdding, lineItem, updateQuantity]);

  // Optimistic: show quantity including queued increments while add is in progress
  const quantity =
    (lineItem?.quantity ?? (isAdding ? 1 : 0)) +
    (isAdding && !lineItem ? queuedIncrements.current : 0);

  // Techo real de la variante. La línea del carrito viene enriquecida con el
  // stock por variante desde el server, así que una vez que el producto está en
  // el carrito este número es verdad — no el `stock_available` del índice, que
  // es la suma de TODAS las variantes del producto y no sirve como techo.
  // `null` = techo desconocido (no gestiona inventario / admite backorder).
  const maxQuantity = getLineItemMaxQuantity(lineItem);
  const canIncrement = canIncrementQuantity(quantity, maxQuantity);

  const handleIncrement = useCallback(async () => {
    if (!variantId) {
      return;
    }

    // Ya estamos en el techo: no encolamos un increment que el server va a
    // rechazar. Antes se encolaban todos, el debounce mandaba UNA sola cantidad
    // imposible, y el rollback devolvía la cantidad previa al burst (1) en vez
    // de dejar el máximo disponible.
    if (!canIncrement) {
      return;
    }

    // Queue increments while initial add is in-flight. Leemos la cantidad ACTUAL
    // del store (no la `quantity` del render, que queda vieja entre clicks
    // rápidos) para no perder incrementos mientras el add está en vuelo.
    if (isAdding) {
      queuedIncrements.current += 1;
      const current =
        useCartStore
          .getState()
          .cart?.items?.find((i) => i.variant_id === variantId)?.quantity ??
        quantity;
      setPendingAdditionQuantity(variantId, product.id, current + 1);
      forceRender((n) => n + 1);
      return;
    }

    if (quantity === 0) {
      queuedIncrements.current = 0;
      const variant =
        product.variants?.find((v) => v.id === variantId) ?? product.variants?.[0];
      // La animación se dispara en el click, NO después del await: el carrito ya
      // es optimista, así que esperar la red solo agregaba el retardo del
      // round-trip (más la cola de mutaciones) antes de que la imagen despegue.
      if (buttonRef.current) {
        const thumbnail = product.thumbnail || product.images?.[0]?.url;
        triggerAnimation(buttonRef.current, thumbnail);
      }
      const success = await addItem(variantId, 1, countryCode, product.id, undefined, {
        title: product.title,
        handle: product.handle,
        thumbnail: product.thumbnail || product.images?.[0]?.url,
        unitPrice:
          variant?.calculated_price?.calculated_amount ?? product.subtotal ?? product.price,
        currencyCode: variant?.calculated_price?.currency_code,
      });
      if (success && options.openCartOnAdd) {
        openCart();
      }
    } else if (lineItem) {
      // Delta relativo: inmune a una `quantity` vieja del render / animación.
      changeItemQuantity(lineItem.id, 1);
      if (options.openCartOnAdd) {
        openCart();
      }
    }
  }, [
    variantId,
    quantity,
    lineItem,
    product,
    triggerAnimation,
    addItem,
    changeItemQuantity,
    setPendingAdditionQuantity,
    countryCode,
    isAdding,
    openCart,
    options.openCartOnAdd,
    canIncrement,
  ]);

  const handleDecrement = useCallback(() => {
    // Reduce queued increments if add is still in-flight
    if (isAdding && queuedIncrements.current > 0) {
      queuedIncrements.current -= 1;
      if (variantId) {
        const current =
          useCartStore
            .getState()
            .cart?.items?.find((i) => i.variant_id === variantId)?.quantity ??
          quantity;
        setPendingAdditionQuantity(variantId, product.id, current - 1);
      }
      forceRender((n) => n + 1);
      return;
    }
    if (!lineItem) {
      return;
    }
    // Delta relativo con mínimo 1 (el "-" nunca elimina: eso es el tacho).
    changeItemQuantity(lineItem.id, -1);
  }, [
    lineItem,
    quantity,
    changeItemQuantity,
    isAdding,
    variantId,
    product.id,
    setPendingAdditionQuantity,
  ]);

  const handleRemove = useCallback(() => {
    if (isAdding) {
      queuedIncrements.current = 0;
      forceRender((n) => n + 1);
      return;
    }
    if (!lineItem) {
      return;
    }
    updateQuantity(lineItem.id, 0);
  }, [lineItem, updateQuantity, isAdding]);

  return {
    variantId,
    quantity,
    isLoading,
    /** Techo de stock de la variante; `null` cuando no hay techo conocido. */
    maxQuantity,
    /** `false` cuando la cantidad en carrito ya llegó al stock disponible. */
    canIncrement,
    canAdd: Boolean(variantId),
    handleIncrement,
    handleDecrement,
    handleRemove,
    buttonRef,
  };
}
