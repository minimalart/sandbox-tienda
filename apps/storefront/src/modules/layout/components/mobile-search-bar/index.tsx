"use client";

import {
  ChevronLeftIcon,
  HeartIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { HeartIcon as HeartIconSolid } from "@heroicons/react/24/solid";
import { useAddToCartAnimation } from "@lib/context/add-to-cart-animation";
import type { NavigationLink } from "@lib/data/navigation-links";
import { useGhostCompletion } from "@lib/hooks/use-ghost-completion";
import { SEARCH_HINTS, useRotatingHint } from "@lib/hooks/use-rotating-hint";
import {
  useSiteHref,
  useTenant,
  useTenantSections,
} from "@lib/site-config/context";
import { useWishlist } from "@lib/hooks/use-wishlist";
import { useWishlistDrawerStore } from "@lib/stores/wishlist-drawer.store";
import ShoppingListModal from "@modules/shopping-list/components/shopping-list-modal";
import { ListPlus } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { SEARCH_DEBOUNCE_MS } from "@lib/typesense/core/timing";


const MobileSearchBar = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
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
  const tenant = useTenant();
  const siteHref = useSiteHref();
  const { isShoppingListVisible } = useTenantSections();
  const searchHints = tenant.assets.searchHints?.length
    ? tenant.assets.searchHints
    : SEARCH_HINTS;
  const hint = useRotatingHint(searchHints);

  const isOnStore = pathname?.includes("/store");
  const isProductsPage = pathname?.includes("/products");

  const {
    ghostSuffix,
    suggestion: ghostSuggestion,
    matchedLink,
  } = useGhostCompletion(query);

  // Sync when URL q param changes externally (e.g. back button, filter clear)
  // Skip sync if the change was initiated by this component
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
        router.push(`${storeHref}?q=${encodeURIComponent(trimmed)}`);
      } else if (isOnStore) {
        router.push(storeHref);
      }
    },
    [router, isOnStore, siteHref]
  );

  const navigateToLink = useCallback(
    (link: NavigationLink) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      if (link.external) {
        window.open(link.href, link.target ?? "_blank", "noopener,noreferrer");
      } else {
        router.push(link.href);
      }
    },
    [router]
  );

  const acceptSuggestion = useCallback(() => {
    if (!ghostSuggestion) {
      return false;
    }
    setQuery(ghostSuggestion);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    return true;
  }, [ghostSuggestion]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setQuery(value);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        navigateToStore(value);
      }, SEARCH_DEBOUNCE_MS);
    },
    [navigateToStore]
  );

  const handleClear = useCallback(() => {
    setQuery("");
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    if (isOnStore) {
      isLocalChangeRef.current = true;
      router.push(siteHref("/store"));
    }
  }, [isOnStore, router, siteHref]);

  const submitSearch = useCallback(() => {
    if (matchedLink) {
      navigateToLink(matchedLink);
    } else {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      navigateToStore(query);
    }
    inputRef.current?.blur();
  }, [matchedLink, navigateToLink, navigateToStore, query]);

  const tryAcceptGhost = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!ghostSuffix) {
        return false;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        acceptSuggestion();
        return true;
      }
      if (e.key === "ArrowRight") {
        const target = e.currentTarget;
        const atEnd =
          target.selectionStart === query.length &&
          target.selectionEnd === query.length;
        if (atEnd) {
          e.preventDefault();
          acceptSuggestion();
          return true;
        }
      }
      return false;
    },
    [ghostSuffix, acceptSuggestion, query.length]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (tryAcceptGhost(e)) {
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        submitSearch();
        return;
      }
      if (e.key === "Escape") {
        handleClear();
        inputRef.current?.blur();
      }
    },
    [tryAcceptGhost, submitSearch, handleClear]
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
    <div className="flex items-center gap-2 border-gray-100 border-t bg-white px-3 py-2 lg:hidden">
      {isProductsPage ? (
        <button
          aria-label="Volver"
          className="flex shrink-0 items-center justify-center text-[--primary-color]"
          onClick={() => router.back()}
          type="button"
        >
          <ChevronLeftIcon className="size-6" />
        </button>
      ) : null}
      <div className="relative flex flex-1 items-center">
        <MagnifyingGlassIcon
          aria-hidden="true"
          className="pointer-events-none absolute left-3 size-4 text-[--primary-color]/70"
        />
        <input
          aria-label="Buscar productos"
          autoComplete="off"
          className="w-full rounded-full border border-gray-200 bg-gray-50 py-2 pr-8 pl-9 text-gray-900 text-sm transition-colors placeholder:text-gray-400 focus:border-[--primary-color] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[--primary-color]"
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={query ? "" : hint}
          ref={inputRef}
          type="search"
          value={query}
        />
        {ghostSuffix && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 flex items-center overflow-hidden whitespace-pre rounded-full border border-transparent py-2 pl-9 text-sm"
            style={{ paddingRight: matchedLink ? "8rem" : "2rem" }}
          >
            <span className="invisible">{query}</span>
            <span className="text-gray-400">{ghostSuffix}</span>
          </div>
        )}
        {matchedLink ? (
          <button
            className="absolute right-1 flex items-center gap-1 whitespace-nowrap rounded-full bg-[--primary-color] px-2.5 py-1 font-medium text-white text-xs transition-opacity hover:opacity-90"
            onClick={() => navigateToLink(matchedLink)}
            type="button"
          >
            Ir a {matchedLink.name}
            <span aria-hidden="true">→</span>
          </button>
        ) : (
          query && (
            <button
              aria-label="Limpiar búsqueda"
              className="absolute right-2.5 flex size-5 items-center justify-center rounded-full bg-gray-300 text-gray-600 transition-colors hover:bg-gray-400"
              onClick={handleClear}
              type="button"
            >
              <XMarkIcon className="size-3" />
            </button>
          )
        )}
      </div>
      {isShoppingListVisible && (
        <button
          aria-label="Abrir lista de compras"
          data-testid="shopping-list-open-button"
          className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 transition-colors hover:border-[--primary-color] hover:text-[--primary-color]"
          onClick={() => setShoppingListOpen(true)}
          type="button"
        >
          <ListPlus aria-hidden="true" className="h-5 w-5" />
        </button>
      )}
      <button
        aria-label="Favoritos"
        className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 transition-colors hover:border-[--primary-color] hover:text-[--primary-color]"
        onClick={openWishlistDrawer}
        ref={(el) => registerWishlistIcon(el)}
        type="button"
      >
        {hasWishlistItems ? (
          <HeartIconSolid
            aria-hidden="true"
            className={`h-5 w-5 text-rose-500 ${wishlistBounce ? "animate-bounce" : ""}`}
          />
        ) : (
          <HeartIcon
            aria-hidden="true"
            className={`h-5 w-5 ${wishlistBounce ? "animate-bounce text-rose-500" : ""}`}
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
};

export default MobileSearchBar;
