"use client";

import { useTenant } from "@lib/site-config/context";
import { selectTotalItems, useCartStore } from "@lib/stores/cart.store";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import {
  Heart,
  Menu,
  Search,
  ShoppingCart,
  User,
  X,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import "../../tech-theme.css";

type TechHeaderProps = {
  /** Cart count resuelto en el server (fallback hasta que hidrata el store). */
  initialCartCount?: number;
  isLoggedIn?: boolean;
  hasSpaceDesigner?: boolean;
};

/**
 * Header del template Tecnología.
 *
 * Más limpio y moderno que el de supermercado: el buscador es protagonista
 * (en tecnología la búsqueda por producto / marca / modelo es clave), con
 * menú de categorías, accesos a cuenta, favoritos y carrito. Sustituye al
 * SmartHeader de grocery solo cuando el template activo es "technology".
 */
export default function TechHeader({
  initialCartCount = 0,
  isLoggedIn = false,
  hasSpaceDesigner = false,
}: TechHeaderProps) {
  const tenant = useTenant();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  const liveCount = useCartStore(selectTotalItems);
  const cartCount = liveCount || initialCartCount;

  const header = tenant.assets.technology?.header;
  const categories = [...(header?.categories ?? [])];
  if (hasSpaceDesigner && !categories.some((item) => item.href === "/espacios")) {
    categories.push({ id: "space-designer", name: "Diseñá tu espacio", href: "/espacios" });
  }
  const placeholder = header?.searchPlaceholder ?? "Buscar productos…";
  const logo = tenant.assets.logos?.main;

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/store?q=${encodeURIComponent(q)}` : "/store");
    setMobileOpen(false);
  };

  return (
    <header className="tech-home sticky top-0 z-50 border-b border-[--tech-hairline] bg-[color:var(--header-bg,rgba(255,255,255,0.9))] backdrop-blur supports-[backdrop-filter]:bg-[color:var(--header-bg,rgba(255,255,255,0.75))]">
      {/* Fila principal */}
      <div className="mx-auto flex max-w-[1440px] items-center gap-3 px-4 py-3 sm:gap-6 sm:px-6 lg:px-8">
        {/* Mobile: menu */}
        <button
          type="button"
          aria-label="Abrir menú"
          className="-ml-1 inline-flex size-10 items-center justify-center rounded-full text-[--tech-ink] lg:hidden"
          onClick={() => setMobileOpen(true)}
        >
          <Menu className="size-6" />
        </button>

        {/* Logo */}
        <LocalizedClientLink
          href="/"
          aria-label={tenant.name}
          className="flex shrink-0 items-center"
        >
          {logo ? (
            <Image
              src={logo}
              alt={tenant.name}
              width={132}
              height={32}
              className="h-7 w-auto object-contain sm:h-8"
              unoptimized={/^https?:\/\//i.test(logo)}
              priority
            />
          ) : (
            <span className="text-lg font-semibold tracking-tight">
              {tenant.name}
            </span>
          )}
        </LocalizedClientLink>

        {/* Buscador protagonista (desktop) */}
        <form
          onSubmit={onSearch}
          role="search"
          className="hidden flex-1 lg:block"
        >
          <div className="relative mx-auto max-w-2xl">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[--tech-subtle]" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              aria-label="Buscar"
              className="h-11 w-full rounded-full border border-[--tech-hairline] bg-[--tech-parchment] pl-12 pr-4 text-[15px] text-[--tech-ink] outline-none transition focus:border-[--tech-blue] focus:bg-white focus:ring-2 focus:ring-[--tech-blue]/20"
            />
          </div>
        </form>

        {/* Accesos rápidos */}
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <LocalizedClientLink
            href={isLoggedIn ? "/account" : "/account"}
            aria-label="Mi cuenta"
            className="hidden size-10 items-center justify-center rounded-full text-[--tech-ink] transition hover:bg-[--tech-parchment] sm:inline-flex"
          >
            <User className="size-[22px]" />
          </LocalizedClientLink>
          <LocalizedClientLink
            href="/account/wishlist"
            aria-label="Favoritos"
            className="inline-flex size-10 items-center justify-center rounded-full text-[--tech-ink] transition hover:bg-[--tech-parchment]"
          >
            <Heart className="size-[22px]" />
          </LocalizedClientLink>
          <LocalizedClientLink
            href="/cart"
            aria-label="Carrito"
            className="relative inline-flex size-10 items-center justify-center rounded-full text-[--tech-ink] transition hover:bg-[--tech-parchment]"
          >
            <ShoppingCart className="size-[22px]" />
            {cartCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-[--tech-blue] px-1 text-[11px] font-semibold leading-[18px] text-white">
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            )}
          </LocalizedClientLink>
        </div>
      </div>

      {/* Buscador protagonista (mobile) */}
      <div className="px-4 pb-3 lg:hidden">
        <form onSubmit={onSearch} role="search">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[--tech-subtle]" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              aria-label="Buscar"
              className="h-11 w-full rounded-full border border-[--tech-hairline] bg-[--tech-parchment] pl-12 pr-4 text-[15px] text-[--tech-ink] outline-none focus:border-[--tech-blue] focus:bg-white"
            />
          </div>
        </form>
      </div>

      {/* Menú de categorías (desktop) */}
      {categories.length > 0 && (
        <nav className="hidden border-t border-[--tech-divider] lg:block">
          <ul className="mx-auto flex max-w-[1440px] items-center gap-7 px-4 py-2.5 sm:px-6 lg:px-8">
            {categories.map((cat) => (
              <li key={cat.id}>
                <LocalizedClientLink
                  href={cat.href}
                  className="text-[13px] font-medium text-[--tech-muted] transition hover:text-[--tech-ink]"
                >
                  {cat.name}
                </LocalizedClientLink>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {/* Drawer mobile */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <div className="absolute left-0 top-0 flex h-full w-[82%] max-w-xs flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-[--tech-hairline] px-4 py-4">
              <span className="text-base font-semibold">Categorías</span>
              <button
                type="button"
                aria-label="Cerrar menú"
                onClick={() => setMobileOpen(false)}
                className="inline-flex size-9 items-center justify-center rounded-full text-[--tech-ink]"
              >
                <X className="size-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-2 py-2">
              <ul>
                {categories.map((cat) => (
                  <li key={cat.id}>
                    <LocalizedClientLink
                      href={cat.href}
                      onClick={() => setMobileOpen(false)}
                      className="block rounded-xl px-4 py-3 text-[15px] font-medium text-[--tech-ink] transition hover:bg-[--tech-parchment]"
                    >
                      {cat.name}
                    </LocalizedClientLink>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="border-t border-[--tech-hairline] px-2 py-2">
              <LocalizedClientLink
                href="/account"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-[15px] font-medium text-[--tech-ink] hover:bg-[--tech-parchment]"
              >
                <User className="size-5" /> Mi cuenta
              </LocalizedClientLink>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
