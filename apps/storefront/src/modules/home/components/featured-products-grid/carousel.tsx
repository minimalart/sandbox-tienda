"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

type FeaturedProductsCarouselProps = {
  scrollId: string;
};

export default function FeaturedProductsCarousel({ scrollId }: FeaturedProductsCarouselProps) {
  const scroll = (direction: "left" | "right") => {
    const scrollContainer = document.getElementById(scrollId);
    if (scrollContainer) {
      const scrollAmount = direction === "left" ? -320 : 320;
      scrollContainer.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  return (
    <div className="hidden items-center gap-2 sm:flex">
      <button
        aria-label="Anterior"
        className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-900 shadow-sm transition hover:border-[--primary-color] hover:bg-[--primary-color] hover:text-white focus:outline-none"
        onClick={() => scroll("left")}
      >
        <ChevronLeftIcon className="h-5 w-5" />
      </button>
      <button
        aria-label="Siguiente"
        className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-900 shadow-sm transition hover:border-[--primary-color] hover:bg-[--primary-color] hover:text-white focus:outline-none"
        onClick={() => scroll("right")}
      >
        <ChevronRightIcon className="h-5 w-5" />
      </button>
    </div>
  );
}
