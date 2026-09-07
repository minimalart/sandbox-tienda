"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus, Trash2, ShoppingCart } from "lucide-react";
import { cn } from "@lib/util/cn";
import { useTenant } from "@lib/site-config/context";

interface CartQuantitySelectorProps {
  quantity: number;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemove: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  /**
   * `false` cuando la cantidad ya llegó al stock disponible: apaga el "+" del
   * stepper. No afecta al botón de agregar (quantity 0), que se gobierna con
   * `disabled` desde la card según el stock del producto.
   */
  canIncrement?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeConfig = {
  sm: {
    // Objetivo tactil accesible: 44x44px en mobile (minimo recomendado); 40px
    // en desktop, donde se apunta con mouse.
    button: "h-11 w-11 sm:h-10 sm:w-10",
    icon: "h-5 w-5 sm:h-[18px] sm:w-[18px]",
    cartIcon: "h-5 w-5 sm:h-[18px] sm:w-[18px]",
    text: "text-sm min-w-7 sm:text-xs sm:min-w-6",
    gap: "gap-1",
    container: "px-1",
  },
  md: {
    button: "h-10 w-10",
    icon: "h-5 w-5",
    cartIcon: "h-5 w-5",
    text: "text-base min-w-8",
    gap: "gap-2",
    container: "px-2",
  },
  lg: {
    button: "h-12 w-12",
    icon: "h-6 w-6",
    cartIcon: "h-6 w-6",
    text: "text-lg min-w-10",
    gap: "gap-3",
    container: "px-3",
  },
};

export function CartQuantitySelector({
  quantity,
  onIncrement,
  onDecrement,
  onRemove,
  isLoading = false,
  disabled = false,
  canIncrement = true,
  size = "sm",
  className,
}: CartQuantitySelectorProps) {
  const tenant = useTenant();
  const config = sizeConfig[size];
  const isSportsTemplate = tenant.template === "sports";
  const radiusClass = isSportsTemplate ? "rounded-none" : "rounded-full";
  const shadowClass = isSportsTemplate ? "shadow-none" : "shadow-sm";

  const handleIncrement = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      onIncrement();
    }
  };

  const handleDecrement = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      onDecrement();
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      onRemove();
    }
  };

  return (
    // stopPropagation en el contenedor: si un click cae en un hueco del stepper
    // (padding, número) o entre frames de animación, NO se propaga a la card
    // contenedora (que en varias tarjetas abre el quick view). Los botones
    // igual frenan la propagación por su cuenta.
    <div
      className={cn("relative", className)}
      onClick={(e) => e.stopPropagation()}
    >
      <AnimatePresence mode="wait" initial={false}>
        {quantity === 0 ? (
          <motion.div
            key="add-only"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
          >
            <button
              onClick={handleIncrement}
              disabled={disabled}
              className={cn(
                config.button,
                "flex items-center justify-center",
                radiusClass,
                "border border-[--primary-color] bg-[--primary-color] text-white",
                shadowClass,
                "transition-all duration-200",
                isSportsTemplate ? "hover:opacity-80" : "hover:opacity-90 hover:shadow-md",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--primary-color] focus-visible:ring-offset-2",
                "disabled:opacity-50 disabled:cursor-not-allowed",
              )}
              aria-label="Agregar al carrito"
              type="button"
            >
              {isLoading ? (
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-r-transparent" />
              ) : (
                <ShoppingCart
                  className={cn(config.cartIcon, "text-white")}
                  strokeWidth={2}
                />
              )}
            </button>
          </motion.div>
        ) : (
          // UN solo tier para quantity >= 1 (antes había uno para 1 y otro para
          // 2+). Fusionarlos evita el remount en cada 1→2→3…: el botón "+" queda
          // SIEMPRE montado y clickeable, así el clickeo rápido no se pierde
          // esperando la animación de entrada del tier nuevo. El botón izquierdo
          // alterna tacho (qty 1) / menos (qty ≥ 2) sin desmontar el stepper.
          <motion.div
            key="stepper"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className={cn(
              "flex items-center",
              radiusClass,
              "border border-gray-300 bg-white",
              shadowClass,
              config.gap,
              config.container,
            )}
          >
            {quantity === 1 ? (
              <button
                onClick={handleRemove}
                disabled={disabled}
                className={cn(
                  config.button,
                  "flex items-center justify-center",
                  radiusClass,
                  "transition-colors duration-200",
                  "hover:bg-red-50",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                )}
                aria-label="Eliminar del carrito"
                type="button"
              >
                <Trash2
                  className={cn(config.icon, "text-red-600")}
                  strokeWidth={2}
                />
              </button>
            ) : (
              <button
                onClick={handleDecrement}
                disabled={disabled}
                className={cn(
                  config.button,
                  "flex items-center justify-center",
                  radiusClass,
                  "transition-colors duration-200",
                  "hover:bg-red-50",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                )}
                aria-label="Quitar una unidad"
                type="button"
              >
                <Minus
                  className={cn(config.icon, "text-red-600")}
                  strokeWidth={2.5}
                />
              </button>
            )}

            <motion.span
              key={quantity}
              className={cn(
                config.text,
                "font-semibold text-gray-900 text-center tabular-nums",
              )}
              initial={{ scale: 1.25, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.15 }}
              aria-live="polite"
              aria-atomic="true"
            >
              {quantity}
            </motion.span>

            <button
              onClick={handleIncrement}
              // Techo de stock: apagamos el "+" en vez de tragarnos clicks. Sin
              // esto el cliente clickeaba de más, el debounce mandaba una sola
              // cantidad imposible y el rollback lo devolvía al valor inicial.
              disabled={disabled || !canIncrement}
              aria-disabled={disabled || !canIncrement}
              title={!canIncrement ? "No hay más stock disponible" : undefined}
              className={cn(
                config.button,
                "flex items-center justify-center",
                radiusClass,
                "transition-colors duration-200",
                isSportsTemplate ? "hover:bg-gray-100" : "hover:bg-[var(--mc-green-pale)]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--primary-color] focus-visible:ring-offset-2",
                "disabled:opacity-50 disabled:cursor-not-allowed",
              )}
              aria-label="Agregar una unidad"
              type="button"
            >
              <Plus
                className={cn(config.icon, "text-[--primary-color]")}
                strokeWidth={2.5}
              />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
