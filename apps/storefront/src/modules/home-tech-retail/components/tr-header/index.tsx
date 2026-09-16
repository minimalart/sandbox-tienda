"use client";

import { useTenant } from "@lib/site-config/context";
import { selectTotalItems, useCartStore } from "@lib/stores/cart.store";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import { Heart, Menu, Search, ShoppingCart, User, X } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import "../../tech-retail-theme.css";

type TrHeaderProps = {
  /** Cart count resuelto en el server (fallback hasta que hidrata el store). */
  initialCartCount?: number;
  isLoggedIn?: boolean;
  hasSpaceDesigner?: boolean;
};

/**
 * Header del template Tecnología Retail.
 *
 * Alta densidad tipo Frávega: logo, buscador protagonista, menú de categorías,
 * y accesos a cuenta / favoritos / carrito. Sustituye al SmartHeader de grocery
 * solo cuando el template activo es "tech-retail".
 */
export default function TrHeader({
  initialCartCount = 0,
  isLoggedIn = false,
  hasSpaceDesigner = false,
}: TrHeaderProps) {
  const tenant = useTenant();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  const liveCount = useCartStore(selectTotalItems);
  // El contador del server sólo vale hasta que el store hidrata: después manda
  // el store aunque sea 0. Con `liveCount || initialCartCount` un carrito vaciado
  // en el cliente seguía mostrando el badge viejo del payload cacheado.
  const cartIsHydrated = useCartStore((state) => state.isHydrated);
  const cartCount = cartIsHydrated ? liveCount : initialCartCount;

  const header = tenant.assets.techRetail?.header;
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
    <header className="tech-retail-home sticky top-0 z-50 border-b border-[--tr-hairline] bg-[color:var(--header-bg,#ffffff)]">
      {/* Fila principal */}
      <div className="mx-auto flex max-w-[1440px] items-center gap-3 px-4 py-3 sm:gap-6 sm:px-6 lg:px-8">
        {/* Mobile: menu */}
        <button
          type="button"
          aria-label="Abrir menú"
          className="-ml-1 inline-flex size-10 items-center justify-center rounded-lg text-[--tr-ink] lg:hidden"
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
              width={140}
              height={34}
              className="h-8 w-auto object-contain sm:h-9"
              unoptimized={/^https?:\/\//i.test(logo)}
              priority
            />
          ) : (
            <span className="text-xl font-extrabold tracking-tight text-[--tr-ink]">
              {tenant.name}
            </span>
          )}
        </LocalizedClientLink>

        {/* Buscador protagonista (desktop) */}
        <form onSubmit={onSearch} role="search" className="hidden flex-1 lg:block">
          <div className="relative mx-auto max-w-3xl">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              aria-label="Buscar"
              className="h-11 w-full rounded-xl border-2 border-[--tr-hairline] bg-white pl-4 pr-12 text-[15px] text-[--tr-ink] outline-none transition focus:border-[--tr-blue]"
            />
            <button
              type="submit"
              aria-label="Buscar"
              className="absolute right-1.5 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-lg bg-[--tr-blue] text-white"
            >
              <Search className="size-5" />
            </button>
          </div>
        </form>

        {/* Accesos rápidos */}
        <div className="ml-auto flex items-center gap-1 sm:gap-3">
          <LocalizedClientLink
            href="/account"
            aria-label="Mi cuenta"
            className="hidden items-center gap-2 rounded-lg px-2 py-1.5 text-[--tr-ink] transition hover:bg-[--tr-surface] sm:inline-flex"
          >
            <User className="size-6" />
            <span className="hidden text-[13px] font-medium leading-tight lg:block">
              {isLoggedIn ? "Mi cuenta" : "Ingresar"}
            </span>
          </LocalizedClientLink>
          <LocalizedClientLink
            href="/account/wishlist"
            aria-label="Favoritos"
            className="inline-flex size-10 items-center justify-center rounded-lg text-[--tr-ink] transition hover:bg-[--tr-surface]"
          >
            <Heart className="size-6" />
          </LocalizedClientLink>
          <LocalizedClientLink
            href="/cart"
            aria-label="Carrito"
            className="relative inline-flex size-10 items-center justify-center rounded-lg text-[--tr-ink] transition hover:bg-[--tr-surface]"
          >
            <ShoppingCart className="size-6" />
            {cartCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-[--tr-red] px-1 text-[11px] font-bold leading-[18px] text-white">
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
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              aria-label="Buscar"
              className="h-11 w-full rounded-xl border-2 border-[--tr-hairline] bg-white pl-4 pr-12 text-[15px] text-[--tr-ink] outline-none focus:border-[--tr-blue]"
            />
            <button
              type="submit"
              aria-label="Buscar"
              className="absolute right-1.5 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-lg bg-[--tr-blue] text-white"
            >
              <Search className="size-5" />
            </button>
          </div>
        </form>
      </div>

      {/* Menú de categorías (desktop) */}
      {categories.length > 0 && (
        <nav className="hidden border-t border-[--tr-divider] bg-[--tr-surface] lg:block">
          <ul className="mx-auto flex max-w-[1440px] items-center gap-7 px-4 py-2.5 sm:px-6 lg:px-8">
            {categories.map((cat) => (
              <li key={cat.id}>
                <LocalizedClientLink
                  href={cat.href}
                  className="text-[13px] font-semibold text-[--tr-muted] transition hover:text-[--tr-blue]"
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
            <div className="flex items-center justify-between border-b border-[--tr-hairline] px-4 py-4">
              <span className="text-base font-bold">Categorías</span>
              <button
                type="button"
                aria-label="Cerrar menú"
                onClick={() => setMobileOpen(false)}
                className="inline-flex size-9 items-center justify-center rounded-lg text-[--tr-ink]"
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
                      className="block rounded-lg px-4 py-3 text-[15px] font-semibold text-[--tr-ink] transition hover:bg-[--tr-surface]"
                    >
                      {cat.name}
                    </LocalizedClientLink>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="border-t border-[--tr-hairline] px-2 py-2">
              <LocalizedClientLink
                href="/account"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 rounded-lg px-4 py-3 text-[15px] font-semibold text-[--tr-ink] hover:bg-[--tr-surface]"
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
