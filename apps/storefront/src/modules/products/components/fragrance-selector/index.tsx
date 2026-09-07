"use client";

import LocalizedClientLink from "@modules/common/components/localized-client-link";
import ProductImage from "@modules/common/components/product-image";
import { useRef, useState, useEffect } from "react";

export type FragranceItem = {
  id: string;
  handle: string;
  thumbnail: string | null;
  title: string;
};

type FragranceSelectorProps = {
  fragrances: FragranceItem[];
  currentProductId: string;
};

const MAX_FRAGRANCES = 20;
const ITEM_SCROLL_PX = 56 + 12; // item width + gap-3

const FragranceSelector = ({
  fragrances,
  currentProductId,
}: FragranceSelectorProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const displayedFragrances = fragrances.slice(0, MAX_FRAGRANCES);

  const updateArrows = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  };

  useEffect(() => {
    updateArrows();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateArrows, { passive: true });
    return () => el.removeEventListener("scroll", updateArrows);
  }, [displayedFragrances]);

  const scrollLeft = () => {
    scrollRef.current?.scrollBy({ left: -ITEM_SCROLL_PX, behavior: "smooth" });
  };

  const scrollRight = () => {
    scrollRef.current?.scrollBy({ left: ITEM_SCROLL_PX, behavior: "smooth" });
  };

  if (displayedFragrances.length === 0) {
    return null;
  }

  return (
    <div className="mt-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold text-gray-900 text-sm">Fragancias</h2>
        <div className="flex items-center gap-2">
          <span className="text-gray-500 text-sm">
            {displayedFragrances.length} variantes
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={scrollLeft}
              disabled={!canScrollLeft}
              aria-label="Anterior fragancia"
              className="flex h-6 w-6 items-center justify-center rounded transition-opacity disabled:opacity-30"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M10 12L6 8L10 4"
                  stroke="var(--price-strikethrough)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button
              type="button"
              onClick={scrollRight}
              disabled={!canScrollRight}
              aria-label="Siguiente fragancia"
              className="flex h-6 w-6 items-center justify-center rounded transition-opacity disabled:opacity-30"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M6 4L10 8L6 12"
                  stroke="var(--price-strikethrough)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="no-scrollbar flex w-full gap-3 overflow-x-auto pb-2"
      >
        {displayedFragrances.map((fragrance) => {
          const isActive = fragrance.id === currentProductId;
          return (
            <LocalizedClientLink
              key={fragrance.id}
              href={`/products/${fragrance.handle}`}
              className={`relative flex-shrink-0 rounded-xl border-2 p-1.5 transition-all ${
                isActive
                  ? "border-[--primary-color] shadow-sm"
                  : "border-gray-200 hover:border-gray-300 hover:shadow-sm"
              }`}
              title={fragrance.title}
            >
              <div className="relative h-[72px] w-[56px]">
                <ProductImage
                  src={fragrance.thumbnail}
                  alt={fragrance.title}
                  fill
                  className="rounded-lg object-contain"
                  sizes="56px"
                />
              </div>
            </LocalizedClientLink>
          );
        })}
      </div>
    </div>
  );
};

export default FragranceSelector;
