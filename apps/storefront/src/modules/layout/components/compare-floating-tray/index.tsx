"use client";

import { useCompare } from "@lib/hooks/use-compare";
import { useTenant } from "@lib/site-config/context";
import { cn } from "@lib/util/cn";
import {
  FLOATING_LAYER,
  floatingObstacle,
} from "@lib/util/floating-obstacle";
import {
  PLACEHOLDER_IMAGE,
  handleImageError,
} from "@lib/util/placeholder-image";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import { GitCompareArrows, X } from "lucide-react";

const CompareFloatingTray = () => {
  const { items, removeItem, clear, isLoaded } = useCompare();
  const tenant = useTenant();
  // El tray se monta FUERA del wrapper `.sports-home`, así que no hereda los
  // tokens --sp-* ni el aplanado de bordes; aplicamos la clase a la raíz para
  // traer la identidad sports (bordes rectos, ink/blanco) cuando corresponde.
  const isSports = tenant.template === "sports";

  if (!isLoaded || items.length === 0) {
    return null;
  }

  return (
    <div
      {...floatingObstacle("compare-tray", FLOATING_LAYER.tray)}
      className={cn(
        "fixed right-3 bottom-36 z-[49] w-[calc(100vw-1.5rem)] max-w-[430px] border bg-white/95 p-3 backdrop-blur lg:right-6 lg:bottom-24",
        isSports
          ? "sports-home rounded-none border-[--sp-ink]"
          : "rounded-2xl border-gray-200 shadow-2xl",
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center bg-[--primary-color] text-white",
            isSports ? "rounded-none" : "rounded-full",
          )}
        >
          <GitCompareArrows className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-950 text-sm">
            Comparación de productos
          </p>
          <p className="text-gray-500 text-xs">
            {items.length} de 4 seleccionados
          </p>
        </div>
        <button
          className={cn(
            "px-2 py-1 font-medium text-gray-500 text-xs transition hover:bg-gray-100 hover:text-gray-900",
            isSports ? "rounded-none" : "rounded-full",
          )}
          onClick={clear}
          type="button"
        >
          Limpiar
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className={cn("flex min-w-0 flex-1", isSports ? "gap-2" : "-space-x-2")}>
          {items.map((item) => (
            <div
              className={cn(
                "group relative h-11 w-11 shrink-0 overflow-hidden border-2 bg-gray-100",
                isSports
                  ? "rounded-none border-[--sp-hairline]"
                  : "rounded-full border-white shadow-sm",
              )}
              key={item.id}
              title={item.title}
            >
              <img
                alt={item.title}
                className="h-full w-full object-contain"
                onError={handleImageError}
                src={item.thumbnail || PLACEHOLDER_IMAGE}
              />
              <button
                aria-label={`Quitar ${item.title}`}
                className="absolute inset-0 hidden items-center justify-center bg-black/45 text-white group-hover:flex"
                onClick={() => removeItem(item.id)}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <LocalizedClientLink
          className={cn(
            "inline-flex h-10 shrink-0 items-center justify-center px-4 font-semibold text-sm transition",
            isSports
              ? "rounded-none border-2 border-[--sp-ink] bg-[--sp-ink] uppercase tracking-[0.06em] text-[--sp-on-dark] hover:bg-transparent hover:text-[--sp-ink]"
              : "rounded-full bg-[--primary-color] text-white hover:bg-[--primary-color-dark]",
          )}
          href="/comparar"
        >
          Comparar
        </LocalizedClientLink>
      </div>
    </div>
  );
};

export default CompareFloatingTray;
