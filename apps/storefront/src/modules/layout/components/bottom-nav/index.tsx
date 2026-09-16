"use client";

import { useAddToCartAnimation } from "@lib/context/add-to-cart-animation";
import { useHasActivePromotions } from "@lib/context/promotions-availability";
import { useTenantBrand, useTenantSections } from "@lib/site-config/context";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import {
  Bars3Icon,
  BuildingStorefrontIcon,
  ChatBubbleOvalLeftIcon,
  HomeIcon,
  MapPinIcon,
  NewspaperIcon,
  SwatchIcon,
  TagIcon,
} from "@heroicons/react/24/outline";
import {
  FLOATING_LAYER,
  floatingObstacle,
} from "@lib/util/floating-obstacle";
import { triggerHaptic } from "@lib/util/haptics";
import { useSitePrefix } from "@lib/site-config/context";
import { stripSitePrefix } from "@lib/site-config/site-path";
import { usePathname, useSearchParams } from "next/navigation";
import type { ComponentType, SVGProps } from "react";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ShoppingCart } from "lucide-react";
import { resolveNavIcon } from "./nav-icon";
import {
  pickMobileNavSlot,
  resolveMobileNavDisplay,
  resolveMobileNavOrder,
} from "./slots";
import type { MobileNavDisplay, MobileNavSlotId } from "@lib/site-config/types";

type BottomNavItem = {
  id: string;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>> | string;
  href?: string;
  action?: "menu" | "cart";
  /**
   * Sólo el ítem flexible: 'text' dibuja el label sin ícono. Los cuatro fijos
   * son siempre ícono — home y carrito son círculos y el menú es la
   * hamburguesa, así que no hay nada que elegir ahí.
   */
  display?: MobileNavDisplay;
};

/**
 * Los cuatro ítems FIJOS. El quinto lugar — entre el carrito y el menú — es el
 * único configurable y lo resuelve `FLEX_SLOTS` + el orden de la tienda; ver
 * `slots.ts` para el por qué.
 */
const fixedNavItems: BottomNavItem[] = [
  { id: "home", label: "", href: "/", Icon: HomeIcon },
  { id: "store", label: "Tienda", href: "/store", Icon: BuildingStorefrontIcon },
  { id: "cart", label: "Carrito", action: "cart", Icon: ShoppingCart },
  { id: "menu", label: "Menu", action: "menu", Icon: Bars3Icon },
];

/** Índice en `fixedNavItems` donde se inserta el ítem flexible. */
const FLEX_SLOT_INDEX = 3;

/**
 * Cómo se dibuja cada candidato del lugar flexible. Los labels son cortos a
 * propósito: la barra tiene 5 columnas y el texto va en 10px.
 */
const FLEX_SLOTS: Record<
  MobileNavSlotId,
  { label: string; href: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }
> = {
  promos: { label: "Promos", href: "/store?promos=1", Icon: TagIcon },
  colores: { label: "Colores", href: "/colores", Icon: SwatchIcon },
  sucursales: { label: "Sucursales", href: "/sucursales", Icon: MapPinIcon },
  blog: { label: "Blog", href: "/blog", Icon: NewspaperIcon },
  contacto: { label: "Contacto", href: "/contact", Icon: ChatBubbleOvalLeftIcon },
};

/** Cuántas columnas pinta la barra. Tailwind necesita las clases literales. */
const GRID_COLS: Record<number, string> = {
  4: "grid-cols-4",
  5: "grid-cols-5",
};

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(" ");
}

type BottomNavProps = {
  cartCount?: number;
  cartBounce?: boolean;
  hidden?: boolean;
  /**
   * Tintométrico prendido Y con carta importada. Es un dato de RUNTIME que sólo
   * conoce el server (`tintingGate.catalogReady`), no un flag de config: sin
   * carta, "Buscá tu color" no tiene nada que mostrar. Por eso el candidato
   * `colores` del lugar flexible es el único que necesita esta prop.
   */
  hasTinting?: boolean;
  onCartClick?: () => void;
  onMenuClick?: () => void;
};

const BottomNav = ({
  cartCount = 0,
  cartBounce = false,
  hidden = false,
  hasTinting = false,
  onCartClick,
  onMenuClick,
}: BottomNavProps) => {
  const [mounted, setMounted] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const pathname = usePathname();
  const sitePrefix = useSitePrefix();
  const searchParams = useSearchParams();
  const { registerCartIcon } = useAddToCartAnimation();
  const { name, logos } = useTenantBrand();
  const {
    blogSectionName,
    isBlogVisible,
    isContactVisible,
    isSucursalesVisible,
    isTintingHidden,
    mobileNav,
    mobileNavDisplay,
  } = useTenantSections();
  // Sin promociones activas en el canal, "Promos" no se ofrece: la PLP filtrada
  // saldría vacía. Antes eso dejaba la barra en 4 columnas con el carrito
  // descentrado; ahora sólo hace que el lugar flexible pase al siguiente
  // candidato del orden que configuró la tienda.
  const hasActivePromotions = useHasActivePromotions();

  const flexSlotId = pickMobileNavSlot(
    resolveMobileNavOrder(mobileNav),
    (id) => {
      switch (id) {
        case "promos":
          return hasActivePromotions;
        case "colores":
          // Opt-in: `isTintingHidden` alcanza para esconderla en un tenant que
          // SÍ tiene tintometría, no para prenderla en uno que no.
          return hasTinting && !isTintingHidden;
        case "sucursales":
          return isSucursalesVisible;
        case "blog":
          return isBlogVisible;
        case "contacto":
          return isContactVisible;
      }
    },
  );

  const visibleItems: BottomNavItem[] = [...fixedNavItems];
  if (flexSlotId) {
    const slot = FLEX_SLOTS[flexSlotId];
    visibleItems.splice(FLEX_SLOT_INDEX, 0, {
      id: flexSlotId,
      // El blog se llama distinto en cada tienda ("Recetas", "Notas"…), y el
      // label de la barra tiene que decir lo mismo que el del menú.
      label: flexSlotId === "blog" ? blogSectionName || slot.label : slot.label,
      href: slot.href,
      Icon: slot.Icon,
      display: resolveMobileNavDisplay(mobileNavDisplay, flexSlotId),
    });
  }

  const cartIconRefCallback = useCallback(
    (el: HTMLDivElement | null) => {
      if (typeof window !== "undefined" && window.innerWidth < 1024 && el) {
        registerCartIcon(el);
      }
    },
    [registerCartIcon],
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  // Una vez que la navegación resolvió (cambió la ruta/los query params),
  // descartamos el estado activo optimista para volver al cálculo real.
  useEffect(() => {
    setPendingId(null);
  }, [pathname, searchParams]);

  // Antes esto se hacía a mano por segmentos, con `pathSegments[0]?.length === 2`
  // para el país — el mismo footgun que el regex `[a-z]{2}`: se comía cualquier
  // primer segmento de dos letras. Ahora usa el helper único, que compara el país
  // EXACTO contra NEXT_PUBLIC_COUNTRY_CODE.
  const currentPath = stripSitePrefix(pathname || "/", sitePrefix);

  const isItemActive = (item: BottomNavItem) => {
    if (item.id === "promos") {
      return currentPath === "/store" && searchParams.get("promos") === "1";
    }
    if (item.id === "store" && searchParams.get("promos") === "1") {
      return false;
    }
    if (item.href) {
      if (item.href === "/") {
        return currentPath === "/";
      }
      return currentPath.startsWith(item.href);
    }
    return false;
  };

  const handleItemClick = (item: BottomNavItem) => {
    triggerHaptic("light");
    if (item.action === "cart") {
      onCartClick?.();
    } else if (item.action === "menu") {
      onMenuClick?.();
    }
  };

  const navIconSrc = resolveNavIcon(logos);

  const isProductsPage = pathname?.includes("/products");

  if (!mounted || hidden || isProductsPage) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-x-0 bottom-0 z-[9999] border-t border-gray-200 bg-white shadow-lg lg:hidden"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      {...floatingObstacle("bottom-nav", FLOATING_LAYER.edgeBar)}
    >
      <div
        className={classNames(
          "mx-auto grid w-full items-center",
          // 5 con el lugar flexible resuelto; 4 sólo si NINGÚN candidato
          // aplica (ver `pickMobileNavSlot`).
          GRID_COLS[visibleItems.length] ?? "grid-cols-4",
        )}
        style={{ height: "64px" }}
      >
        {visibleItems.map((item) => {
          const Icon = item.Icon;
          // Estado activo optimista: si el ítem fue tocado, se marca activo de
          // inmediato (pendingId) sin esperar a que termine la navegación.
          const active =
            pendingId === item.id ||
            (pendingId === null && isItemActive(item));
          const isHome = item.id === "home";
          // Sólo el ítem flexible puede venir en modo texto; los fijos no traen
          // `display`.
          const textOnly = item.display === "text";
          const isCart = item.id === "cart";
          const baseClasses = classNames(
            "relative inline-flex h-full flex-col items-center gap-1 text-xs transition-transform duration-150 ease-out",
            "touch-manipulation select-none [-webkit-tap-highlight-color:transparent]",
            "active:scale-90",
            isCart ? "justify-end pb-2.5" : "justify-center",
            active ? "text-[--primary-color]" : "text-gray-500",
          );
          const hasCartItems = cartCount > 0;
          const cartCountLabel = cartCount > 9 ? "9+" : `${cartCount}`;

          const iconNode = isHome ? (
            // El círculo es SIEMPRE blanco y el estado activo se marca con un
            // outline, no con un fondo sólido: el fondo pleno tapaba el isotipo
            // (positivo oscuro sobre primary) y era el único ítem de la barra
            // que cambiaba de superficie.
            <div
              className={classNames(
                "flex h-[50px] w-[50px] items-center justify-center rounded-full bg-white transition-shadow",
                active ? "ring-2 ring-[--primary-color]" : "ring-1 ring-gray-200",
              )}
            >
              <img
                alt={`${name} Logo`}
                className="h-7 w-7 object-contain"
                src={navIconSrc}
              />
            </div>
          ) : isCart ? (
            <div
              ref={cartIconRefCallback}
              className="-translate-x-1/2 absolute -top-5 left-1/2 flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-lg ring-1 ring-gray-100"
            >
              <Icon
                aria-hidden="true"
                className={`h-6 w-6 text-[--primary-color] ${cartBounce ? "animate-bounce" : ""}`}
              />
              {hasCartItems && (
                <span className="-top-1 -right-1 absolute inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                  {cartCountLabel}
                </span>
              )}
            </div>
          ) : typeof Icon === "string" ? (
            <img alt={item.label || "Inicio"} className="h-7 w-7" src={Icon} />
          ) : (
            <Icon aria-hidden="true" className="h-6 w-6" />
          );

          // Home and cart render their circular icons directly. Wrapping them
          // in the highlight pill (used for the text items) distorts their
          // proportions, so only the plain nav items get the active pill.
          const content =
            isHome || isCart ? (
              <>
                {iconNode}
                {item.label && (
                  <span
                    className={classNames(
                      "text-[10px] leading-tight",
                      active ? "font-semibold" : "font-medium"
                    )}
                  >
                    {item.label}
                  </span>
                )}
              </>
            ) : (
              <span
                className={classNames(
                  "flex min-h-[52px] min-w-[58px] flex-col items-center justify-center gap-1 rounded-2xl px-2 py-1.5 transition-colors",
                  active ? "text-[--primary-color]" : "text-inherit active:bg-gray-100"
                )}
                style={
                  active
                    ? {
                        backgroundColor:
                          "color-mix(in srgb, var(--primary-color) 12%, white)",
                        boxShadow:
                          "inset 0 0 0 1px color-mix(in srgb, var(--primary-color) 22%, white)",
                      }
                    : undefined
                }
              >
                {/*
                  `display: 'text'` (elegido por tienda en la ficha) dibuja sólo
                  el label: sin el ícono la celda queda vacía arriba, así que el
                  texto sube un punto y se centra en toda la altura de la píldora.
                */}
                {textOnly ? null : iconNode}
                {item.label && (
                  <span
                    className={classNames(
                      // `max-w` + truncate: el label del lugar flexible puede ser
                      // el nombre del blog de la tienda, que es texto libre.
                      "max-w-[64px] truncate leading-tight",
                      textOnly ? "text-[11px]" : "text-[10px]",
                      active ? "font-semibold" : "font-medium"
                    )}
                  >
                    {item.label}
                  </span>
                )}
              </span>
            );

          if (item.href) {
            return (
              <LocalizedClientLink
                className={baseClasses}
                href={item.href}
                key={item.id}
                onClick={() => {
                  triggerHaptic("light");
                  setPendingId(item.id);
                }}
              >
                {content}
              </LocalizedClientLink>
            );
          }

          return (
            <button
              className={baseClasses}
              key={item.id}
              onClick={() => handleItemClick(item)}
              type="button"
            >
              {content}
            </button>
          );
        })}
      </div>
    </div>,
    document.body,
  );
};

export default BottomNav;
