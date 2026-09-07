"use client";

import { type MutableRefObject, useEffect, useRef } from "react";

type ScrollRevealOptions = {
  rootMargin?: string;
  threshold?: number;
  once?: boolean;
  delay?: number;
};

export const useScrollReveal = <T extends HTMLElement>({
  rootMargin = "0px 0px -10% 0px",
  threshold = 0.2,
  once = true,
  delay = 0,
}: ScrollRevealOptions = {}): MutableRefObject<T | null> => {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const node = ref.current;

    if (
      !node ||
      typeof window === "undefined" ||
      !("IntersectionObserver" in window)
    ) {
      return;
    }

    node.classList.add("reveal-hidden");
    if (!node.classList.contains("reveal-element")) {
      node.classList.add("reveal-element");
    }
    node.style.transitionDelay = `${delay}ms`;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          node.classList.add("reveal-visible");
          node.classList.remove("reveal-hidden");

          if (once) {
            observer.unobserve(entry.target);
          }
        } else if (!once) {
          node.classList.remove("reveal-visible");
          node.classList.add("reveal-hidden");
        }
      },
      { rootMargin, threshold }
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [delay, once, rootMargin, threshold]);

  return ref;
};
