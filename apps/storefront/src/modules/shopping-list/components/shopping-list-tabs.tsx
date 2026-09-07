"use client";

import { useChannel } from "@lib/context/channel-context";
import { searchProductsFromBrowser } from "@lib/typesense/search-browser";
import type { TypesenseProductDocument } from "@lib/typesense/types";
import TypesenseProductCard from "@modules/store/templates/typesense-product-card";
import { useEffect, useMemo, useRef, useState } from "react";

type ShoppingListTabsProps = {
  terms: string[];
  countryCode: string;
};

const RESULTS_PER_TERM = 24;

const ALL_TAB = "__all__";

type TermState = {
  products: TypesenseProductDocument[] | null;
  failed: boolean;
};

/**
 * Combina los resultados de cada término en una sola lista, intercalándolos
 * (round-robin) para que todos los términos queden representados arriba, y
 * deduplica por id. Es lo que alimenta la pestaña "Todo".
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
 * productos y el resto es una pestaña por término, mostradas en grilla.
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

  // Fetch de cada término una sola vez (en paralelo). La pestaña "Todo"
  // necesita todos los términos resueltos, así que los traemos siempre.
  useEffect(() => {
    let cancelled = false;

    for (const term of terms) {
      setByTerm((prev) =>
        prev[term]
          ? prev
          : { ...prev, [term]: { products: null, failed: false } },
      );

      searchProductsFromBrowser({
        q: term,
        limit: RESULTS_PER_TERM,
        sortBy: "relevance",
        salesChannelId,
      })
        .then((result) => {
          if (cancelled) return;
          setByTerm((prev) => ({
            ...prev,
            [term]: { products: result.products, failed: false },
          }));
        })
        .catch(() => {
          if (cancelled) return;
          setByTerm((prev) => ({
            ...prev,
            [term]: { products: null, failed: true },
          }));
        });
    }

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terms.join(" "), salesChannelId]);

  const allProducts = useMemo(
    () => mergeAllProducts(terms, byTerm),
    [terms, byTerm],
  );

  const isAll = activeTab === ALL_TAB;

  // Estado de carga: en "Todo" mientras algún término siga cargando; en una
  // pestaña de término, mientras ese término no haya resuelto.
  const isLoading = isAll
    ? terms.some((term) => byTerm[term]?.products == null && !byTerm[term]?.failed)
    : byTerm[activeTab]?.products == null && !byTerm[activeTab]?.failed;

  const activeProducts = isAll ? allProducts : byTerm[activeTab]?.products ?? [];
  const activeFailed = !isAll && Boolean(byTerm[activeTab]?.failed);

  const totalCount = allProducts.length;

  if (terms.length === 0) return null;

  return (
    <div data-testid="shopping-list-results">
      <TabBar
        activeTab={activeTab}
        allCount={totalCount}
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
          <span className="ml-1.5 text-gray-400 text-xs">{count}</span>
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
          const count = state?.products?.length;
          return renderTab(term, term, count);
        })}
      </div>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <ul
      aria-busy="true"
      className="grid grid-cols-2 items-stretch justify-items-center gap-x-2 gap-y-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
    >
      {Array.from({ length: 10 }).map((_, i) => (
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
