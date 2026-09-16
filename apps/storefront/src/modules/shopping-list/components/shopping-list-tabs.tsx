"use client";

import { useChannel } from "@lib/context/channel-context";
import { searchProductsFromBrowser } from "@lib/typesense/search-browser";
import type { TypesenseProductDocument } from "@lib/typesense/types";
import InfiniteScrollSentinel from "@modules/store/components/infinite-scroll-sentinel";
import TypesenseProductCard from "@modules/store/templates/typesense-product-card";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ShoppingListTabsProps = {
  terms: string[];
  countryCode: string;
};

/**
 * Tamaño de la tanda por término, NO el tope de resultados.
 *
 * Antes era un tope: se pedían 24 productos por término y ahí terminaba la
 * lista, así que un término como "galletitas" mostraba 24 de los 256 que
 * devuelve el buscador de la tienda para la misma palabra. Ahora es sólo la
 * primera página; el resto entra por scroll infinito, igual que el PLP.
 */
const RESULTS_PER_PAGE = 24;

const ALL_TAB = "__all__";

type TermState = {
  /** Lo cargado hasta ahora (todas las páginas traídas, concatenadas). */
  products: TypesenseProductDocument[];
  /** Total de matches en el índice, no cuántos hay cargados. */
  found: number;
  /** Última página traída; 0 = todavía ninguna. */
  page: number;
  totalPages: number;
  /** Primera página en vuelo (muestra skeleton). */
  loading: boolean;
  /** Página siguiente en vuelo (scroll infinito). */
  loadingMore: boolean;
  failed: boolean;
};

const emptyTermState = (): TermState => ({
  products: [],
  found: 0,
  page: 0,
  totalPages: 0,
  loading: true,
  loadingMore: false,
  failed: false,
});

const formatCount = (count: number) => count.toLocaleString("es-AR");

/**
 * Combina los resultados de cada término en una sola lista, intercalándolos
 * (round-robin) para que todos los términos queden representados arriba, y
 * deduplica por id. Es lo que alimenta la pestaña "Todo".
 *
 * Como cada lista sólo crece por el final, traer una página más no reordena
 * nada de lo que ya está en pantalla.
 */
function mergeAllProducts(
  terms: string[],
  byTerm: Record<string, TermState>,
): TypesenseProductDocument[] {
  const lists = terms
    .map((term) => byTerm[term]?.products)
    .filter((list): list is TypesenseProductDocument[] => Array.isArray(list));

  const merged: TypesenseProductDocument[] = [];
  const seen = new Set<string>();
  const maxLen = lists.reduce((max, list) => Math.max(max, list.length), 0);

  for (let i = 0; i < maxLen; i++) {
    for (const list of lists) {
      const product = list[i];
      if (product && !seen.has(product.id)) {
        seen.add(product.id);
        merged.push(product);
      }
    }
  }

  return merged;
}

/**
 * Lista de compras v2 — estilo Mercado Libre: en lugar de un carrusel por
 * palabra, una barra de pestañas. La primera ("Todo") junta todos los
 * productos y el resto es una pestaña por término, mostradas en grilla con
 * scroll infinito.
 */
export default function ShoppingListTabs({
  terms,
  countryCode,
}: ShoppingListTabsProps) {
  const [byTerm, setByTerm] = useState<Record<string, TermState>>({});
  const [activeTab, setActiveTab] = useState<string>(ALL_TAB);
  // Active (demo-aware) sales channel so the shopping-list search scopes to the
  // demo's catalog instead of the build-time home channel.
  const { config } = useChannel();
  const salesChannelId = config.salesChannelId;

  // Espejo del estado para `loadMoreTerm`: lo llama el observer del centinela,
  // que no puede depender del render para saber en qué página va cada término
  // sin recrearse en cada tanda.
  const byTermRef = useRef(byTerm);
  useEffect(() => {
    byTermRef.current = byTerm;
  }, [byTerm]);

  // Cambiar la lista o el canal invalida lo que esté en vuelo: la página 2 de
  // la búsqueda anterior no debe aterrizar sobre los resultados nuevos.
  const generationRef = useRef(0);

  const termsKey = terms.join("\u0000");

  // Mantener el contenido cacheado solo para los términos vigentes y
  // resetear la pestaña activa si el término seleccionado fue removido.
  useEffect(() => {
    setByTerm((prev) => {
      const next: Record<string, TermState> = {};
      for (const term of terms) {
        if (prev[term]) next[term] = prev[term];
      }
      return next;
    });

    setActiveTab((current) =>
      current === ALL_TAB || terms.includes(current) ? current : ALL_TAB,
    );
  }, [terms]);

  // Primera página de cada término (en paralelo). La pestaña "Todo" necesita
  // todos los términos resueltos, así que los traemos siempre.
  useEffect(() => {
    generationRef.current += 1;
    let cancelled = false;

    for (const term of terms) {
      // Si el término ya tenía resultados no se pisa con el placeholder: así
      // no parpadea a skeleton mientras se refresca.
      setByTerm((prev) =>
        prev[term] ? prev : { ...prev, [term]: emptyTermState() },
      );

      searchProductsFromBrowser({
        q: term,
        page: 1,
        limit: RESULTS_PER_PAGE,
        sortBy: "relevance",
        salesChannelId,
      })
        .then((result) => {
          if (cancelled) return;
          setByTerm((prev) => ({
            ...prev,
            [term]: {
              products: result.products,
              found: result.found,
              page: result.page,
              totalPages: result.totalPages,
              loading: false,
              loadingMore: false,
              failed: false,
            },
          }));
        })
        .catch(() => {
          if (cancelled) return;
          setByTerm((prev) => ({
            ...prev,
            [term]: { ...emptyTermState(), loading: false, failed: true },
          }));
        });
    }

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termsKey, salesChannelId]);

  const loadMoreTerm = useCallback(
    (term: string) => {
      const state = byTermRef.current[term];
      if (!state || state.loading || state.loadingMore || state.failed) return;
      if (state.page === 0 || state.page >= state.totalPages) return;

      const nextPage = state.page + 1;
      const generation = generationRef.current;

      setByTerm((prev) =>
        prev[term]
          ? { ...prev, [term]: { ...prev[term], loadingMore: true } }
          : prev,
      );
      // El observer puede volver a disparar antes del próximo render, así que
      // el candado también se escribe en el espejo — si no, en "Todo" se
      // pedirían dos veces las mismas páginas.
      byTermRef.current = {
        ...byTermRef.current,
        [term]: { ...state, loadingMore: true },
      };

      searchProductsFromBrowser({
        q: term,
        page: nextPage,
        limit: RESULTS_PER_PAGE,
        sortBy: "relevance",
        salesChannelId,
      })
        .then((result) => {
          if (generationRef.current !== generation) return;
          setByTerm((prev) => {
            const current = prev[term];
            if (!current) return prev;

            const seen = new Set(current.products.map((p) => p.id));
            const appended = result.products.filter((p) => !seen.has(p.id));

            return {
              ...prev,
              [term]: {
                ...current,
                products: [...current.products, ...appended],
                found: result.found,
                page: Math.max(current.page, result.page),
                totalPages: result.totalPages,
                loadingMore: false,
              },
            };
          });
        })
        .catch(() => {
          if (generationRef.current !== generation) return;
          // Una tanda que falla no tira lo ya cargado, pero sí corta el scroll
          // infinito de ese término: el centinela sigue a la vista y
          // reintentaría en loop mientras el error persista.
          setByTerm((prev) => {
            const current = prev[term];
            if (!current) return prev;
            return {
              ...prev,
              [term]: {
                ...current,
                totalPages: current.page,
                loadingMore: false,
              },
            };
          });
        });
    },
    [salesChannelId],
  );

  const allProducts = useMemo(
    () => mergeAllProducts(terms, byTerm),
    [terms, byTerm],
  );

  const isAll = activeTab === ALL_TAB;

  // Total de la pestaña "Todo": la suma de los totales de cada término menos
  // los duplicados ya detectados al mergear. Es exacto con un solo término y
  // cuando está todo cargado, y nunca queda por debajo de lo que se ve.
  const allFound = useMemo(() => {
    const sumFound = terms.reduce(
      (sum, term) => sum + (byTerm[term]?.found ?? 0),
      0,
    );
    const loaded = terms.reduce(
      (sum, term) => sum + (byTerm[term]?.products.length ?? 0),
      0,
    );
    const duplicates = loaded - allProducts.length;
    return Math.max(sumFound - duplicates, allProducts.length);
  }, [terms, byTerm, allProducts.length]);

  // Estado de carga: en "Todo" mientras algún término siga cargando su primera
  // página; en una pestaña de término, mientras ese término no haya resuelto.
  const isLoading = isAll
    ? terms.some((term) => byTerm[term]?.loading ?? true)
    : byTerm[activeTab]?.loading ?? true;

  const activeProducts = isAll ? allProducts : byTerm[activeTab]?.products ?? [];
  const activeFailed = !isAll && Boolean(byTerm[activeTab]?.failed);

  // Términos que alimentan la pestaña actual: todos en "Todo", uno solo en una
  // pestaña de término.
  const activeTerms = isAll ? terms : [activeTab];

  const hasMore = activeTerms.some((term) => {
    const state = byTerm[term];
    return Boolean(state && state.page > 0 && state.page < state.totalPages);
  });

  const isLoadingMore = activeTerms.some((term) =>
    Boolean(byTerm[term]?.loadingMore),
  );

  // En "Todo" se avanza una página de CADA término para que el round-robin
  // siga representándolos a todos; en una pestaña, sólo la de ese término.
  const loadMore = useCallback(() => {
    for (const term of isAll ? terms : [activeTab]) {
      loadMoreTerm(term);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAll, termsKey, activeTab, loadMoreTerm]);

  if (terms.length === 0) return null;

  return (
    <div data-testid="shopping-list-results">
      <TabBar
        activeTab={activeTab}
        allCount={allFound}
        byTerm={byTerm}
        onSelect={setActiveTab}
        terms={terms}
      />

      <div className="pt-6">
        {isLoading ? (
          <SkeletonGrid />
        ) : activeFailed ? (
          <EmptyState
            message="No pudimos buscar este término. Probá de nuevo."
          />
        ) : activeProducts.length === 0 ? (
          <EmptyState
            message={
              isAll
                ? "Todavía no hay productos para tu lista."
                : `No encontramos productos para "${activeTab}".`
            }
          />
        ) : (
          <>
            <ul className="grid grid-cols-2 items-stretch justify-items-center gap-x-2 gap-y-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {activeProducts.map((product) => (
                <li className="flex w-full max-w-[216px]" key={product.id}>
                  <TypesenseProductCard
                    countryCode={countryCode}
                    product={product}
                  />
                </li>
              ))}
            </ul>

            <InfiniteScrollSentinel
              disabled={!hasMore}
              isLoading={isLoadingMore}
              onIntersect={loadMore}
            >
              <SkeletonGrid count={5} />
            </InfiniteScrollSentinel>
          </>
        )}
      </div>
    </div>
  );
}

type TabBarProps = {
  terms: string[];
  activeTab: string;
  allCount: number;
  byTerm: Record<string, TermState>;
  onSelect: (tab: string) => void;
};

function TabBar({ terms, activeTab, allCount, byTerm, onSelect }: TabBarProps) {
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Mantener la pestaña activa visible al cambiarla (scroll horizontal).
  useEffect(() => {
    const node = tabRefs.current[activeTab];
    node?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [activeTab]);

  const renderTab = (key: string, label: string, count?: number) => {
    const active = activeTab === key;
    return (
      <button
        className={`relative whitespace-nowrap px-1 pb-3 text-sm transition first-letter:uppercase ${
          active
            ? "font-semibold text-[--primary-color]"
            : "font-medium text-gray-500 hover:text-gray-800"
        }`}
        data-shopping-list-tab={key}
        data-testid="shopping-list-tab"
        key={key}
        onClick={() => onSelect(key)}
        ref={(node) => {
          tabRefs.current[key] = node;
        }}
        type="button"
      >
        {label}
        {typeof count === "number" && count > 0 ? (
          <span className="ml-1.5 text-gray-400 text-xs">
            {formatCount(count)}
          </span>
        ) : null}
        {active ? (
          <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-[--primary-color]" />
        ) : null}
      </button>
    );
  };

  return (
    <div className="relative border-gray-200 border-b">
      <div className="no-scrollbar flex items-center gap-6 overflow-x-auto">
        {renderTab(ALL_TAB, "Todo", allCount)}
        {terms.map((term) => {
          const state = byTerm[term];
          // El contador es el total de matches del término, no lo cargado: si
          // mostrara lo cargado, la pestaña diría 24 con 256 disponibles.
          const count = state?.found;
          return renderTab(term, term, count);
        })}
      </div>
    </div>
  );
}

function SkeletonGrid({ count = 10 }: { count?: number }) {
  return (
    <ul
      aria-busy="true"
      className="grid grid-cols-2 items-stretch justify-items-center gap-x-2 gap-y-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
    >
      {Array.from({ length: count }).map((_, i) => (
        <li className="flex w-full max-w-[216px]" key={i}>
          <div className="h-[280px] w-full animate-pulse rounded-xl bg-gray-100" />
        </li>
      ))}
    </ul>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center rounded-xl border border-gray-300 border-dashed bg-gray-50 px-4 py-12">
      <p className="text-center text-gray-500 text-sm">{message}</p>
    </div>
  );
}
