"use client";

import Image from "next/image";
import { formatPrice } from "../lib/resolve-variant";
import type { VariantPresentation } from "../lib/variant-presentation";

/**
 * Tarjeta de una opción del paso. Muestra la foto de esa variante, la gama
 * (Económica / Intermedia / Premium), el nombre comercial y el precio.
 *
 * Dos formatos según el ancho, por la misma regla de "nada de scroll":
 *  - mobile: APAISADA (foto a la izquierda, datos a la derecha ocupando el alto
 *    de la foto). Tres opciones en vertical entran en pantalla; en formato
 *    vertical la tercera quedaba siempre abajo del fold.
 *  - desktop: vertical, en fila, que es donde se comparan de un vistazo.
 *
 * "Ver detalle" es un botón APARTE del área seleccionable — elegir y mirar el
 * detalle son dos intenciones distintas — y no puede anidarse dentro del otro
 * botón (HTML inválido), así que en mobile flota en la esquina inferior derecha
 * y en desktop es la franja de abajo.
 */
export const BundleVariantCard = ({
  variant,
  className,
  quantity,
  selected,
  disabled,
  onSelect,
  onDetail,
}: {
  variant: VariantPresentation;
  className?: string;
  quantity: number;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
  onDetail: () => void;
}) => (
  <div
    className={
      "group relative flex flex-row rounded-2xl border bg-white transition-all sm:flex-col " +
      (className ? className + " " : "") +
      (selected
        ? "border-[--primary-color] shadow-[0_8px_30px_-12px_var(--primary-color)] ring-1 ring-[--primary-color]"
        : disabled
          ? "border-neutral-200 opacity-50"
          : "border-neutral-200 hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-lg")
    }
  >
    <button
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      onClick={onSelect}
      className="flex flex-1 items-center gap-3 p-3 text-left disabled:cursor-not-allowed sm:flex-col sm:items-stretch sm:gap-2 sm:text-center"
    >
      <div className="relative h-20 w-20 shrink-0 sm:h-24 sm:w-full xl:h-28">
        {variant.image ? (
          <Image
            src={variant.image}
            alt={variant.label}
            fill
            sizes="(max-width: 640px) 80px, 200px"
            className="object-contain transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center rounded-xl bg-neutral-50 text-[10px] text-neutral-400">
            Sin foto
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 sm:justify-start">
        {variant.tierLabel && (
          <span
            className={
              "w-fit rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide sm:self-start " +
              (selected
                ? "bg-[--primary-color] text-white"
                : "bg-[--primary-soft-bg] text-[--primary-color]")
            }
          >
            {variant.tierLabel}
          </span>
        )}

        <p className="text-sm font-medium leading-tight text-neutral-900">{variant.label}</p>
        {variant.marca && variant.marca !== variant.label && (
          <p className="text-xs leading-tight text-neutral-500">{variant.marca}</p>
        )}

        <p className="text-sm font-semibold text-neutral-900 xl:text-base">
          {formatPrice(variant.amount, variant.currencyCode)}
          {quantity > 1 && variant.amount !== null && (
            <span className="ml-1 text-[11px] font-normal text-neutral-500">
              · {quantity} u. {formatPrice(variant.amount * quantity, variant.currencyCode)}
            </span>
          )}
        </p>
      </div>
    </button>

    <button
      type="button"
      onClick={onDetail}
      className="absolute bottom-2 right-3 text-[11px] font-medium text-neutral-500 underline underline-offset-2 transition-colors hover:text-[--primary-color] sm:static sm:border-t sm:border-neutral-100 sm:px-4 sm:py-2 sm:no-underline"
    >
      Ver detalle
    </button>

    {selected && (
      <span
        aria-hidden
        className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[--primary-color] text-xs text-white shadow"
      >
        ✓
      </span>
    )}
  </div>
);
