"use client";

import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import type { NavigationLink } from "@lib/data/navigation-links";
import {
  useSiteHref,
  useTenant,
  useTenantSections,
} from "@lib/site-config/context";
import { useGhostCompletion } from "@lib/hooks/use-ghost-completion";
import { SEARCH_HINTS, useRotatingHint } from "@lib/hooks/use-rotating-hint";
import ShoppingListModal from "@modules/shopping-list/components/shopping-list-modal";
import { ListPlus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { SEARCH_DEBOUNCE_MS } from "@lib/typesense/core/timing";
import {
  resolveQuickSuggestionTarget,
  type CategoryNode,
  type QuickSuggestion,
} from "@lib/util/quick-suggestion-target";

const QUICK_SUGGESTIONS = [
  { label: "Indumentaria", query: "indumentaria" },
  { label: "Calzado", query: "calzado" },
  { label: "Accesorios", query: "accesorios" },
];

/**
 * `categories` es OPCIONAL y su ausencia no es un error: sin árbol, los atajos se
 * comportan como antes (búsqueda de texto). Se lo pasa quien ya lo tiene a mano —
 * `nav-client`, que monta este buscador al lado del menú de categorías.
 */
const HeaderSearchBar = ({
  categories = [],
}: { categories?: CategoryNode[] } = {}) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tenant = useTenant();
  const siteHref = useSiteHref();
  const { isShoppingListVisible } = useTenantSections();
  // Per-demo "Explorar:" quick suggestions; fall back to the hardcoded set when
  // the demo doesn't override them (and on the main store).
  const quickSuggestions = tenant.assets.searchSuggestions?.length
    ? tenant.assets.searchSuggestions
    : QUICK_SUGGESTIONS;

  const currentQ = searchParams.get("q") || "";
  const [query, setQuery] = useState(currentQ);
  const [shoppingListOpen, setShoppingListOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isLocalChangeRef = useRef(false);
  // Textos rotativos del buscador configurables por demo; fallback a los default.
  const searchHints = tenant.assets.searchHints?.length
    ? tenant.assets.searchHints
    : SEARCH_HINTS;
  const hint = useRotatingHint(searchHints);

  const {
    ghostSuffix,
    suggestion: ghostSuggestion,
    matchedLink,
  } = useGhostCompletion(query);

  // Sync input when URL q param changes externally (e.g. clearing filters)
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
        router.push(`${storeHref}?q=${encodeURIComponent(trimmed)}`, {
          scroll: false,
        });
      } else {
        router.push(storeHref, { scroll: false });
      }
    },
    [router, siteHref]
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

  const submitSearch = useCallback(() => {
    if (matchedLink) {
      navigateToLink(matchedLink);
      return;
    }
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    navigateToStore(query);
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
      }
    },
    [tryAcceptGhost, submitSearch]
  );

  /**
   * Atajo "Explorar:" del header.
   *
   * Un atajo que resuelve a una CATEGORÍA navega al filtro —el mismo que usan el menú
   * y las tarjetas del home— y NO escribe nada en el input: no es una búsqueda de
   * texto, y dejar el término tipeado ahí hacía que la próxima tecla lo convirtiera en
   * una, perdiendo el filtro. El que no resuelve cae en la búsqueda libre de siempre.
   *
   * Toda la decisión vive en `resolveQuickSuggestionTarget`, que está testeada aparte
   * contra las categorías reales de la tienda (DESDEELSUR-61, BUG-11).
   */
  const handleSuggestionClick = useCallback(
    (suggestion: QuickSuggestion) => {
      isLocalChangeRef.current = true;
      const target = resolveQuickSuggestionTarget(suggestion, categories);

      if (target.kind === "query") {
        setQuery(target.term);
        navigateToStore(target.term);
        return;
      }

      setQuery("");
      const href =
        target.kind === "href"
          ? target.href
          : `/store?category=${encodeURIComponent(target.category)}`;
      // `siteHref` sólo antepone el prefijo del sitio; el href del árbol ya viene
      // relativo a `/store`, así que se le saca esa parte antes de reconstruirlo.
      router.push(`${siteHref("/store")}${href.slice("/store".length)}`, {
        scroll: false,
      });
    },
    [navigateToStore, router, siteHref, categories]
  );

  // Cleanup debounce on unmount
  useEffect(
    () => () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    },
    []
  );

  return (
    <div className="relative flex flex-1 items-center gap-3 p-4">
      {/* Search input */}
      <div className="relative flex-1">
        <MagnifyingGlassIcon
          aria-hidden="true"
          className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 z-10 size-4 text-gray-400"
        />
        <input
          aria-label="Buscar productos"
          className="relative w-full rounded-full border border-gray-200 bg-gray-50 py-2 pr-4 pl-9 text-gray-900 text-sm transition-colors placeholder:text-gray-400 focus:border-[--primary-color] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[--primary-color]"
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
            data-ghost-overlay
            className="pointer-events-none absolute inset-0 flex items-center overflow-hidden whitespace-pre rounded-full border border-transparent py-2 pl-9 text-sm"
            style={{ paddingRight: matchedLink ? "9rem" : "1rem" }}
          >
            <span className="invisible">{query}</span>
            <span className="text-gray-400">{ghostSuffix}</span>
          </div>
        )}
        {matchedLink && (
          <button
            className="-translate-y-1/2 absolute top-1/2 right-2 flex items-center gap-1 whitespace-nowrap rounded-full bg-[--primary-color] px-3 py-1 font-medium text-white text-xs transition-opacity hover:opacity-90"
            onClick={() => navigateToLink(matchedLink)}
            type="button"
          >
            Ir a {matchedLink.name}
            <span aria-hidden="true">→</span>
          </button>
        )}
      </div>

      {/* Botón "Lista de compras": respeta el toggle sectionVisibility.shoppingList
          igual que el link del nav. Antes se renderizaba siempre — el toggle
          apagaba el link pero dejaba el botón del search bar visible. */}
      {isShoppingListVisible && (
        <button
          aria-label="Abrir lista de compras"
          className="group relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 transition-colors hover:border-[--primary-color] hover:text-[--primary-color]"
          data-testid="shopping-list-open-button"
          onClick={() => setShoppingListOpen(true)}
          type="button"
        >
          <ListPlus className="h-5 w-5" />
          <span className="pointer-events-none absolute top-full left-1/2 z-20 mt-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition duration-150 before:absolute before:-top-1 before:left-1/2 before:h-2 before:w-2 before:-translate-x-1/2 before:rotate-45 before:bg-gray-900 group-hover:opacity-100 group-focus-visible:opacity-100">
            Lista de compras
          </span>
        </button>
      )}

      {/* Quick suggestions - hidden on smaller screens */}
      <div className="hidden items-center gap-1 xl:flex">
        <span className="whitespace-nowrap text-gray-500 text-xs">
          Explorar:
        </span>
        {quickSuggestions.map((suggestion) => (
          <button
            className="whitespace-nowrap rounded-full px-1.5 py-0.5 font-medium text-[--primary-color] text-xs underline decoration-[--primary-color] underline-offset-2 transition-colors hover:text-[--accent-color] hover:decoration-[--accent-color]"
            // `label` y no `query`: con un atajo por categoría `query` es undefined,
            // y dos atajos sin query colapsarían en la misma key.
            key={suggestion.label}
            onClick={() => handleSuggestionClick(suggestion)}
            type="button"
          >
            {suggestion.label}
          </button>
        ))}
      </div>
      {isShoppingListVisible && (
        <ShoppingListModal
          open={shoppingListOpen}
          onClose={() => setShoppingListOpen(false)}
        />
      )}
    </div>
  );
};

export default HeaderSearchBar;
