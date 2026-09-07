"use client";

import { useAddToCartAnimation } from "@lib/context/add-to-cart-animation";
import { useWishlist } from "@lib/hooks/use-wishlist";
import { useTenant } from "@lib/site-config/context";
import { triggerHaptic } from "@lib/util/haptics";
import { toast } from "@medusajs/ui";
import { useCallback, useEffect, useState } from "react";

type WishlistButtonProps = {
  productId: string;
  variantId: string;
  className?: string;
  size?: "sm" | "md";
  /**
   * Si se pasa, el botón rinde icono + este texto como UNA sola área clickeable
   * (con hover), en vez del botón redondo solo-icono. Útil en la quick view.
   */
  label?: string;
};

const WishlistButton = ({
  productId,
  variantId,
  className = "",
  size = "sm",
  label,
}: WishlistButtonProps) => {
  const tenant = useTenant();
  const { isInWishlist, toggleItem } = useWishlist();
  const { triggerWishlistAnimation } = useAddToCartAnimation();
  const isSportsTemplate = tenant.template === "sports";
  
  // Use state to avoid hydration mismatch
  const [mounted, setMounted] = useState(false);
  const [active, setActive] = useState(false);

  // Update active state after component mounts (client-side only)
  useEffect(() => {
    setMounted(true);
    setActive(isInWishlist(productId, variantId));
  }, [isInWishlist, productId, variantId]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      triggerHaptic("light");
      if (isSportsTemplate) {
        // En sports reemplazamos la animación de "volar al header" por un toast.
        if (active) {
          toast.info("Quitado de favoritos", { duration: 2200 });
        } else {
          toast.success("Añadido a favoritos", { duration: 2200 });
        }
      } else if (!active) {
        triggerWishlistAnimation(e.currentTarget as HTMLElement);
      }
      toggleItem(productId, variantId);
      setActive(!active);
    },
    [active, triggerWishlistAnimation, productId, variantId, toggleItem]
  );

  const sizeClasses = size === "md" ? "h-9 w-9" : "h-7 w-7";
  const iconSize = label ? "h-5 w-5" : size === "md" ? "h-5 w-5" : "h-4 w-4";

  // Render with default state until mounted to match server HTML
  const displayActive = mounted ? active : false;

  const heart = (
    <svg
      className={`${iconSize} transition-all duration-200 ${
        displayActive
          ? "fill-[--primary-color] text-[--primary-color]"
          : "fill-none text-gray-500 group-hover:text-[--primary-color]"
      }`}
      fill={displayActive ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={displayActive ? 0 : 1.8}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  // Variante con texto: icono + label como una sola área clickeable (con hover),
  // pensada para la quick view (a la par del botón "Compartir").
  if (label) {
    return (
      <button
        aria-label={displayActive ? "Quitar de favoritos" : "Agregar a favoritos"}
        className={`group flex items-center gap-2 font-semibold text-gray-900 text-sm transition-colors hover:text-[--primary-color] ${className}`}
        onClick={handleClick}
        type="button"
      >
        {heart}
        {label}
      </button>
    );
  }

  return (
    <button
      aria-label={displayActive ? "Quitar de favoritos" : "Agregar a favoritos"}
      className={`group z-10 flex items-center justify-center transition-all duration-200 ${
        isSportsTemplate
          ? "rounded-none hover:opacity-70"
          : "rounded-full hover:scale-110"
      } ${sizeClasses} ${className}`}
      onClick={handleClick}
      type="button"
    >
      {heart}
    </button>
  );
};

export default WishlistButton;
