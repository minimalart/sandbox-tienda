"use client";

import { useWishlist } from "@lib/hooks/use-wishlist";
import { useTenant } from "@lib/site-config/context";
import type { TopbarIconType } from "@lib/site-config/types";
import { selectTotalItems, useCartStore } from "@lib/stores/cart.store";
import { useWishlistDrawerStore } from "@lib/stores/wishlist-drawer.store";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import UserAvatar from "@modules/common/components/user-avatar";
import SportsSearchOverlay from "@modules/home-sports/components/sports-search-overlay";
import { iconMap as topbarIconMap } from "@modules/home/components/topbar";
import { Heart, Menu, Search, ShoppingBag, User, X } from "lucide-react";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import "../../sports-theme.css";

type SportsHeaderProps = {
  initialCartCount?: number;
  isLoggedIn?: boolean;
  hasSpaceDesigner?: boolean;
  avatarUrl?: string;
  initials?: string;
};

/**
 * Header del template Marca Deportiva.
 *
 * Simple y minimalista (Adidas / Nike): wordmark a la izquierda, navegación
 * principal centrada en mayúsculas y accesos discretos a la derecha. La
 * búsqueda se abre como overlay. Sustituye al SmartHeader solo cuando el
 * template activo es "sports".
 */
export default function SportsHeader({
  initialCartCount = 0,
  isLoggedIn = false,
  hasSpaceDesigner = false,
  avatarUrl,
  initials = "?",
}: SportsHeaderProps) {
  const tenant = useTenant();
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const currentQ = searchParams.get("q");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  // Megamenú abierto (id del ítem).
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  // Un link está activo si su query coincide con la actual (o si su menú está
  // abierto). La home (`/`) no marca nada.
  const isActiveNav = (href: string) => {
    const qMatch = href.match(/[?&]q=([^&]+)/);
    if (qMatch) return currentQ === decodeURIComponent(qMatch[1]);
    // "/store" sin query (Ofertas): activo solo en /store sin q.
    if (href.endsWith("/store")) return pathname.includes("/store") && !currentQ;
    return false;
  };

  const liveCount = useCartStore(selectTotalItems);
  const openCart = useCartStore((state) => state.openCart);
  const cartCount = liveCount || initialCartCount;

  // Corazón relleno cuando hay al menos un favorito.
  const { items: wishlistItems } = useWishlist();
  const hasWishlist = wishlistItems.length > 0;
  const openWishlistDrawer = useWishlistDrawerStore((state) => state.open);

  const header = tenant.assets.sports?.header;
  const nav = [...(header?.nav ?? [])];
  if (hasSpaceDesigner && !nav.some((item) => item.href === "/espacios")) {
    nav.push({ id: "space-designer", name: "Diseñá tu espacio", href: "/espacios" });
  }
  const placeholder = header?.searchPlaceholder ?? "Buscar";
  const logo = tenant.assets.logos?.main;

  // Top bar de anuncios (color secundario). Rota los mensajes del tenant.
  const topbar = tenant.assets.topbar;
  const topMessages =
    topbar?.enabled === false ? [] : (topbar?.messages ?? []);
  const [topIndex, setTopIndex] = useState(0);
  const [topDismissed, setTopDismissed] = useState(false);
  useEffect(() => {
    if (topMessages.length <= 1) return;
    const interval = topbar?.rotationInterval ?? 5000;
    const id = setInterval(
      () => setTopIndex((i) => (i + 1) % topMessages.length),
      interval,
    );
    return () => clearInterval(id);
  }, [topMessages.length, topbar?.rotationInterval]);

  return (
    <header
      className="sports-home sticky top-0 z-50 border-b-2 border-[--sp-ink] bg-[color:var(--header-bg,var(--sp-paper))]"
      onMouseLeave={() => setActiveMenu(null)}
    >
      {!topDismissed &&
        topMessages.length > 0 &&
        (() => {
          const msg = topMessages[topIndex];
          const Icon = topbarIconMap[msg?.icon as TopbarIconType];
          return (
            <div className="bg-[--secondary-color] text-[--sp-on-dark]">
              <div className="relative mx-auto flex h-9 max-w-[1600px] items-center justify-center gap-2 px-12 sm:px-14 lg:px-16">
                {Icon && (
                  <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-current/10">
                    <Icon aria-hidden className="size-3.5" />
                  </span>
                )}
                <p className="truncate text-center text-[11px] font-bold uppercase tracking-[0.14em]">
                  {msg?.text}
                </p>
                <button
                  type="button"
                  aria-label="Cerrar barra superior"
                  onClick={() => setTopDismissed(true)}
                  className="absolute right-2 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center text-current/85 transition hover:text-current sm:right-4 lg:right-6"
              >
                  <X className="size-4" strokeWidth={2} />
                </button>
              </div>
            </div>
          );
        })()}
      <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-3 sm:px-6 lg:px-10">
        {/* Izquierda: wordmark + menu mobile */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            aria-label="Abrir menú"
            className="-ml-1 inline-flex size-9 items-center justify-center text-[--sp-ink] lg:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="size-6" strokeWidth={2} />
          </button>
          <LocalizedClientLink
            href="/"
            aria-label={tenant.name}
            className="flex items-center"
          >
            {logo ? (
              <Image
                src={logo}
                alt={tenant.name}
                width={128}
                height={30}
                className="h-7 w-auto object-contain sm:h-8"
                unoptimized={/^https?:\/\//i.test(logo)}
                priority
              />
            ) : (
              <span className="sp-display text-xl sm:text-2xl">{tenant.name}</span>
            )}
          </LocalizedClientLink>
        </div>

        {/* Centro: nav (desktop) */}
        <nav className="hidden lg:block">
          <ul className="flex items-center gap-8">
            {nav.map((item) => {
              const active = isActiveNav(item.href) || activeMenu === item.id;
              return (
                <li
                  key={item.id}
                  onMouseEnter={() =>
                    setActiveMenu(item.megamenu ? item.id : null)
                  }
                >
                  <LocalizedClientLink
                    href={item.href}
                    className={`relative py-1 text-[12px] font-bold uppercase tracking-[0.14em] text-[--sp-ink] after:absolute after:inset-x-0 after:-bottom-0.5 after:h-[2px] after:origin-left after:bg-[--sp-ink] after:transition-transform after:duration-200 ${
                      active
                        ? "after:scale-x-100"
                        : "after:scale-x-0 hover:after:scale-x-100"
                    }`}
                  >
                    {item.name}
                  </LocalizedClientLink>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Derecha: accesos */}
        <div className="flex items-center justify-end gap-1 sm:gap-2">
          <button
            type="button"
            aria-label="Buscar"
            onClick={() => setSearchOpen((v) => !v)}
            className="inline-flex size-9 items-center justify-center text-[--sp-ink] transition hover:opacity-60"
          >
            <Search className="size-[20px]" strokeWidth={2} />
          </button>
          <LocalizedClientLink
            href="/account"
            aria-label={isLoggedIn ? "Mi cuenta" : "Iniciar sesión"}
            className="hidden size-9 items-center justify-center text-[--sp-ink] transition hover:opacity-60 sm:inline-flex"
          >
            {isLoggedIn ? (
              <UserAvatar
                alt="Mi cuenta"
                avatarUrl={avatarUrl}
                initials={initials}
                size={26}
                className="bg-[--sp-ink] text-[10px] text-[--sp-on-dark] ring-1 ring-[--sp-ink]"
              />
            ) : (
              <User className="size-[20px]" strokeWidth={2} />
            )}
          </LocalizedClientLink>
          <button
            type="button"
            onClick={openWishlistDrawer}
            aria-label="Favoritos"
            className="inline-flex size-9 items-center justify-center text-[--sp-ink] transition hover:opacity-60"
          >
            <Heart
              className={`size-[20px] ${hasWishlist ? "fill-current" : ""}`}
              strokeWidth={2}
            />
          </button>
          <button
            type="button"
            aria-label="Carrito"
            onClick={openCart}
            className="relative inline-flex size-9 items-center justify-center text-[--sp-ink] transition hover:opacity-60"
          >
            <ShoppingBag className="size-[20px]" strokeWidth={2} />
            {cartCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-[16px] items-center justify-center rounded-full bg-[--sp-ink] px-1 text-[10px] font-bold leading-[16px] text-[--sp-on-dark]">
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Megamenú (desktop): se abre al hacer hover sobre un ítem con columnas. */}
      {(() => {
        const item = nav.find((n) => n.id === activeMenu && n.megamenu);
        const mega = item?.megamenu;
        if (!mega) return null;
        return (
          <div className="absolute inset-x-0 top-full hidden border-[--sp-hairline] border-t bg-[--sp-paper] shadow-[0_14px_24px_rgba(0,0,0,0.08)] lg:block">
            <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-10">
              <div className="grid grid-cols-[repeat(4,minmax(0,1fr))] gap-8 xl:grid-cols-[repeat(4,minmax(0,1fr))_1.3fr]">
                {mega.columns.map((col) => (
                  <div key={col.title}>
                    <p className="sp-eyebrow mb-3">{col.title}</p>
                    <ul className="space-y-2.5">
                      {col.links.map((link) => (
                        <li key={link.name}>
                          <LocalizedClientLink
                            href={link.href}
                            onClick={() => setActiveMenu(null)}
                            className="text-[14px] text-[--sp-ink] transition hover:underline"
                          >
                            {link.name}
                          </LocalizedClientLink>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                {mega.featured && (
                  <LocalizedClientLink
                    href={mega.featured.href}
                    onClick={() => setActiveMenu(null)}
                    className="group relative hidden overflow-hidden xl:block"
                  >
                    <div className="relative aspect-[4/3] w-full">
                      <Image
                        src={mega.featured.image}
                        alt={mega.featured.title ?? tenant.name}
                        fill
                        sizes="360px"
                        className="object-cover transition duration-500 group-hover:scale-105"
                        unoptimized={/^https?:\/\//i.test(mega.featured.image)}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
                      <div className="absolute bottom-4 left-4 text-white">
                        {mega.featured.title && (
                          <p className="text-[15px] font-extrabold uppercase tracking-tight">
                            {mega.featured.title}
                          </p>
                        )}
                        {mega.featured.subtitle && (
                          <p className="mt-0.5 text-[12px] text-white/85">
                            {mega.featured.subtitle}
                          </p>
                        )}
                      </div>
                    </div>
                  </LocalizedClientLink>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Overlay de búsqueda (estilo H&M, filtra al instante) */}
      <SportsSearchOverlay
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        placeholder={placeholder}
        navLinks={nav}
      />

      {/* Drawer mobile */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <div className="absolute left-0 top-0 flex h-full w-[84%] max-w-xs flex-col bg-[--sp-paper]">
            <div className="flex items-center justify-between border-b-2 border-[--sp-ink] px-5 py-4">
              <span className="sp-eyebrow">Menú</span>
              <button
                type="button"
                aria-label="Cerrar menú"
                onClick={() => setMobileOpen(false)}
                className="inline-flex size-8 items-center justify-center text-[--sp-ink]"
              >
                <X className="size-5" strokeWidth={2} />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-2 py-3">
              <ul>
                {nav.map((item) => (
                  <li key={item.id}>
                    <LocalizedClientLink
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className="block px-4 py-3 text-[18px] font-extrabold uppercase tracking-tight text-[--sp-ink]"
                    >
                      {item.name}
                    </LocalizedClientLink>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="border-t border-[--sp-hairline] px-4 py-3">
              <LocalizedClientLink
                href="/account"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-2 py-2 text-[12px] font-bold uppercase tracking-[0.14em] text-[--sp-ink]"
              >
                <User className="size-4" strokeWidth={2} /> Mi cuenta
              </LocalizedClientLink>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
