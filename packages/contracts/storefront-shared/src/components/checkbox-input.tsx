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
        className="peer size-full cursor-pointer appearance-none rounded-[5px] border border-gray-300 bg-white transition-colors indeterminate:border-[--primary-color] checked:border-[--primary-color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--primary-color] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
        data-styled-checkbox=""
        ref={ref}
        type="checkbox"
        {...props}
      />
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 size-full text-[--primary-color] opacity-0 peer-checked:opacity-100 peer-indeterminate:opacity-0"
        fill="none"
        stroke="currentColor"
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
