'use client';

import { useRecentlyViewedStore } from '@minimalart/mercatto-storefront-shared/stores/recently-viewed';
import type { HttpTypes } from '@medusajs/types';
import { useEffect, useMemo, useState, type ComponentType } from 'react';
import RecommendationCarousel from '../recommendation-carousel';
import { useRecommendations } from '../../hooks/use-recommendations';

/** Tope del `context.product_ids` que acepta la ruta store: mandar más es un 400. */
const MAX_CONTEXT_IDS = 60;

/**
 * Rail de vistos recientemente.
 *
 * Los ids salen de localStorage, pero el rail PASA POR EL MOTOR: se mandan como
 * `context.product_ids` y el motor aplica los filtros operativos (stock, canal,
 * publicado) y respeta el `result_limit` que el merchant configuró en el placement
 * `recently-viewed`. Sin esto, el placement existía en el backoffice pero su toggle y
 * sus límites no hacían nada y el rail mostraba productos sin stock.
 *
 * Los productos se hidratan igual que en `cart-rail` por el BFF que ya existe
 * (`/api/store/products`, que acepta `productsIds` repetido): el motor devuelve una
 * proyección liviana y la tarjeta necesita variantes y precios completos de ahora.
 *
 * Ahora que viene del motor SÍ hay `request_id`, así que el rail entra al embudo como
 * cualquier otro (antes se pasaba `null` a propósito porque no había request).
 */
export default function RecentlyViewed({
  region,
  countryCode,
  currentProductId,
  title = 'Vistos recientemente',
  CardComponent,
}: {
  region: HttpTypes.StoreRegion;
  countryCode: string;
  currentProductId?: string;
  title?: string;
  CardComponent: ComponentType<{
    product: HttpTypes.StoreProduct;
    region: HttpTypes.StoreRegion;
  }>;
}) {
  const items = useRecentlyViewedStore((state) => state.items);
  const isLoaded = useRecentlyViewedStore((state) => state.isLoaded);
  const load = useRecentlyViewedStore((state) => state.load);
  const [products, setProducts] = useState<HttpTypes.StoreProduct[]>([]);

  useEffect(() => {
    load();
  }, [load]);

  // El producto que se está mirando no es una recomendación. Se excluye acá y además se
  // manda en `exclude_product_ids`: el motor es el que corta por `result_limit`, así que
  // dejarlo entrar consumiría uno de los cupos.
  const viewedIds = useMemo(
    () =>
      items
        .map((entry) => entry.id)
        .filter((id) => id !== currentProductId)
        .slice(0, MAX_CONTEXT_IDS),
    [items, currentProductId],
  );

  const context = useMemo(
    () => ({
      product_ids: viewedIds,
      ...(currentProductId ? { exclude_product_ids: [currentProductId] } : {}),
    }),
    [viewedIds, currentProductId],
  );

  // Sin `limit`: manda el `result_limit` del placement, configurable desde el admin.
  const { data } = useRecommendations({
    placement: 'recently-viewed',
    context,
    countryCode,
    skip: !isLoaded || viewedIds.length === 0,
  });

  const ids = useMemo(() => data.products.map((item) => item.product_id), [data.products]);
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
        // El repositorio no garantiza el orden pedido: se reordena al del motor, que
        // para este placement es el orden de visualización (lo último visto primero).
        const byId = new Map(fetched.map((product) => [product.id, product]));
        setProducts(ids.map((id) => byId.get(id)).filter(Boolean) as HttpTypes.StoreProduct[]);
      })
      .catch(() => {
        // Abortado o red caída: el rail simplemente no se muestra.
      });

    return () => controller.abort();
  }, [idsKey, countryCode]);

  // Nada hasta haber leído localStorage: renderizar antes produciría un mismatch de
  // hidratación (el servidor no tiene acceso al storage).
  if (!isLoaded || products.length === 0) return null;

  return (
    <RecommendationCarousel
      requestId={data.request_id}
      title={title}
      products={products}
      region={region}
      headingId="recently-viewed-heading"
      CardComponent={CardComponent}
    />
  );
}
