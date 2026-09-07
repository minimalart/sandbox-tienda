"use client";

import { useCompare, type CompareProduct } from "@lib/hooks/use-compare";
import { triggerHaptic } from "@lib/util/haptics";
import { toast } from "@medusajs/ui";
import { GitCompareArrows } from "lucide-react";
import { useEffect, useState } from "react";

type CompareButtonProps = {
  product: CompareProduct;
  className?: string;
  size?: "sm" | "md";
  label?: string;
};

const CompareButton = ({
  product,
  className = "",
  size = "sm",
  label,
}: CompareButtonProps) => {
  const { isInCompare, toggleItem, items } = useCompare();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const active = mounted ? isInCompare(product.id) : false;
  const isFull = items.length >= 4 && !active;
  const iconSize = label ? "h-5 w-5" : size === "md" ? "h-5 w-5" : "h-4 w-4";
  const buttonSize = size === "md" ? "h-9 w-9" : "h-7 w-7";
  const title = active
    ? "Quitar de comparación"
    : isFull
      ? "Máximo 4 productos"
      : "Comparar";

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (isFull) return;
    triggerHaptic("light");
    toggleItem(product);
    // Feedback explícito: el panel flotante de comparación queda detrás del
    // quick view (z más alto), así que el usuario no ve que se agregó. El toast
    // se muestra por encima de todo y confirma la acción sin tapar el modal.
    if (active) {
      toast.info("Quitado de la comparación", {
        description: product.title ?? undefined,
        duration: 2500,
      });
    } else {
      toast.success("Agregado a la comparación", {
        description: `${items.length + 1} de 4 productos seleccionados`,
        duration: 2500,
      });
    }
  };

  if (label) {
    return (
      <button
        aria-pressed={active}
        className={`group flex items-center gap-2 font-semibold text-gray-900 text-sm transition-colors hover:text-[--primary-color] disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        disabled={isFull}
        onClick={handleClick}
        title={title}
        type="button"
      >
        <GitCompareArrows
          aria-hidden="true"
          className={`${iconSize} transition-colors ${
            active
              ? "text-[--primary-color]"
              : "text-gray-500 group-hover:text-[--primary-color]"
          }`}
        />
        {label}
      </button>
    );
  }

  return (
    <button
      aria-label={title}
      aria-pressed={active}
      className={`group relative z-10 flex items-center justify-center rounded-full transition-all duration-200 hover:scale-110 disabled:cursor-not-allowed disabled:opacity-60 ${buttonSize} ${className}`}
      disabled={isFull}
      onClick={handleClick}
      title={title}
      type="button"
    >
      <GitCompareArrows
        aria-hidden="true"
        className={`${iconSize} transition-colors ${
          active
            ? "text-[--primary-color]"
            : "text-gray-500 group-hover:text-[--primary-color]"
        }`}
      />
      <span className="-top-9 pointer-events-none absolute left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-950 px-2.5 py-1 font-semibold text-[11px] text-white shadow-lg group-hover:block">
        {title}
      </span>
    </button>
  );
};

export default CompareButton;
