"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import {
  Children,
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

type ScrollCarouselProps = {
  children: React.ReactNode;
  title?: React.ReactNode;
  showArrows?: boolean;
  snap?: boolean;
  headerClassName?: string;
  containerClassName?: string;
  wrapperClassName?: string;
  disableScrollForFew?: boolean;
  /** Override de clases para los botones de navegación (p.ej. negro sólido en
   *  el template sports). Si no se pasa, usa el estilo por defecto. */
  arrowClassName?: string;
};

const DEFAULT_ARROW_CLASS =
  "flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-[--primary-color] shadow-sm transition hover:border-[--primary-color] hover:bg-[--primary-color] hover:text-white focus:outline-none";

export default function ScrollCarousel({
  children,
  title,
  showArrows = true,
  snap = false,
  headerClassName = "mb-4 flex items-center justify-between",
  containerClassName = "gap-4 pb-4",
  wrapperClassName,
  disableScrollForFew = false,
  arrowClassName,
}: ScrollCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const childrenArray = Children.toArray(children);

  const [isNarrowScreen, setIsNarrowScreen] = useState<boolean>(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1140px)");
    setIsNarrowScreen(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsNarrowScreen(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const isStaticMode =
    disableScrollForFew && childrenArray.length <= 4 && !isNarrowScreen;

  // Triple items so there is always content on both sides — enables
  // seamless infinite loop via silent repositioning in the scroll handler.
  // Each clone gets snap-start + snap-always: with the container's mandatory
  // snap on touch screens, scroll-snap-stop:always clamps every swipe to
  // exactly one item (no momentum fly-through).
  const withSnap = (c: React.ReactNode, key: string) => {
    if (!isValidElement(c)) return c;
    const el = c as React.ReactElement<{ className?: string }>;
    return cloneElement(el, {
      key,
      className: [el.props.className, "snap-start snap-always"]
        .filter(Boolean)
        .join(" "),
    });
  };
  const tripled = [
    ...childrenArray.map((c, i) => withSnap(c, `pre-${i}`)),
    ...childrenArray.map((c, i) => withSnap(c, `orig-${i}`)),
    ...childrenArray.map((c, i) => withSnap(c, `post-${i}`)),
  ];

  // Start at the middle (orig) set so both sides act as infinite buffer.
  // useLayoutEffect runs sync before paint — avoids any flash of pre content.
  useLayoutEffect(() => {
    if (isStaticMode) return;
    const el = scrollRef.current;
    if (!el || !el.firstElementChild) return;
    // Compute scroll position mathematically: N items * (itemWidth + gap).
    // This avoids offsetParent issues (offsetLeft) and viewport-state issues
    // (getBoundingClientRect) — both unreliable at effect time.
    const itemWidth = (el.firstElementChild as HTMLElement).offsetWidth;
    const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
    el.scrollLeft = childrenArray.length * (itemWidth + gap);
  }, [childrenArray.length]);

  // Reposition silently after each scroll animation completes.
  // Using "scrollend" prevents the glitch caused by repositioning mid-animation.
  // Fallback: debounced "scroll" for Safari < 18.2 which lacks scrollend support.
  //
  // Physical boundary checks (isAtEnd/isAtStart) handle carousels where item
  // count is small and scrollWidth < 2*clientWidth, making the 2.5x threshold
  // unreachable. scrollend won't fire when scroll is already at max/min.
  useEffect(() => {
    if (isStaticMode) return;
    const el = scrollRef.current;
    if (!el) return;
    const n = childrenArray.length;

    const reposition = () => {
      if (!el.firstElementChild) return;
      const itemWidth = (el.firstElementChild as HTMLElement).offsetWidth;
      const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
      const setWidth = n * (itemWidth + gap);
      const atStart = el.scrollLeft <= 5;
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 5;
      if (atStart || el.scrollLeft < setWidth * 0.5) {
        el.scrollLeft += setWidth;
      } else if (atEnd || el.scrollLeft > setWidth * 2.5) {
        el.scrollLeft -= setWidth;
      }
    };

    if ("onscrollend" in window) {
      el.addEventListener("scrollend", reposition, { passive: true });
      return () => el.removeEventListener("scrollend", reposition);
    }

    // Fallback: wait for scroll to settle before repositioning
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onScroll = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(reposition, 150);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (timer) clearTimeout(timer);
    };
  }, [childrenArray.length]);

  // Advance by exactly one card slot (itemWidth + gap) per click.
  // Pre-emptive reposition handles few-item carousels where the physical
  // scroll boundary is reached before the scrollend threshold — in that case
  // scrollend never fires, so we must reposition before the scrollBy.
  const scroll = useCallback(
    (direction: "left" | "right") => {
      const el = scrollRef.current;
      if (!el || !el.firstElementChild) return;
      const itemWidth = (el.firstElementChild as HTMLElement).offsetWidth;
      const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
      const step = itemWidth + gap;
      const setWidth = childrenArray.length * step;
      const maxScroll = el.scrollWidth - el.clientWidth;
      if (direction === "right" && el.scrollLeft + step > maxScroll) {
        el.scrollLeft -= setWidth;
      } else if (direction === "left" && el.scrollLeft - step < 0) {
        el.scrollLeft += setWidth;
      }
      el.scrollBy({
        left: direction === "right" ? step : -step,
        behavior: "smooth",
      });
    },
    [childrenArray.length],
  );

  const effectiveShowArrows = showArrows && !isStaticMode;
  const hasHeader = title !== undefined || effectiveShowArrows;

  return (
    <div className={wrapperClassName}>
      {hasHeader && (
        <div className={headerClassName}>
          {title}
          {effectiveShowArrows && (
            <div className="hidden items-center gap-2 sm:flex">
              <button
                type="button"
                onClick={() => scroll("left")}
                aria-label="Anterior"
                className={arrowClassName ?? DEFAULT_ARROW_CLASS}
              >
                <ChevronLeftIcon className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => scroll("right")}
                aria-label="Siguiente"
                className={arrowClassName ?? DEFAULT_ARROW_CLASS}
              >
                <ChevronRightIcon className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
      )}
      <div
        ref={scrollRef}
        className={[
          isStaticMode ? "flex flex-wrap" : "no-scrollbar flex overflow-x-auto",
          // Mandatory snap on coarse pointers (touch) so each swipe lands on
          // the next item; opt-in everywhere else via the `snap` prop.
          !isStaticMode && snap ? "snap-x snap-mandatory" : "",
          !isStaticMode && !snap
            ? "[@media(pointer:coarse)]:snap-x [@media(pointer:coarse)]:snap-mandatory"
            : "",
          containerClassName,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {isStaticMode ? childrenArray : tripled}
      </div>
    </div>
  );
}
