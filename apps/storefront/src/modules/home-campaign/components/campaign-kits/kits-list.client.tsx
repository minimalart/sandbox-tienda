"use client";

import type { TypesenseProductDocument } from "@lib/typesense";
import InfiniteScrollSentinel from "@modules/store/components/infinite-scroll-sentinel";
import TypesenseProductCard from "@modules/store/templates/typesense-product-card";
import { useCallback, useState } from "react";
import { loadMoreCampaignKits } from "./actions";

type KitsListProps = {
  initialProducts: TypesenseProductDocument[];
  initialHasMore: boolean;
  pageSize: number;
  countryCode: string;
  filters: {
    collectionId?: string;
    tag?: string;
  };
};

/**
 * Lista de productos del feed campaign. Recibe la primera página del server
 * component (`<CampaignKits>`) y va sumando páginas con `loadMoreCampaignKits`
 * cuando el sentinel entra en viewport.
 *
 * Card: `TypesenseProductCard variant="home"` — la misma card que usa el
 * catálogo de supermercado (default template). Antes había una card custom
 * inline que dejaba fuera wishlist, quick-view, stepper +/-, badge de
 * descuento, borde primario al agregar, etc. Reusar la canónica mantiene el
 * treatment consistente y hereda mejoras futuras sin duplicar código.
 *
 * Layout: `flex flex-wrap justify-center` — con 1-3 productos las cards
 * quedan centradas en el contenedor (grid con cols fijas dejaba huecos).
 */
export function CampaignKitsList({
  initialProducts,
  initialHasMore,
  pageSize,
  countryCode,
  filters,
}: KitsListProps) {
  const [products, setProducts] = useState(initialProducts);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isLoading, setIsLoading] = useState(false);

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;
    setIsLoading(true);
    const next = page + 1;
    const res = await loadMoreCampaignKits({
      page: next,
      limit: pageSize,
      collectionId: filters.collectionId,
      tag: filters.tag,
    });
    setProducts((prev) => [...prev, ...res.products]);
    setPage(next);
    setHasMore(res.hasMore && res.products.length > 0);
    setIsLoading(false);
  }, [isLoading, hasMore, page, pageSize, filters.collectionId, filters.tag]);

  return (
    <>
      <ul className="flex flex-wrap justify-center gap-6">
        {products.map((p) => (
          <li key={p.id} className="w-full max-w-[291px]">
            <TypesenseProductCard
              product={p}
              countryCode={countryCode}
              variant="home"
            />
          </li>
        ))}
      </ul>
      <InfiniteScrollSentinel
        onIntersect={() => void loadMore()}
        disabled={!hasMore}
        isLoading={isLoading}
      >
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-[color:var(--primary-color,#0f1114)]" />
      </InfiniteScrollSentinel>
    </>
  );
}

export default CampaignKitsList;
