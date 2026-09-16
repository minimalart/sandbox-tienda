"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import CollapsedHeader from "./collapsed-header";
import type { CategoryNode } from "@lib/util/quick-suggestion-target";
import CollapsedHeaderMobile from "./collapsed-header-mobile";

type SmartHeaderProps = {
  topbar: React.ReactNode;
  nav: React.ReactNode;
  searchBar: React.ReactNode;
  isLoggedIn: boolean;
  avatarUrl?: string;
  initials?: string;
  /** Tintometría con carta cargada: muestra el link "Buscá tu color". */
  hasTinting?: boolean;
  hasSpaceDesigner?: boolean;
  /**
   * Árbol de categorías para el buscador del header flotante.
   *
   * Va por prop y no dentro de `searchBar` porque `collapsed-header` NO reusa ese
   * nodo: monta su propio `HeaderSearchBar` con estilos compactos. Sin esto, los
   * atajos "Explorar:" del header flotante se comportarían distinto que los del
   * header fijo (DESDEELSUR-61, BUG-11).
   */
  categories?: CategoryNode[];
};

export default function SmartHeader({
  topbar,
  nav,
  searchBar,
  isLoggedIn,
  avatarUrl,
  initials,
  hasTinting = false,
  hasSpaceDesigner = false,
  categories = [],
}: SmartHeaderProps) {
  const [hidden, setHidden] = useState(false);
  const pathname = usePathname();
  // En la PDP mobile el topbar promocional se saca: come ~40px de un viewport
  // chico y compite con el "Volver" y la foto del producto. En desktop sigue
  // igual, y en el resto de las páginas mobile también.
  const isProductsPage = pathname?.includes("/products") ?? false;
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  const onScroll = useCallback(() => {
    if (ticking.current) return;

    ticking.current = true;
    requestAnimationFrame(() => {
      const currentY = window.scrollY;
      const scrollingDown = currentY > lastScrollY.current;
      const pastThreshold = currentY > 80;

      if (currentY <= 0) {
        setHidden(false);
      } else if (scrollingDown && pastThreshold) {
        setHidden(true);
      }
      lastScrollY.current = currentY;
      ticking.current = false;
    });
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [onScroll]);

  return (
    <div
      className="sticky top-0 z-50 block transition-all duration-300 ease-in-out"
      style={hidden ? { pointerEvents: "none" } : undefined}
    >
      {/* Mobile: Topbar + Nav + SearchBar - se ocultan al scrollear */}
      <div
        className="bg-[color:var(--header-bg,rgba(255,255,255,0.95))] shadow-sm backdrop-blur supports-[backdrop-filter]:bg-[color:var(--header-bg,rgba(255,255,255,0.8))] transition-transform duration-300 ease-in-out will-change-transform lg:hidden"
        style={{
          transform: hidden ? "translateY(-100%)" : "translateY(0)",
        }}
      >
        {!isProductsPage && topbar}
        {nav}
        {searchBar}
      </div>

      {/* Desktop: Topbar + Nav + SearchBar - se ocultan al scrollear */}
      <div
        className="hidden bg-[color:var(--header-bg,rgba(255,255,255,0.95))] shadow-sm backdrop-blur supports-[backdrop-filter]:bg-[color:var(--header-bg,rgba(255,255,255,0.8))] transition-all duration-300 ease-in-out lg:block"
        style={{
          transform: hidden ? "translateY(-100%)" : "translateY(0)",
          opacity: hidden ? 0 : 1,
          pointerEvents: hidden ? "none" : "auto",
        }}
      >
        {topbar}
        {nav}
        {searchBar}
      </div>

      {/* Collapsed headers flotantes - aparecen al scrollear */}
      <div className="absolute inset-x-0 top-[10px] pointer-events-none">
        <CollapsedHeader
          avatarUrl={avatarUrl}
          categories={categories}
          hasTinting={hasTinting}
          hasSpaceDesigner={hasSpaceDesigner}
          initials={initials}
          isLoggedIn={isLoggedIn}
          visible={hidden}
        />
        <CollapsedHeaderMobile visible={hidden} />
      </div>
    </div>
  );
}
