"use client";

import { searchProductsFromBrowser } from "@lib/typesense/search-browser";
import type { TypesenseProductDocument } from "@lib/typesense/types";
import ScrollCarousel from "@modules/common/components/scroll-carousel";
import TypesenseProductCard from "@modules/store/templates/typesense-product-card";
import { useEffect, useState } from "react";

type TermCarouselProps = {
  term: string;
  countryCode: string;
};

const RESULTS_PER_TERM = 12;

/**
 * One row of the shopping list: searches Typesense for the term and renders
 * a product carousel, a skeleton while loading, or a clear empty state.
 */
export default function TermCarousel({ term, countryCode }: TermCarouselProps) {
  const [products, setProducts] = useState<TypesenseProductDocument[] | null>(
    null,
  );
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setProducts(null);
    setFailed(false);

    searchProductsFromBrowser({
      q: term,
      limit: RESULTS_PER_TERM,
      sortBy: "relevance",
    })
      .then((result) => {
        if (!cancelled) setProducts(result.products);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [term]);

  const heading = (
    <h2 className="text-lg font-bold text-gray-900 first-letter:uppercase">
      {term}
    </h2>
  );

  // Loading skeleton — same footprint as the card row, no layout jump.
  if (products === null && !failed) {
    return (
      <section aria-busy="true">
        <div className="mb-4 flex items-center justify-between">{heading}</div>
        <div className="no-scrollbar flex gap-4 overflow-x-hidden pb-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-[280px] w-[216px] flex-shrink-0 animate-pulse rounded-xl bg-gray-100"
            />
          ))}
        </div>
      </section>
    );
  }

  // Empty / error state — clear message per term.
  if (failed || !products || products.length === 0) {
    return (
      <section>
        <div className="mb-4 flex items-center justify-between">{heading}</div>
        <div className="flex items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-8">
          <p className="text-center text-sm text-gray-500">
            {failed
              ? "No pudimos buscar este término. Probá de nuevo."
              : `No encontramos productos para "${term}".`}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <ScrollCarousel title={heading}>
        {products.map((product) => (
          <div className="w-[216px] flex-shrink-0" key={product.id}>
            <TypesenseProductCard countryCode={countryCode} product={product} />
          </div>
        ))}
      </ScrollCarousel>
    </section>
  );
}
