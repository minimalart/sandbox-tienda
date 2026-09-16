"use client";

import { cn } from "@lib/util/cn";
import type { ReactNode } from "react";

export {
  CART_DROP_MS,
  STEPPER_IN_MS,
  startCartDrop,
  startCartTrash,
  CART_TRASH_MS,
  useCartDropPhase,
  type CartDropPhase,
} from "./store";

type CartDropFlightProps = {
  /** Etiqueta normal del botón. */
  children: ReactNode;
  /** `true` mientras la coreografía tiene que estar corriendo. */
  playing: boolean;
};

/**
 * Coreografía de "agregar al carrito" dentro del propio botón.
 *
 * La etiqueta se va, entra un carrito desde la izquierda, cae un ítem adentro,
 * el carrito acusa el golpe y se va rodando por la derecha; al final vuelve la
 * etiqueta. Son keyframes de CSS (`atc-*` en tailwind.config.js).
 *
 * El componente no tiene estado propio: `playing` sale del store por variante
 * (`useCartDropPhase`), que sobrevive a los remontajes del quick view.
 *
 * El ítem es una caja genérica a propósito — sirve para cualquier rubro, no
 * asume que el producto sea ropa.
 *
 * El botón que la contenga tiene que ser `relative overflow-hidden`.
 */
export default function CartDropFlight({
  children,
  playing,
}: CartDropFlightProps) {
  return (
    <>
      <span
        className={cn(
          "flex items-center justify-center gap-2",
          playing && "animate-atc-label motion-reduce:animate-none",
        )}
        
      >
        {children}
      </span>

      {playing && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
          
        >
          <span className="relative block h-6 w-6">
            {/* Ítem genérico: una caja que cae dentro del carrito. */}
            <span className="absolute inset-x-0 top-0 flex animate-atc-item justify-center motion-reduce:animate-none">
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                viewBox="0 0 24 24"
              >
                <path d="M21 8 12 3 3 8l9 5 9-5Z" />
                <path d="M3 8v8l9 5 9-5V8" />
                <path d="M12 13v8" />
              </svg>
            </span>

            {/* Carrito */}
            <svg
              className="absolute inset-0 h-6 w-6 animate-atc-cart motion-reduce:animate-none"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              viewBox="0 0 24 24"
            >
              <path d="M2.5 3h2l2.2 11.2a1.6 1.6 0 0 0 1.6 1.3h8.4a1.6 1.6 0 0 0 1.6-1.3L21 7H6" />
              <circle cx="9.5" cy="19.5" r="1.4" />
              <circle cx="16.5" cy="19.5" r="1.4" />
            </svg>
          </span>
        </span>
      )}
    </>
  );
}
