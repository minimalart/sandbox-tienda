"use client";

import { useTenant } from "@lib/site-config/context";
import {
  FLOATING_LAYER,
  floatingObstacle,
} from "@lib/util/floating-obstacle";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import {
  Activity,
  Dumbbell,
  Flame,
  Footprints,
  type LucideIcon,
  Medal,
  Mountain,
  Target,
  Trophy,
  Volleyball,
  Waves,
  X,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Banner sticky de la home deportiva: accesos rápidos por deporte (preseteados
 * desde `assets.sports.sports`), con fondo del color primario de marca e íconos.
 * Aparece al hacer scroll y se puede cerrar. Se oculta en la tienda/PDP (que ya
 * tienen sus propios filtros). Reemplaza al BrandsStickyBanner genérico cuando
 * el template activo es "sports".
 */

// Íconos por deporte (componentes, no emoji). Inheritan currentColor → blancos
// sobre el fondo primario.
const SPORT_ICON: Record<string, LucideIcon> = {
  running: Footprints,
  training: Dumbbell,
  entrenamiento: Dumbbell,
  football: Trophy,
  futbol: Trophy,
  basketball: Activity,
  basket: Activity,
  tennis: Target,
  tenis: Target,
  padel: Target,
  outdoor: Mountain,
  natacion: Waves,
  voley: Volleyball,
  hockey: Activity,
  rugby: Trophy,
  lifestyle: Flame,
};

export default function SportsStickyFilters() {
  const tenant = useTenant();
  const pathname = usePathname() || "";
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const sports = tenant.assets.sports?.sports?.sports ?? [];
  // El color primario REAL de la marca (el wrapper .sports-home mapea
  // --primary-color a ink, por eso lo tomamos del tenant y lo aplicamos inline,
  // igual que el footer).
  const primaryColor = tenant.theme?.colors?.primary;

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 220);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // La tienda y la PDP ya tienen sus propios filtros: no estorbar ahí.
  const hideOnRoute =
    pathname.includes("/store") || pathname.includes("/products");

  if (dismissed || hideOnRoute || sports.length === 0 || !visible) {
    return null;
  }

  return (
    <div
      {...floatingObstacle("sports-sticky-filters", FLOATING_LAYER.edgeBar)}
      className="sports-home fixed inset-x-0 bottom-0 z-40 border-white/20 border-t bg-[--sp-ink] text-white shadow-[0_-10px_28px_rgba(0,0,0,0.4)]"
      style={primaryColor ? { backgroundColor: primaryColor } : undefined}
    >
      <div className="relative mx-auto flex max-w-[1600px] items-center justify-center gap-4 px-10 py-3 sm:px-12 lg:px-16">
        <span className="hidden shrink-0 text-[11px] font-bold uppercase tracking-[0.16em] text-white/70 sm:block">
          Comprá por deporte
        </span>
        <div className="sp-no-scrollbar flex min-w-0 items-center gap-4 overflow-x-auto sm:gap-2">
          {sports.map((sport) => {
            const Icon = SPORT_ICON[sport.id] ?? Medal;
            return (
              <LocalizedClientLink
                key={sport.id}
                href={sport.href}
                aria-label={sport.name}
                className="inline-flex shrink-0 items-center justify-center gap-2 border border-white/25 p-2 text-[12px] font-bold uppercase tracking-[0.08em] text-white transition hover:bg-white hover:text-[--sp-ink] sm:px-3 sm:py-1.5"
              >
                <Icon className="size-4" strokeWidth={2} aria-hidden />
                <span className="hidden sm:inline">{sport.name}</span>
              </LocalizedClientLink>
            );
          })}
        </div>
        <button
          type="button"
          aria-label="Cerrar"
          onClick={() => setDismissed(true)}
          className="absolute right-2 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center text-white/80 transition hover:text-white sm:right-4 lg:right-6"
        >
          <X className="size-4" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
