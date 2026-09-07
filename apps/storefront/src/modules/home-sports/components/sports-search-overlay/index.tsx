"use client";

import { Dialog, DialogPanel } from "@headlessui/react";
import { useChannelSafe } from "@lib/context/channel-context";
import { useDemoHref, useTenant } from "@lib/site-config/context";
import type { TypesenseProductDocument } from "@lib/typesense";
import { searchProductsFromBrowser } from "@lib/typesense/search-browser";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import SportsProductCard from "@modules/home-sports/components/sports-featured-products/sports-product-card";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import "../../sports-theme.css";
import { AUTOCOMPLETE_DEBOUNCE_MS } from "@lib/typesense/core/timing";

const INSPIRATION_LIMIT = 10;
const RESULTS_LIMIT = 24;

type NavLink = { id: string; name: string; href: string };

type SportsSearchOverlayProps = {
  open: boolean;
  onClose: () => void;
  placeholder?: string;
  /** Navegación del header: accesos rápidos reales (la tienda se organiza por
   *  marca, sin product-categories que listar). */
  navLinks?: NavLink[];
};

/**
 * Overlay de búsqueda del template deportivo (estilo H&M): ocupa el alto
 * completo, con título, input centrado, "Accesos rápidos" (navegación real) e
 * "inspiración" con productos reales. Tanto la inspiración como el filtrado
 * instantáneo salen de Typesense (mismo origen que el resto de las cards), así
 * que es rápido y respeta el sales channel activo (incl. demos).
 */
export default function SportsSearchOverlay({
  open,
  onClose,
  placeholder = "Buscar",
  navLinks = [],
}: SportsSearchOverlayProps) {
  const router = useRouter();
  const demoHref = useDemoHref();
  const tenant = useTenant();
  const salesChannelId = useChannelSafe()?.config.salesChannelId;

  const [query, setQuery] = useState("");
  const [inspiration, setInspiration] = useState<TypesenseProductDocument[]>([]);
  const [inspirationLoading, setInspirationLoading] = useState(false);
  const [results, setResults] = useState<TypesenseProductDocument[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const railRef = useRef<HTMLDivElement>(null);

  // Manejadores del carrusel de inspiración: avanzan/retroceden una página y
  // hacen loop (al llegar al final vuelven al inicio y viceversa).
  const scrollRail = useCallback((dir: "prev" | "next") => {
    const el = railRef.current;
    if (!el) return;
    const page = Math.max(el.clientWidth * 0.8, 1);
    const maxLeft = el.scrollWidth - el.clientWidth;
    const atEnd = el.scrollLeft >= maxLeft - 8;
    const atStart = el.scrollLeft <= 8;
    const left =
      dir === "next"
        ? atEnd
          ? 0
          : el.scrollLeft + page
        : atStart
          ? maxLeft
          : el.scrollLeft - page;
    el.scrollTo({ left, behavior: "smooth" });
  }, []);

  // Inspiración: top de productos del canal, una vez por apertura.
  useEffect(() => {
    if (!open) return;
    let active = true;
    setInspirationLoading(true);
    (async () => {
      try {
        const data = await searchProductsFromBrowser({
          q: "*",
          sortBy: "relevance",
          limit: INSPIRATION_LIMIT,
          salesChannelId,
        });
        if (active) setInspiration(data.products);
      } catch (e) {
        console.error("[SportsSearchOverlay] inspiración", e);
      } finally {
        if (active) setInspirationLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [open, salesChannelId]);

  // Reset al cerrar.
  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setSearching(false);
    }
  }, [open]);

  // Filtrado instantáneo (debounced) directo a Typesense mientras se tipea.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (!q) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await searchProductsFromBrowser({
          q,
          sortBy: "relevance",
          limit: RESULTS_LIMIT,
          salesChannelId,
        });
        setResults(data.products);
      } catch (e) {
        console.error("[SportsSearchOverlay] búsqueda", e);
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, AUTOCOMPLETE_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, salesChannelId]);

  const hasQuery = query.trim().length > 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    router.push(demoHref(q ? `/store?q=${encodeURIComponent(q)}` : "/store"));
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} className="sports-home relative z-[70]">
      <div className="fixed inset-0 z-[71] flex flex-col overflow-y-auto bg-[--sp-paper]">
        <DialogPanel className="mx-auto flex min-h-full w-full max-w-[1200px] flex-col px-4 pt-6 pb-12 sm:px-6 lg:px-10">
          {/* Encabezado */}
          <div className="relative flex items-center justify-center">
            <h2 className="sp-section-title text-center text-[20px] sm:text-[22px]">
              Buscar en {tenant.name}
            </h2>
            <button
              type="button"
              aria-label="Cerrar búsqueda"
              onClick={onClose}
              className="absolute right-0 inline-flex size-9 items-center justify-center text-[--sp-ink] transition hover:opacity-60"
            >
              <X className="size-6" strokeWidth={2} />
            </button>
          </div>

          {/* Input */}
          <form
            role="search"
            onSubmit={submit}
            className="mx-auto mt-5 flex w-full max-w-2xl items-center gap-3 border-2 border-[--sp-ink] bg-white px-4 py-3"
          >
            <Search className="size-5 text-[--sp-ink]" strokeWidth={2} />
            <input
              autoFocus
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              aria-label="Buscar"
              className="h-6 flex-1 border-0 bg-transparent text-[15px] text-[--sp-ink] outline-none placeholder:text-[--sp-subtle]"
            />
            {query && (
              <button
                type="button"
                aria-label="Limpiar"
                onClick={() => setQuery("")}
                className="text-[--sp-subtle] transition hover:text-[--sp-ink]"
              >
                <X className="size-4" strokeWidth={2} />
              </button>
            )}
          </form>

          {/* Cuerpo */}
          <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[200px_1fr]">
            {/* Accesos rápidos (navegación real del header) */}
            <div>
              <h3 className="sp-eyebrow">Accesos rápidos</h3>
              <ul className="mt-4 space-y-2.5">
                {navLinks.map((item) => (
                  <li key={item.id}>
                    <LocalizedClientLink
                      href={item.href}
                      onClick={onClose}
                      className="text-[14px] font-medium text-[--sp-ink] hover:underline"
                    >
                      {item.name}
                    </LocalizedClientLink>
                  </li>
                ))}
              </ul>
            </div>

            {/* Inspiración / resultados (Typesense → mismas cards) */}
            <div className="min-w-0">
              <h3 className="sp-eyebrow">
                {hasQuery
                  ? `Resultados${results.length ? ` (${results.length})` : ""}`
                  : "¿Necesitás inspiración?"}
              </h3>

              {hasQuery ? (
                results.length > 0 ? (
                  <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
                    {results.map((product) => (
                      <SportsProductCard
                        key={product.id}
                        product={product}
                        showWishlist={false}
                        onNavigate={onClose}
                      />
                    ))}
                  </div>
                ) : searching ? (
                  <p className="mt-4 text-[14px] text-[--sp-subtle]">Buscando…</p>
                ) : (
                  <p className="mt-4 text-[14px] text-[--sp-subtle]">
                    No encontramos productos para “{query.trim()}”.
                  </p>
                )
              ) : inspiration.length > 0 ? (
                /* Carrusel acotado al ancho, con manejadores y loop (10 sugeridos) */
                <div className="relative mt-4">
                  <div
                    ref={railRef}
                    className="sp-no-scrollbar flex gap-4 overflow-x-auto scroll-smooth"
                  >
                    {inspiration.map((product) => (
                      <div
                        key={product.id}
                        className="w-[44%] shrink-0 sm:w-[31%] md:w-[23%] lg:w-[18.5%]"
                      >
                        <SportsProductCard
                          product={product}
                          showWishlist={false}
                          onNavigate={onClose}
                        />
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    aria-label="Anterior"
                    onClick={() => scrollRail("prev")}
                    className="-translate-y-1/2 absolute top-1/3 left-0 z-10 inline-flex size-9 items-center justify-center border border-[--sp-ink] bg-white text-[--sp-ink] transition hover:bg-[--sp-ink] hover:text-[--sp-on-dark]"
                  >
                    <ChevronLeft className="size-5" strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    aria-label="Siguiente"
                    onClick={() => scrollRail("next")}
                    className="-translate-y-1/2 absolute top-1/3 right-0 z-10 inline-flex size-9 items-center justify-center border border-[--sp-ink] bg-white text-[--sp-ink] transition hover:bg-[--sp-ink] hover:text-[--sp-on-dark]"
                  >
                    <ChevronRight className="size-5" strokeWidth={2} />
                  </button>
                </div>
              ) : inspirationLoading ? (
                <p className="mt-4 text-[14px] text-[--sp-subtle]">Cargando…</p>
              ) : null}
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
