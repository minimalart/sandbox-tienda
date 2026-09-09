"use client";

import {
  HeartIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { HeartIcon as HeartIconSolid } from "@heroicons/react/24/solid";
import { useAddToCartAnimation } from "@lib/context/add-to-cart-animation";
import { useSiteHref, useTenantSections } from "@lib/site-config/context";
import { SEARCH_HINTS, useRotatingHint } from "@lib/hooks/use-rotating-hint";
import { useWishlist } from "@lib/hooks/use-wishlist";
import { useWishlistDrawerStore } from "@lib/stores/wishlist-drawer.store";
import ShoppingListModal from "@modules/shopping-list/components/shopping-list-modal";
import { ListPlus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { SEARCH_DEBOUNCE_MS } from "@lib/typesense/core/timing";


type CollapsedHeaderMobileProps = {
  visible: boolean;
};

export default function CollapsedHeaderMobile({
  visible,
}: CollapsedHeaderMobileProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const siteHref = useSiteHref();
  const { isShoppingListVisible } = useTenantSections();
  const openWishlistDrawer = useWishlistDrawerStore((s) => s.open);
  const { items: wishlistItems } = useWishlist();
  const { registerWishlistIcon, wishlistBounce } = useAddToCartAnimation();
  const hasWishlistItems = wishlistItems.length > 0;

  const currentQ = searchParams.get("q") || "";
  const [query, setQuery] = useState(currentQ);
  const [shoppingListOpen, setShoppingListOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isLocalChangeRef = useRef(false);
  const hint = useRotatingHint(SEARCH_HINTS);

  useEffect(() => {
    if (isLocalChangeRef.current) {
      isLocalChangeRef.current = false;
      return;
    }
    setQuery(searchParams.get("q") || "");
  }, [searchParams]);

  const navigateToStore = useCallback(
    (q: string) => {
      const trimmed = q.trim();
      isLocalChangeRef.current = true;
      // Buscar dentro de un demo tiene que quedarse en /demo/{slug}/store.
      const storeHref = siteHref("/store");
      if (trimmed) {
        router.push(`${storeHref}?q=${encodeURIComponent(trimmed)}`, {
          scroll: false,
        });
      } else {
        router.push(storeHref, { scroll: false });
      }
    },
    [router, siteHref]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setQuery(value);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(
        () => navigateToStore(value),
        SEARCH_DEBOUNCE_MS
      );
    },
    [navigateToStore]
  );

  const handleClear = useCallback(() => {
    setQuery("");
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
          debounceRef.current = null;
        }
        navigateToStore(query);
        inputRef.current?.blur();
      }
      if (e.key === "Escape") {
        handleClear();
        inputRef.current?.blur();
      }
    },
    [navigateToStore, query, handleClear]
  );

  useEffect(
    () => () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    },
    []
  );

  return (
    <>
    <div
      aria-hidden={!visible}
      inert={!visible}
      className="pointer-events-auto mx-3 flex items-center gap-2 rounded-full bg-[color:var(--header-bg,rgba(255,255,255,0.95))] px-3 py-1.5 shadow-md backdrop-blur transition-all duration-300 ease-in-out supports-[backdrop-filter]:bg-[color:var(--header-bg,rgba(255,255,255,0.9))] lg:hidden"
      style={{
        transform: visible ? "translateY(0)" : "translateY(-150%)",
        opacity: visible ? 1 : 0,
      }}
    >
      <div className="relative flex flex-1 items-center">
        <MagnifyingGlassIcon
          aria-hidden="true"
          className="pointer-events-none absolute left-3 size-4 text-[--primary-color]/70"
        />
        <input
          aria-label="Buscar productos"
          autoComplete="off"
          className="w-full rounded-full border border-gray-200 bg-gray-50 py-1.5 pr-7 pl-9 text-gray-900 text-sm transition-colors placeholder:text-gray-400 focus:border-[--primary-color] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[--primary-color]"
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={query ? "" : hint}
          ref={inputRef}
          type="search"
          value={query}
        />
        {query && (
          <button
            aria-label="Limpiar búsqueda"
            className="absolute right-2 flex size-4 items-center justify-center rounded-full bg-gray-300 text-gray-600 transition-colors hover:bg-gray-400"
            onClick={handleClear}
            type="button"
          >
            <XMarkIcon className="size-3" />
          </button>
        )}
      </div>
      {isShoppingListVisible && (
        <button
          aria-label="Abrir lista de compras"
          data-testid="shopping-list-open-button"
          className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 transition-colors hover:border-[--primary-color] hover:text-[--primary-color]"
          onClick={() => setShoppingListOpen(true)}
          type="button"
        >
          <ListPlus aria-hidden="true" className="h-4 w-4" />
        </button>
      )}
      <button
        aria-label="Favoritos"
        className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 transition-colors hover:border-[--primary-color] hover:text-[--primary-color]"
        onClick={openWishlistDrawer}
        ref={(el) => registerWishlistIcon(el)}
        type="button"
      >
        {hasWishlistItems ? (
          <HeartIconSolid
            aria-hidden="true"
            className={`h-4 w-4 text-rose-500 ${
              wishlistBounce ? "animate-bounce" : ""
            }`}
          />
        ) : (
          <HeartIcon
            aria-hidden="true"
            className={`h-4 w-4 ${
              wishlistBounce ? "animate-bounce text-rose-500" : ""
            }`}
          />
        )}
      </button>
    </div>
    {isShoppingListVisible && (
      <ShoppingListModal
        open={shoppingListOpen}
        onClose={() => setShoppingListOpen(false)}
      />
    )}
    </>
  );
}
