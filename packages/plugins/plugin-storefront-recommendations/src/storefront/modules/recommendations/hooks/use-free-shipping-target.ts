'use client';

import {
  deriveFreeShippingTarget,
  type FreeShippingTarget,
} from '@minimalart/mercatto-storefront-shared/util/free-shipping-target';
import { useStorefrontShared } from '@minimalart/mercatto-storefront-shared/provider';
import type { HttpTypes } from '@medusajs/types';
import { useEffect, useState } from 'react';

/**
 * Umbral de envío gratis para el carrito vivo.
 *
 * En la página de carrito las shipping options llegan por prop (el server ya las tiene,
 * así no hay spinner ni round trip extra). En el drawer no hay prop, así que se piden al
 * BFF que YA existe (`/api/store/shipping-options?cart_id=`) y se memoizan a nivel
 * módulo por id de carrito: abrir y cerrar el drawer no debe refetchear.
 */

const cache = new Map<string, HttpTypes.StoreCartShippingOption[]>();
const inFlight = new Map<string, Promise<HttpTypes.StoreCartShippingOption[]>>();

/** Sólo para tests. */
export const __resetShippingOptionsCache = (): void => {
  cache.clear();
  inFlight.clear();
};

async function loadShippingOptions(
  cartId: string,
): Promise<HttpTypes.StoreCartShippingOption[]> {
  const cached = cache.get(cartId);
  if (cached) return cached;

  const pending = inFlight.get(cartId);
  if (pending) return pending;

  const promise = fetch(`/api/store/shipping-options?cart_id=${encodeURIComponent(cartId)}`)
    .then((response) => (response.ok ? response.json() : null))
    .then((payload: { shipping_options?: HttpTypes.StoreCartShippingOption[] } | null) => {
      const options = payload?.shipping_options ?? [];
      cache.set(cartId, options);
      return options;
    })
    .catch(() => [] as HttpTypes.StoreCartShippingOption[])
    .finally(() => {
      inFlight.delete(cartId);
    });

  inFlight.set(cartId, promise);
  return promise;
}

/** Shape mínimo del cart store que este hook lee. El host implementa el port completo. */
type CartStoreShape = { cart: HttpTypes.StoreCart | null };

export function useFreeShippingTarget(
  shippingOptions?: HttpTypes.StoreCartShippingOption[] | null,
): { cart: HttpTypes.StoreCart | null; target: FreeShippingTarget | null } {
  const { cartStore } = useStorefrontShared();
  const cart = cartStore.useCartStore(
    (state: unknown) => (state as CartStoreShape).cart,
  );
  const [fetched, setFetched] = useState<HttpTypes.StoreCartShippingOption[] | null>(null);

  const hasProvided = Boolean(shippingOptions?.length);
  const cartId = cart?.id ?? null;

  useEffect(() => {
    if (hasProvided || !cartId) return;
    let active = true;
    loadShippingOptions(cartId).then((options) => {
      if (active) setFetched(options);
    });
    return () => {
      active = false;
    };
  }, [cartId, hasProvided]);

  const options = hasProvided ? shippingOptions : fetched;

  return {
    cart: (cart as HttpTypes.StoreCart | null) ?? null,
    // `deriveFreeShippingTarget` devuelve null cuando la tienda no tiene envío gratis
    // condicionado por `item_total`: la barra y los bridge products no se muestran, en
    // lugar de inventar un umbral (PRD §17).
    target: deriveFreeShippingTarget(cart as HttpTypes.StoreCart | null, options),
  };
}
