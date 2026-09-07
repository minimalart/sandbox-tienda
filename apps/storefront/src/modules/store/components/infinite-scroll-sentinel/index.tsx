"use client";

import { useEffect, useRef, type RefObject } from "react";

type InfiniteScrollSentinelProps = {
  onIntersect: () => void;
  /** No quedan más páginas: ni se observa ni se muestra nada. */
  disabled?: boolean;
  /**
   * Hay una tanda en vuelo. Pausa el observer (para no volver a pedir la misma
   * página) pero deja montado el loader: es justo el momento en el que el
   * usuario necesita ver que algo está cargando.
   *
   * Antes esto venía plegado dentro de `disabled`, y como `disabled` desmonta
   * el componente entero el skeleton se veía mientras NO pasaba nada y
   * desaparecía apenas empezaba la carga — exactamente al revés.
   */
  isLoading?: boolean;
  rootMargin?: string;
  threshold?: number;
  /** Loader/skeleton visible mientras `isLoading`. */
  children?: React.ReactNode;
  root?: RefObject<Element | null>;
};

export default function InfiniteScrollSentinel({
  onIntersect,
  disabled = false,
  isLoading = false,
  rootMargin = "0px 0px 400px 0px",
  threshold = 0,
  children,
  root,
}: InfiniteScrollSentinelProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  // El callback va por ref para que su identidad (cambia en cada render en los
  // callers, porque depende de la página actual) no destruya y recree el
  // observer todo el tiempo.
  const onIntersectRef = useRef(onIntersect);
  useEffect(() => {
    onIntersectRef.current = onIntersect;
  }, [onIntersect]);

  useEffect(() => {
    if (disabled || isLoading) return;

    const element = sentinelRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          onIntersectRef.current();
        }
      },
      {
        root: root?.current ?? null,
        rootMargin,
        threshold,
      },
    );

    observer.observe(element);

    // Al terminar la carga el efecto vuelve a correr y crea un observer nuevo:
    // eso dispara el callback inicial y encadena la tanda siguiente si el
    // centinela sigue a la vista (listas cortas o pantallas muy altas).
    return () => observer.disconnect();
  }, [disabled, isLoading, rootMargin, threshold, root]);

  if (disabled) return null;

  return (
    <>
      <div aria-hidden="true" className="h-px w-full" ref={sentinelRef} />
      {isLoading && children ? (
        <div aria-live="polite" className="mt-6 w-full" role="status">
          <span className="sr-only">Cargando más productos…</span>
          {children}
        </div>
      ) : null}
    </>
  );
}
