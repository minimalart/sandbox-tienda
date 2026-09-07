"use client";

import {
  FLOATING_LAYER,
  FLOATING_OBSTACLE_SELECTOR,
  type FloatingObstacleBand,
  readFloatingLayer,
  resolveFloatingBottomOffset,
  toFloatingBand,
} from "@lib/util/floating-obstacle";
import { type RefObject, useCallback, useEffect, useRef, useState } from "react";

const isHidden = (element: Element): boolean => {
  const style = window.getComputedStyle(element);
  // `opacity: 0` NO cuenta como oculto a propósito: varios elementos (volver
  // arriba, el nudge de envío gratis) se atenúan sin desmontarse y esquivarlos
  // igual evita que el botón salte de posición al scrollear.
  return style.display === "none" || style.visibility === "hidden";
};

/**
 * Calcula a qué altura del borde inferior tiene que quedar un elemento flotante
 * para no pisar ningún elemento anclado abajo (nav mobile, barra sticky de
 * agregar al carrito, volver arriba, bandeja de comparación, banner de
 * cookies…). Cada uno se marca con `data-floating-obstacle`; ver
 * `lib/util/floating-obstacle.ts`.
 *
 * En vez de hardcodear offsets por breakpoint, medimos: se arranca en
 * `baseOffset` y, mientras la banda del elemento cruce la de un obstáculo que
 * además lo solape en horizontal, se sube justo por encima de ese obstáculo. Así
 * el resultado es correcto en mobile y desktop, en la PDP (barra alta) y con
 * cualquier combinación de banners visibles — y el elemento NO se mueve cuando
 * el obstáculo está en otra columna (p.ej. "volver arriba" a la izquierda en
 * mobile).
 *
 * Solo se esquivan los obstáculos de capa MENOR a `layer`: la escalera de
 * `FLOATING_LAYER` es unidireccional para que dos elementos no se empujen
 * mutuamente hasta el techo del viewport.
 *
 * @param ref elemento a posicionar (se mide su alto y su columna real).
 * @param baseOffset altura mínima en px, cuando no hay nada que esquivar.
 * @param layer capa propia dentro de `FLOATING_LAYER`.
 */
export function useSafeBottomOffset(
  ref: RefObject<HTMLElement | null>,
  baseOffset: number,
  layer: number = FLOATING_LAYER.floatingButton,
): number {
  const [offset, setOffset] = useState(baseOffset);
  const frame = useRef<number | null>(null);

  const measure = useCallback(() => {
    const element = ref.current;
    if (!element) return;

    const viewportHeight = window.innerHeight;
    const self = element.getBoundingClientRect();
    const height = self.height || 0;
    if (!height) return;

    const obstacles: FloatingObstacleBand[] = [];
    for (const candidate of Array.from(
      document.querySelectorAll(FLOATING_OBSTACLE_SELECTOR),
    )) {
      if (candidate === element || element.contains(candidate)) continue;
      if (isHidden(candidate)) continue;
      const rect = candidate.getBoundingClientRect();
      if (rect.height <= 0 || rect.width <= 0) continue;
      // Solo interesan los que viven pegados abajo del viewport.
      if (rect.bottom < viewportHeight * 0.5) continue;
      obstacles.push({
        ...toFloatingBand(rect, viewportHeight),
        layer: readFloatingLayer(candidate),
      });
    }

    setOffset(
      resolveFloatingBottomOffset({
        self: { height, left: self.left, right: self.right },
        obstacles,
        layer,
        baseOffset,
        viewportHeight,
      }),
    );
  }, [baseOffset, layer, ref]);

  useEffect(() => {
    const schedule = () => {
      if (frame.current !== null) return;
      frame.current = window.requestAnimationFrame(() => {
        frame.current = null;
        measure();
      });
    };

    schedule();

    // Los obstáculos entran y salen con animación (framer-motion, Transition de
    // headless-ui): además de reaccionar al cambio del DOM, re-medimos cuando la
    // transición termina para tomar el rect final.
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ["class", "style", "hidden"],
    });

    const resizeObserver = new ResizeObserver(schedule);
    resizeObserver.observe(document.body);

    // No escuchamos `scroll` a propósito: los obstáculos son `position: fixed`,
    // así que no se mueven al scrollear. Los que aparecen con el scroll (volver
    // arriba, la barra del PDP) lo hacen cambiando clases o montándose, y eso ya
    // lo ve el MutationObserver — medir en cada frame de scroll sería puro costo.
    window.addEventListener("resize", schedule);
    window.addEventListener("transitionend", schedule, true);
    window.addEventListener("animationend", schedule, true);

    return () => {
      if (frame.current !== null) window.cancelAnimationFrame(frame.current);
      frame.current = null;
      observer.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("transitionend", schedule, true);
      window.removeEventListener("animationend", schedule, true);
    };
  }, [measure]);

  return offset;
}
