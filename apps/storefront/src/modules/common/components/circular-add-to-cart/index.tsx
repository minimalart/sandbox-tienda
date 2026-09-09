"use client";

import { cn } from "@lib/util/cn";
import { ShoppingCart } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";

type Size = "sm" | "md";

type CircularAddToCartProps = {
  quantity: number;
  onIncrement: () => void | Promise<void>;
  isLoading?: boolean;
  /**
   * El caller decide la semántica: pasamos `!canAdd || !canIncrement` desde
   * afuera. Deshabilitar por `isLoading` bloquearía el click rápido — el hook
   * `useCartQuantityForVariant` ya encola/deltea los incrementos.
   */
  disabled?: boolean;
  canIncrement?: boolean;
  size?: Size;
  ariaLabel?: string;
  className?: string;
};

const sizeConfig: Record<Size, { button: string; icon: string; text: string }> = {
  sm: { button: "h-8 w-8", icon: "h-4 w-4", text: "text-xs" },
  md: { button: "h-11 w-11", icon: "h-5 w-5", text: "text-sm" },
};

export function CircularAddToCart({
  quantity,
  onIncrement,
  isLoading = false,
  disabled = false,
  canIncrement = true,
  size = "sm",
  ariaLabel = "Agregar al carrito",
  className,
}: CircularAddToCartProps) {
  const s = sizeConfig[size];

  const onClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    void onIncrement();
  };

  let content: ReactNode;
  if (quantity > 0) {
    content = (
      <span
        className={cn(
          "flex h-full w-full items-center justify-center rounded-full bg-[--primary-color] font-bold text-white",
          s.text,
        )}
      >
        {quantity}
      </span>
    );
  } else if (isLoading) {
    content = (
      <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-r-transparent" />
    );
  } else {
    content = <ShoppingCart className={cn(s.icon, "text-white")} />;
  }

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      disabled={disabled}
      title={!canIncrement ? "No hay más stock disponible" : undefined}
      className={cn(
        s.button,
        "inline-flex flex-shrink-0 items-center justify-center rounded-full border border-[--primary-color] bg-[--primary-color] text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      {content}
    </button>
  );
}

export default CircularAddToCart;
