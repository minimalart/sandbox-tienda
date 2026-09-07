'use client';

import { useEffect, useRef, type RefObject } from 'react';

/**
 * Dispara una vez cuando el elemento estuvo REALMENTE visible.
 *
 * El PRD §14.2 es explícito: una impresión no cuenta porque el servidor devolvió la
 * recomendación, sino cuando el componente entró al viewport. De ahí las dos
 * condiciones:
 *
 *  - `threshold: 0.5` → tiene que verse al menos la mitad del rail;
 *  - permanencia mínima → un scroll rápido que cruza el rail no es una vista.
 *
 * `lib/hooks/use-in-view.tsx` (core) no sirve acá: no soporta threshold ni
 * disparar-una-sola-vez, y es un archivo que no nos pertenece.
 */
export function useViewedOnce(
  ref: RefObject<HTMLElement | null>,
  onVisible: () => void,
  options: { threshold?: number; dwellMs?: number } = {},
): void {
  const firedRef = useRef(false);
  // El callback va por ref para que un re-render del padre no reinicie el observer.
  const callbackRef = useRef(onVisible);
  callbackRef.current = onVisible;

  const { threshold = 0.5, dwellMs = 300 } = options;

  useEffect(() => {
    const element = ref.current;
    if (!element || firedRef.current) return;
    if (typeof IntersectionObserver === 'undefined') return;

    let dwellTimer: ReturnType<typeof setTimeout> | null = null;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !firedRef.current) {
            if (dwellTimer) continue;
            dwellTimer = setTimeout(() => {
              firedRef.current = true;
              observer.disconnect();
              callbackRef.current();
            }, dwellMs);
          } else if (!entry.isIntersecting && dwellTimer) {
            // Salió del viewport antes de cumplir la permanencia: no cuenta.
            clearTimeout(dwellTimer);
            dwellTimer = null;
          }
        }
      },
      { threshold },
    );

    observer.observe(element);
    return () => {
      if (dwellTimer) clearTimeout(dwellTimer);
      observer.disconnect();
    };
  }, [ref, threshold, dwellMs]);
}
