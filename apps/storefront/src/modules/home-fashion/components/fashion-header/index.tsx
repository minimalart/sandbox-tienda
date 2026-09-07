"use client";

import { useTenant } from "@lib/site-config/context";
import { selectTotalItems, useCartStore } from "@lib/stores/cart.store";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import { Heart, Menu, Search, ShoppingBag, User, X } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import "../../fashion-theme.css";

type FashionHeaderProps = {
  initialCartCount?: number;
  isLoggedIn?: boolean;
  hasSpaceDesigner?: boolean;
};

/**
 * Header del template Moda.
 *
 * Minimalista y de baja altura (COS / Zara): navegación a la izquierda,
 * wordmark centrado y accesos discretos (búsqueda, cuenta, favoritos, carrito)
 * a la derecha. La búsqueda se abre como overlay para no ocupar espacio. Ocupa
 * menos espacio visual que el header de Grocery. Sustituye al SmartHeader solo
 * cuando el template activo es "fashion".
 */
export default function FashionHeader({
  initialCartCount = 0,
  isLoggedIn = false,
  hasSpaceDesigner = false,
}: FashionHeaderProps) {
  const tenant = useTenant();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const liveCount = useCartStore(selectTotalItems);
  const cartCount = liveCount || initialCartCount;

  const header = tenant.assets.fashion?.header;
  const nav = [...(header?.nav ?? [])];
  if (hasSpaceDesigner && !nav.some((item) => item.href === "/espacios")) {
    nav.push({ id: "space-designer", name: "Diseñá tu espacio", href: "/espacios" });
  }
  const placeholder = header?.searchPlaceholder ?? "Buscar";
  const logo = tenant.assets.logos?.main;

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/store?q=${encodeURIComponent(q)}` : "/store");
    setSearchOpen(false);
    setMobileOpen(false);
  };

  return (
    <header className="fashion-home sticky top-0 z-50 border-b border-[--f-hairline] bg-[color:var(--header-bg,var(--f-canvas))] backdrop-blur">
      <div className="mx-auto grid max-w-[1600px] grid-cols-[1fr_auto_1fr] items-center px-4 py-3 sm:px-6 lg:px-10">
        {/* Izquierda: nav (desktop) / menu (mobile) */}
        <div className="flex items-center gap-6">
          <button
            type="button"
            aria-label="Abrir menú"
            className="-ml-1 inline-flex size-9 items-center justify-center text-[--f-ink] lg:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="size-5" strokeWidth={1.5} />
          </button>
          <nav className="hidden lg:block">
            <ul className="flex items-center gap-7">
              {nav.map((item) => (
                <li key={item.id}>
                  <LocalizedClientLink
                    href={item.href}
                    className="text-[11px] font-medium uppercase tracking-[0.16em] text-[--f-ink] transition hover:opacity-60"
                  >
                    {item.name}
                  </LocalizedClientLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* Centro: wordmark */}
        <LocalizedClientLink
          href="/"
          aria-label={tenant.name}
          className="flex items-center justify-center"
        >
          {logo ? (
            <Image
              src={logo}
              alt={tenant.name}
              width={120}
              height={28}
              className="h-6 w-auto object-contain sm:h-7"
              unoptimized={/^https?:\/\//i.test(logo)}
              priority
            />
          ) : (
            <span className="f-display text-xl tracking-tight sm:text-2xl">
              {tenant.name}
            </span>
          )}
        </LocalizedClientLink>

        {/* Derecha: accesos */}
        <div className="flex items-center justify-end gap-1 sm:gap-2">
          <button
            type="button"
            aria-label="Buscar"
            onClick={() => setSearchOpen((v) => !v)}
            className="inline-flex size-9 items-center justify-center text-[--f-ink] transition hover:opacity-60"
          >
            <Search className="size-[18px]" strokeWidth={1.5} />
          </button>
          <LocalizedClientLink
            href="/account"
            aria-label={isLoggedIn ? "Mi cuenta" : "Iniciar sesión"}
            className="hidden size-9 items-center justify-center text-[--f-ink] transition hover:opacity-60 sm:inline-flex"
          >
            <User className="size-[18px]" strokeWidth={1.5} />
          </LocalizedClientLink>
          <LocalizedClientLink
            href="/account/wishlist"
            aria-label="Favoritos"
            className="inline-flex size-9 items-center justify-center text-[--f-ink] transition hover:opacity-60"
          >
            <Heart className="size-[18px]" strokeWidth={1.5} />
          </LocalizedClientLink>
          <LocalizedClientLink
            href="/cart"
            aria-label="Carrito"
            className="relative inline-flex size-9 items-center justify-center text-[--f-ink] transition hover:opacity-60"
          >
            <ShoppingBag className="size-[18px]" strokeWidth={1.5} />
            {cartCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-[16px] items-center justify-center rounded-full bg-[--f-ink] px-1 text-[10px] font-medium leading-[16px] text-[--f-on-dark]">
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            )}
          </LocalizedClientLink>
        </div>
      </div>

      {/* Overlay de búsqueda */}
      {searchOpen && (
        <div className="border-t border-[--f-hairline] bg-[--f-canvas]">
          <form
            onSubmit={onSearch}
            role="search"
            className="mx-auto flex max-w-[1600px] items-center gap-3 px-4 py-4 sm:px-6 lg:px-10"
          >
            <Search className="size-5 text-[--f-subtle]" strokeWidth={1.5} />
            <input
              autoFocus
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              aria-label="Buscar"
              className="h-9 flex-1 border-0 bg-transparent text-[15px] text-[--f-ink] outline-none placeholder:text-[--f-subtle]"
            />
            <button
              type="button"
              aria-label="Cerrar búsqueda"
              onClick={() => setSearchOpen(false)}
              className="inline-flex size-8 items-center justify-center text-[--f-ink]"
            >
              <X className="size-5" strokeWidth={1.5} />
            </button>
          </form>
        </div>
      )}

      {/* Drawer mobile */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <div className="absolute left-0 top-0 flex h-full w-[84%] max-w-xs flex-col bg-[--f-canvas]">
            <div className="flex items-center justify-between border-b border-[--f-hairline] px-5 py-4">
              <span className="f-eyebrow">Menú</span>
              <button
                type="button"
                aria-label="Cerrar menú"
                onClick={() => setMobileOpen(false)}
                className="inline-flex size-8 items-center justify-center text-[--f-ink]"
              >
                <X className="size-5" strokeWidth={1.5} />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-2 py-3">
              <ul>
                {nav.map((item) => (
                  <li key={item.id}>
                    <LocalizedClientLink
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className="block px-4 py-3 font-serif text-[18px] tracking-tight text-[--f-ink] [font-family:var(--f-serif)]"
                    >
                      {item.name}
                    </LocalizedClientLink>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="border-t border-[--f-hairline] px-4 py-3">
              <LocalizedClientLink
                href="/account"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-2 py-2 text-[12px] font-medium uppercase tracking-[0.16em] text-[--f-ink]"
              >
                <User className="size-4" strokeWidth={1.5} /> Mi cuenta
              </LocalizedClientLink>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
