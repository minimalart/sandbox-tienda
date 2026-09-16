"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@lib/util/cn";
import type { ComponentProps, ReactNode } from "react";

type PlaneButtonProps = Omit<ComponentProps<typeof Button>, "children"> & {
  children: ReactNode;
  /** Texto que queda cuando la acción terminó bien (ej. "¡Listo!"). */
  successLabel: string;
  /** Al pasar a true despega el avión y el botón queda en estado final. */
  isSuccess: boolean;
};

/**
 * Botón de envío con despegue de avión de papel.
 *
 * La etiqueta sale hacia arriba, un avión cruza el botón dejando dos estelas
 * y entra el estado de éxito desde abajo. Toda la coreografía son keyframes
 * de CSS (ver `plane-*` en tailwind.config.js): no hay timers en JS, así que
 * el botón no necesita estado propio — se dispara solo con `isSuccess`.
 *
 * Lo usan el newsletter del footer y el formulario de contacto.
 */
export default function PlaneButton({
  children,
  successLabel,
  isSuccess,
  className,
  disabled,
  ...props
}: PlaneButtonProps) {
  return (
    <Button
      className={cn("relative overflow-hidden", className)}
      disabled={disabled || isSuccess}
      {...props}
    >
      <PlaneFlight isSuccess={isSuccess} successLabel={successLabel}>
        {children}
      </PlaneFlight>
    </Button>
  );
}

/**
 * La coreografía sola, para meter dentro de un `<button>` propio.
 *
 * El botón que la contenga tiene que ser `relative overflow-hidden`.
 */
export function PlaneFlight({
  children,
  successLabel,
  isSuccess,
}: {
  children: ReactNode;
  successLabel: string;
  isSuccess: boolean;
}) {
  return (
    <>
      {/* Etiqueta original — queda en el flujo para que el botón no cambie
          de ancho cuando el estado de éxito se superpone. */}
      <span
        className={cn(
          "flex items-center justify-center gap-2",
          isSuccess && "animate-plane-label-out motion-reduce:animate-none",
        )}
      >
        {children}
      </span>

      {isSuccess && (
        <>
          {/* Estelas: dos curvas que se dibujan y se van detrás del avión. */}
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-1/2 h-4 w-8 -translate-x-[140%] -translate-y-1/2 rotate-90 text-current opacity-60"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth={2}
            viewBox="0 0 33 64"
          >
            <path
              className="animate-plane-trail [stroke-dasharray:64] motion-reduce:animate-none"
              d="M26,4 C28,13.3 29,22.7 29,32 C29,41.3 28,50.7 26,60"
            />
            <path
              className="animate-plane-trail [animation-delay:60ms] [stroke-dasharray:64] motion-reduce:animate-none"
              d="M6,4 C8,13.3 9,22.7 9,32 C9,41.3 8,50.7 6,60"
            />
          </svg>

          {/* Avión */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            <svg
              className="h-4 w-4 animate-plane-fly motion-reduce:animate-none"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M2.4 11.2 20.6 3.3c.8-.3 1.6.5 1.3 1.3l-7.9 18.2c-.3.8-1.5.7-1.7-.1l-1.9-6.6-6.6-1.9c-.8-.2-.9-1.4-.1-1.7Z" />
            </svg>
          </span>

          {/* Estado final */}
          <span className="absolute inset-0 flex animate-plane-success-in items-center justify-center gap-1.5 motion-reduce:animate-none">
            <svg
              aria-hidden="true"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.25}
              viewBox="0 0 16 16"
            >
              <path d="M3.75 9 7 12l6-7" />
            </svg>
            {successLabel}
          </span>
        </>
      )}
    </>
  );
}
