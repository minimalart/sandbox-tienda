'use client';

import { useStorefrontShared } from '@minimalart/mercatto-storefront-shared/provider';
import { useEffect, useRef } from 'react';
import { trackRecommendationEvent } from '../../lib/events';

/**
 * Envuelve UNA card de recomendación y registra el clic y el agregado al carrito.
 *
 * La restricción de diseño: `FeaturedProductCard` se usa en una docena de lugares y
 * NO se toca. Ni una prop nueva ni un fork — arrastra el early-return del template
 * `sports`, la regla B2C de `getIndividualVariant`, `useProductPromotion`,
 * `WishlistButton` y el quick-view; un fork se podriría en una semana.
 *
 * Cómo se resuelve cada evento sin tocarla:
 *
 * - CLIC: `onClickCapture` en el div que la envuelve. Los eventos sintéticos de React
 *   propagan por el árbol de REACT, no del DOM, así que esto captura también lo que
 *   pasa dentro del modal de quick-view (que es hijo de la card aunque se renderice en
 *   un portal).
 *
 * - AGREGADO AL CARRITO: la card llama a `useCartStore.addItem` internamente y no
 *   expone callback. Se infiere combinando dos señales: un pointerdown sobre ESTA card
 *   "arma" una ventana de 4s, y si dentro de esa ventana la cantidad de ESTE producto
 *   en el carrito sube, se atribuye. Para un falso positivo el usuario tendría que
 *   clickear esta card y agregar este mismo producto desde otro lugar en 4 segundos.
 */

const ARM_WINDOW_MS = 4000;

type CartItemLike = {
  product_id?: string | null;
  variant_id?: string | null;
  quantity: number;
};
type CartStoreShape = { cart: { items?: CartItemLike[] } | null };

/** Cantidad de un producto en el carrito, con fallback por producto (como la card). */
const quantityOf = (items: CartItemLike[] | undefined, productId: string): number =>
  (items ?? [])
    .filter((item) => item.product_id === productId)
    .reduce((sum, item) => sum + (item.quantity ?? 0), 0);

export default function RecommendationSlot({
  requestId,
  productId,
  position,
  className,
  children,
}: {
  requestId: string | null;
  productId: string;
  position: number;
  className?: string;
  children: React.ReactNode;
}) {
  const { cartStore } = useStorefrontShared();
  const quantity = cartStore.useCartStore((state: unknown) =>
    quantityOf((state as CartStoreShape).cart?.items, productId),
  );
  const armedUntil = useRef(0);
  const previousQuantity = useRef(quantity);

  useEffect(() => {
    const previous = previousQuantity.current;
    previousQuantity.current = quantity;
    if (quantity > previous && Date.now() < armedUntil.current) {
      trackRecommendationEvent({
        requestId,
        event: 'recommendation_added_to_cart',
        productId,
        position,
      });
    }
  }, [quantity, requestId, productId, position]);

  return (
    <div
      className={className}
      onPointerDownCapture={() => {
        armedUntil.current = Date.now() + ARM_WINDOW_MS;
      }}
      onClickCapture={() => {
        trackRecommendationEvent({
          requestId,
          event: 'recommendation_clicked',
          productId,
          position,
        });
      }}
    >
      {children}
    </div>
  );
}
