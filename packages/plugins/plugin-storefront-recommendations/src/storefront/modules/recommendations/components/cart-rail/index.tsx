'use client';

import { useStorefrontShared } from '@minimalart/mercatto-storefront-shared/provider';
import type { HttpTypes } from '@medusajs/types';
import { useEffect, useMemo, useState, type ComponentType } from 'react';
import RecommendationCarousel from '../recommendation-carousel';
import { useRecommendations } from '../../hooks/use-recommendations';
import type { RecommendationContext, RecommendationPlacement } from '../../types';

/**
 * Rail de recomendaciones para el carrito y el drawer.
 *
 * Client-side porque el carrito es autoritativamente client-side. Hidrata los productos
 * por el BFF que ya existe (`/api/store/products?productsIds=`), igual que el rail de
 * vistos recientemente.
 *
 * Filtra los productos del carrito de la RESPUESTA además de que el motor ya los excluye:
 * el carrito puede cambiar entre el momento del pedido y el del render, y mostrar algo
 * que el usuario acaba de agregar es exactamente lo que el PRD §9.3 pide evitar.
 */

type CartItemLike = { product_id?: string | null };
type CartStoreShape = { cart: { id?: string | null; items?: CartItemLike[] } | null };

export default function CartRail({
  placement,
  title,
  countryCode,
  region,
  context,
  limit,
  skip = false,
  debounceMs,
  headingId,
  CardComponent,
}: {
  placement: RecommendationPlacement;
  title: string;
  countryCode: string;
  region: HttpTypes.StoreRegion;
  context?: RecommendationContext;
  limit?: number;
  skip?: boolean;
  debounceMs?: number;
  headingId?: string;
  CardComponent: ComponentType<{
    product: HttpTypes.StoreProduct;
    region: HttpTypes.StoreRegion;
  }>;
}) {
  const { cartStore } = useStorefrontShared();
  const cart = cartStore.useCartStore(
    (state: unknown) => (state as CartStoreShape).cart,
  );
  const cartProductIds = useMemo(
    () =>
      new Set(
        (cart?.items ?? [])
          .map((item) => item.product_id)
          .filter(Boolean) as string[],
      ),
    [cart?.items],
  );

  const { data } = useRecommendations({
    placement,
    cartId: cart?.id ?? null,
    limit,
    context,
    countryCode,
    skip: skip || !cart?.id,
    debounceMs,
  });

  const [products, setProducts] = useState<HttpTypes.StoreProduct[]>([]);
  const ids = useMemo(
    () =>
      data.products
        .map((item) => item.product_id)
        .filter((id) => !cartProductIds.has(id)),
    [data.products, cartProductIds],
  );
  const idsKey = ids.join(',');

  useEffect(() => {
    if (!ids.length) {
      setProducts([]);
      return;
    }
    const controller = new AbortController();
    const params = new URLSearchParams({ countryCode, limit: String(ids.length) });
    for (const id of ids) params.append('productsIds', id);

    fetch(`/api/store/products?${params.toString()}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { products?: HttpTypes.StoreProduct[] } | null) => {
        const fetched = payload?.products ?? [];
        // Se reordena al ranking del motor: el repositorio no garantiza el orden.
        const byId = new Map(fetched.map((product) => [product.id, product]));
        setProducts(ids.map((id) => byId.get(id)).filter(Boolean) as HttpTypes.StoreProduct[]);
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, [idsKey, countryCode]);

  if (!products.length) return null;

  return (
    <RecommendationCarousel
      headingId={headingId}
      products={products}
      region={region}
      requestId={data.request_id}
      title={title}
      CardComponent={CardComponent}
    />
  );
}
