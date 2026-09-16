"use client";

import {
  ChatBubbleOvalLeftIcon,
  HeartIcon,
  MapIcon,
  UserIcon,
} from "@heroicons/react/24/outline";
import { HeartIcon as HeartIconSolid } from "@heroicons/react/24/solid";
import { useAddToCartAnimation } from "@lib/context/add-to-cart-animation";
import {
  useDemoHref,
  useTenantBrand,
  useTenantSections,
} from "@lib/site-config/context";
import { useWishlist } from "@lib/hooks/use-wishlist";
import { useCartStore, selectTotalItems } from "@lib/stores/cart.store";
import { useWishlistDrawerStore } from "@lib/stores/wishlist-drawer.store";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import UserAvatar from "@modules/common/components/user-avatar";
import HeaderSearchBar from "@modules/layout/components/header-search-bar";
import type { CategoryNode } from "@lib/util/quick-suggestion-target";
import { ShoppingCart } from "lucide-react";
import { usePathname, useParams } from "next/navigation";
import { useMemo } from "react";

// Nav items con etiqueta. "Sucursales" y "Contacto" no están acá: en la pastilla
// flotante van como icono, junto al resto de los iconos de la derecha, para que
// entre "Buscá tu color" sin que la fila se desborde contra el buscador. En el
// header fijo, en cambio, los dos van con texto como el resto.
const navPages = [
  { name: "Tienda", href: "/store" },
  { name: "Lista de compras", href: "/lista-de-compras" },
  { name: "Recetas", href: "/blog" },
  { name: "Buscá tu color", href: "/colores" },
  { name: "Diseñá tu espacio", href: "/espacios" },
];

// Los mismos nav items, sin texto — sólo en este header. El icono es el que ya
// usa el menú mobile para cada destino, así el vocabulario visual es uno solo en
// todo el chrome.
const navIconPages = [
  { name: "Sucursales", href: "/sucursales", Icon: MapIcon },
  { name: "Contacto", href: "/contact", Icon: ChatBubbleOvalLeftIcon },
];

type CollapsedHeaderProps = {
  isLoggedIn: boolean;
  visible: boolean;
  avatarUrl?: string;
  initials?: string;
  /** Tintometría con carta cargada: muestra el link "Buscá tu color". */
  hasTinting?: boolean;
  hasSpaceDesigner?: boolean;
  /**
   * Árbol de categorías, sólo para el buscador embebido: sin él los atajos
   * "Explorar:" de ESTE header caerían en búsqueda de texto mientras los del header
   * normal navegan por categoría, y el mismo botón haría dos cosas distintas según
   * cuánto scrolleaste (DESDEELSUR-61, BUG-11).
   */
  categories?: CategoryNode[];
};

export default function CollapsedHeader({
  isLoggedIn,
  visible,
  avatarUrl,
  initials,
  hasTinting = false,
  hasSpaceDesigner = false,
  categories = [],
}: CollapsedHeaderProps) {
  const pathname = usePathname();
  const { countryCode } = useParams() as { countryCode: string };
  // En demos el path real lleva el prefijo /demo/{slug}; comparamos contra el
  // href ya prefijado para que el link activo se marque también ahí.
  const demoHref = useDemoHref();
  const { name: brandName, logos } = useTenantBrand();
  const {
    blogSectionName,
    isBlogVisible,
    isContactVisible,
    isShoppingListVisible,
    isSucursalesVisible,
    isTintingHidden,
  } = useTenantSections();
  const isPageVisible = (href: string) => {
    if (href === "/blog") return isBlogVisible;
    if (href === "/contact") return isContactVisible;
    if (href === "/lista-de-compras") return isShoppingListVisible;
    if (href === "/sucursales") return isSucursalesVisible;
    // "Buscá tu color" es OPT-IN, al revés que el resto: sólo aparece donde el
    // tintométrico está prendido y con carta cargada (lo resuelve el layout). El
    // flag del tenant sirve para esconderlo, no para prenderlo.
    if (href === "/colores") return hasTinting && !isTintingHidden;
    if (href === "/espacios") return hasSpaceDesigner;
    return true;
  };
  const visibleNavPages = navPages.filter((p) => isPageVisible(p.href));
  const visibleNavIconPages = navIconPages.filter((p) => isPageVisible(p.href));
  // Compartido por los links con texto y los de icono: el path real dentro de un
  // demo lleva el prefijo /demo/{slug}, así que comparamos contra el href prefijado.
  const isHrefActive = (href: string) => {
    const currentPath = pathname || "/";
    const target = demoHref(href);
    return (
      currentPath === target ||
      (href !== "/" && currentPath.startsWith(target + "/"))
    );
  };
  const { cartBounce, registerCartIcon, registerWishlistIcon, wishlistBounce } =
    useAddToCartAnimation();
  const openWishlistDrawer = useWishlistDrawerStore((state) => state.open);
  const { items: wishlistItems } = useWishlist();

  const openCart = useCartStore((state) => state.openCart);
  const cartCount = useCartStore(selectTotalItems);
  const hasCartItems = cartCount > 0;
  const hasWishlistItems = wishlistItems.length > 0;
  const cartCountLabel = cartCount > 9 ? "9+" : `${cartCount}`;

  const cartBadge = useMemo(() => {
    if (!hasCartItems) return null;
    return (
      <span className="-top-1 -right-1 absolute inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[--primary-color] px-1 font-semibold text-[10px] text-white">
        {cartCountLabel}
      </span>
    );
  }, [cartCountLabel, hasCartItems]);

  return (
    <div
      className="pointer-events-auto hidden lg:flex justify-center sticky top-0 z-50 bg-[color:var(--header-bg,rgba(255,255,255,0.95))] shadow-sm backdrop-blur supports-[backdrop-filter]:bg-[color:var(--header-bg,rgba(255,255,255,0.9))] transition-all duration-300 ease-in-out max-w-[1100px] mx-auto rounded-full"
      style={{
        transform: visible ? "translateY(0)" : "translateY(-100%)",
        opacity: visible ? 1 : 0,
      }}
    >
      <div className="w-full px-6">
        <div className="flex h-12 items-center gap-4">
          {/* Logo — capped a la altura del input compacto del buscador
              (py-1.5 text-xs ≈ 30px) para que no lo supere en el header flotante. */}
          <LocalizedClientLink className="flex-shrink-0" href="/">
            <img
              alt={brandName}
              className="w-auto"
              style={{ height: "1.75rem" }}
              src={logos?.main || "/logos-mercatto/logocompleto-verde.svg"}
            />
          </LocalizedClientLink>

          <span className="h-5 w-px bg-gray-300 flex-shrink-0" />

          {/* Search bar (reuse) */}
          <div className="flex-1 max-w-md [&_div]:p-0 [&_input]:py-1.5 [&_input]:text-xs [&_[data-ghost-overlay]]:!py-1.5 [&_[data-ghost-overlay]]:!pl-9 [&_[data-ghost-overlay]]:text-xs [&_.hidden]:!hidden">
            <HeaderSearchBar categories={categories} />
          </div>

          <span className="h-5 w-px bg-gray-300 flex-shrink-0" />

          {/* Navigation links */}
          <nav className="flex items-center gap-1">
            {visibleNavPages.map((page) => {
              const isActive = isHrefActive(page.href);
              const label =
                page.href === "/blog" && blogSectionName
                  ? blogSectionName
                  : page.name;

              return (
                <LocalizedClientLink
                  aria-current={isActive ? "page" : undefined}
                  // El header flotante es una pastilla redondeada: acá el activo
                  // se marca con un chip (no con subrayado como en el header fijo).
                  className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[14px] leading-4 transition-all duration-200 ease-in-out antialiased ${
                    isActive
                      ? "text-[--primary-color] font-semibold"
                      : "text-[#374151] font-normal hover:bg-gray-100 hover:text-[--primary-color]"
                  }`}
                  href={page.href}
                  key={page.name}
                  // El tinte del chip va inline con color-mix: Tailwind 3 no
                  // aplica el modificador de opacidad sobre --primary-color.
                  style={{
                    fontFamily: "var(--font-roboto), Roboto, sans-serif",
                    ...(isActive
                      ? {
                          backgroundColor:
                            "color-mix(in srgb, var(--primary-color) 12%, white)",
                          boxShadow:
                            "inset 0 0 0 1px color-mix(in srgb, var(--primary-color) 24%, white)",
                        }
                      : {}),
                  }}
                >
                  {label}
                </LocalizedClientLink>
              );
            })}
          </nav>

          <span className="h-5 w-px bg-gray-300 flex-shrink-0" />

          {/* Action icons */}
          <div className="flex flex-shrink-0 items-center ml-auto">
            {/* Sucursales y Contacto: nav items sin etiqueta, acá y sólo acá
                (en el header fijo van con texto). Viven en el grupo de la
                derecha, con el mismo tamaño y color que el resto de los
                iconos, para que la fila lea como una sola. */}
            {visibleNavIconPages.map(({ Icon, href, name }) => {
              const isActive = isHrefActive(href);

              return (
                <LocalizedClientLink
                  aria-current={isActive ? "page" : undefined}
                  className={`flex items-center justify-center rounded-full p-2 transition-colors duration-200 ${
                    isActive
                      ? "text-[--primary-color]"
                      : "text-gray-400 hover:text-[--primary-color]"
                  }`}
                  href={href}
                  key={name}
                  title={name}
                >
                  <Icon aria-hidden="true" className="size-5" />
                  <span className="sr-only">{name}</span>
                </LocalizedClientLink>
              );
            })}

            {/* Wishlist */}
            <button
              className="group relative flex items-center justify-center rounded-full p-2 text-gray-400 transition-colors duration-200 hover:text-[--primary-color]"
              onClick={openWishlistDrawer}
              ref={(el) => registerWishlistIcon(el)}
              type="button"
            >
              {hasWishlistItems ? (
                <HeartIconSolid
                  aria-hidden="true"
                  className={`size-5 text-rose-500 transition-transform duration-200 ${
                    wishlistBounce ? "animate-bounce" : ""
                  }`}
                />
              ) : (
                <HeartIcon
                  aria-hidden="true"
                  className={`size-5 transition-colors duration-200 group-hover:text-[--primary-color] ${
                    wishlistBounce ? "animate-bounce text-rose-500" : ""
                  }`}
                />
              )}
              <span className="sr-only">Favoritos</span>
            </button>

            {/* Cart */}
            <button
              className="group relative flex items-center p-2 text-gray-400 transition-colors duration-200 hover:text-gray-600"
              onClick={openCart}
              ref={(el) => registerCartIcon(el)}
              type="button"
            >
              <ShoppingCart
                aria-hidden="true"
                className={`size-5 shrink-0 transition-transform group-hover:text-gray-600 ${
                  cartBounce ? "animate-bounce" : ""
                }`}
                style={
                  cartBounce
                    ? { animation: "bounce 0.3s ease-in-out" }
                    : undefined
                }
              />
              {cartBadge}
              <span className="sr-only">Carrito</span>
            </button>

            {/* Account */}
            <LocalizedClientLink
              className="group flex items-center rounded-full p-2 text-gray-400 transition-colors duration-200 hover:text-[--primary-color]"
              href="/account"
            >
              {isLoggedIn ? (
                <UserAvatar
                  alt="Foto de perfil"
                  avatarUrl={avatarUrl}
                  className="text-[11px]"
                  initials={initials ?? "?"}
                  size={20}
                />
              ) : (
                <UserIcon
                  aria-hidden="true"
                  className="size-5 transition-colors duration-200 group-hover:text-[--primary-color]"
                />
              )}
              <span className="sr-only">Mi cuenta</span>
            </LocalizedClientLink>
          </div>
        </div>
      </div>
    </div>
  );
}
