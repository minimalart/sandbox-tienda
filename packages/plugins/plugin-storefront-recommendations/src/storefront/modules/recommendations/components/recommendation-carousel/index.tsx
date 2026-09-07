'use client';

import type { HttpTypes } from '@medusajs/types';
import ScrollCarousel from '@minimalart/mercatto-storefront-shared/components/scroll-carousel';
import { useEffect, useRef, type ComponentType } from 'react';
import { useViewedOnce } from '../../hooks/use-viewed-once';
import { trackRecommendationEvent } from '../../lib/events';
import RecommendationSlot from '../recommendation-slot';

/**
 * Rail de recomendaciones: el único componente presentacional de la extensión.
 *
 * Reusa `ScrollCarousel` (del shared package) y una `CardComponent` que le inyecta el
 * host —típicamente `FeaturedProductCard`— mediante render prop. Se hace así porque
 * `FeaturedProductCard` NO es portable: arrastra el early-return del template `sports`,
 * la regla B2C de `getIndividualVariant`, `useProductPromotion`, `WishlistButton` y el
 * quick-view. Publicarla en el shared package traería todo ese árbol dentro del plugin.
 *
 * Recibe `requestId` como prop serializable desde el componente de servidor que hizo
 * el fetch: eso es lo que permite que un rail renderizado en el servidor pueda emitir
 * eventos de cliente sin cookies extra ni un refetch.
 */
export default function RecommendationCarousel({
  requestId,
  title,
  products,
  region,
  headingId,
  CardComponent,
}: {
  requestId: string | null;
  title: string;
  /**
   * Productos ya hidratados por Medusa. Se piden como `StoreProduct` (no la proyección
   * del motor) porque la `CardComponent` inyectada necesita variantes, precios y
   * promociones completas.
   */
  products: HttpTypes.StoreProduct[];
  region: HttpTypes.StoreRegion;
  headingId?: string;
  /**
   * Card inyectada por el host. Contract mínimo: recibe `product` y `region` y renderiza
   * un card presentacional. Ej.: `FeaturedProductCard` del storefront.
   */
  CardComponent: ComponentType<{
    product: HttpTypes.StoreProduct;
    region: HttpTypes.StoreRegion;
  }>;
}) {
  const railRef = useRef<HTMLDivElement>(null);

  // `viewed` sólo cuando el rail estuvo realmente visible (PRD §14.2). Se emite uno
  // por producto para que la métrica sea comparable con clics y agregados.
  useViewedOnce(railRef, () => {
    // `forEach` y no `for...of` sobre `.entries()`: el target de TS del storefront no
    // permite iterar iteradores sin `downlevelIteration`.
    products.forEach((product, index) => {
      trackRecommendationEvent({
        requestId,
        event: 'recommendation_viewed',
        productId: product.id,
        position: index,
      });
    });
  });

  // El backend ya registra `served` al responder; no se emite desde acá para no
  // duplicar la métrica de servidos.
  useEffect(() => {
    if (!requestId) return;
  }, [requestId]);

  if (!products.length) return null;

  return (
    <div ref={railRef}>
      <ScrollCarousel
        disableScrollForFew
        wrapperClassName="mt-6"
        title={
          <h2 className="font-bold text-gray-900 text-xl" id={headingId}>
            {title}
          </h2>
        }
      >
        {products.map((product, index) => (
          <RecommendationSlot
            key={product.id}
            requestId={requestId}
            productId={product.id}
            position={index}
            className="w-[216px] flex-shrink-0"
          >
            <CardComponent product={product} region={region} />
          </RecommendationSlot>
        ))}
      </ScrollCarousel>
    </div>
  );
}
