"use client";

import { cn } from "../util/cn";
import { type ComponentPropsWithoutRef, forwardRef } from "react";

type CheckboxInputProps = Omit<ComponentPropsWithoutRef<"input">, "type"> & {
  /** Clases del contenedor (tamaño/alineación). El default es 16x16. */
  containerClassName?: string;
};

/**
 * Checkbox del storefront: tilde en color primario sobre fondo blanco.
 *
 * No usamos `accent-color` porque el navegador elige el color del tilde (con
 * primarios claros lo pinta negro) ni fondo primario, porque pierde contraste
 * cuando el checkbox cae sobre un botón o una card del mismo color. Fondo
 * blanco + tilde primario funciona sobre cualquier superficie.
 */
const CheckboxInput = forwardRef<HTMLInputElement, CheckboxInputProps>(
  ({ className, containerClassName, ...props }, ref) => (
    <span
      className={cn(
        "relative inline-flex size-4 shrink-0",
        containerClassName,
        className,
      )}
    >
      <input
        className="peer size-full cursor-pointer appearance-none rounded-[5px] border border-gray-300 bg-white transition-colors checked:[transition-delay:120ms] indeterminate:border-[--primary-color] checked:border-[--primary-color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--primary-color] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
        data-styled-checkbox=""
        ref={ref}
        type="checkbox"
        {...props}
      />
      {/* El tilde se dibuja solo: la longitud del trazo es ~12.4 unidades del
          viewBox, así que con dasharray fijo en 13 y dashoffset 13 -> 0 el
          path se va revelando de punta a punta en vez de aparecer de golpe.
          `strokeDasharray`/`strokeDashoffset` van como atributos del SVG (no
          como clases Tailwind) porque el atributo garantiza el estado base
          sin depender de que la clase arbitraria se genere en el CSS: el
          override a 0 sigue viviendo en Tailwind vía `peer-checked`. */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 size-full text-[--primary-color] transition-[stroke-dashoffset] duration-300 ease-out peer-checked:[stroke-dashoffset:0] peer-indeterminate:opacity-0 motion-reduce:transition-none"
        fill="none"
        stroke="currentColor"
        strokeDasharray={13}
        strokeDashoffset={13}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2.25}
        viewBox="0 0 16 16"
      >
        <path d="M3.75 8.5 6.5 11.25 12.25 5" />
      </svg>
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 size-full text-[--primary-color] opacity-0 peer-indeterminate:opacity-100"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth={2.25}
        viewBox="0 0 16 16"
      >
        <path d="M4.25 8h7.5" />
      </svg>
    </span>
  ),
);

CheckboxInput.displayName = "CheckboxInput";

export default CheckboxInput;
