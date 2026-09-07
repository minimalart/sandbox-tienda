"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Download, Minus, Plus, Share2, ZoomIn, ZoomOut } from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import { convertToLocale } from "@lib/util/money";
import {
  PLACEHOLDER_IMAGE,
  handleImageError,
} from "@lib/util/placeholder-image";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import { useCatalogCartStore } from "../catalog-cart.store";
import { CatalogCartSheet } from "./catalog-cart-sheet";
import type {
  PdfCatalogData,
  PdfCatalogHotspot,
  PdfCatalogProduct,
} from "@lib/data/pdf-catalog";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

const DEFAULT_ASPECT = 1.414; // alto/ancho A4 (fallback hasta leer la página real)
const ZOOM_MIN = 1;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.5;

// ── Spreads: portada sola, luego pares (1,2),(3,4)…; última sola si sobra ──
function buildSpreads(total: number): number[][] {
  if (total === 0) return [];
  const spreads: number[][] = [[0]];
  let i = 1;
  while (i < total) {
    if (i + 1 < total) {
      spreads.push([i, i + 1]);
      i += 2;
    } else {
      spreads.push([i]);
      i++;
    }
  }
  return spreads;
}

function extractYoutubeId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([\w-]{11})/,
    /(?:youtube\.com\/embed\/)([\w-]{11})/,
    /(?:youtube\.com\/shorts\/)([\w-]{11})/,
    /(?:youtu\.be\/)([\w-]{11})/,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
}

// Precios con el mismo formato que la tienda: convertToLocale (sin símbolo) con
// prefijo "$ " — idéntico al drawer del carrito real (consistencia de plantilla).
export function fmtPrice(amount: number | null, currency: string | null): string {
  if (amount == null) return "";
  return `$ ${convertToLocale({
    amount,
    currency_code: (currency || "ARS").toLowerCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    locale: "es-AR",
  })}`;
}

type ActiveModal =
  | { type: "product"; product: PdfCatalogProduct }
  | { type: "video"; data: Record<string, unknown> }
  | { type: "text"; data: Record<string, unknown> }
  | null;

export default function PdfCatalogViewer({
  catalog,
  countryCode,
  whatsappNumber,
}: {
  catalog: PdfCatalogData;
  countryCode: string;
  whatsappNumber?: string;
}) {
  const [numPages, setNumPages] = useState(catalog.pages || 0);
  const [spreadIndex, setSpreadIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [pageWidth, setPageWidth] = useState(400);
  // Aspecto real (alto/ancho) de la página del PDF; se lee al cargar la 1ª
  // página. Antes estaba fijo a A4, y un PDF más alto se salía del viewport.
  const [pageAspect, setPageAspect] = useState(DEFAULT_ASPECT);
  const [modal, setModal] = useState<ActiveModal>(null);
  const [zoom, setZoom] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [shareState, setShareState] = useState<"idle" | "copied">("idle");
  const containerRef = useRef<HTMLDivElement>(null);

  // El bucket S3 no manda CORS: el PDF se lee por el proxy same-origin del
  // storefront (/api/pdf-catalog/file) en lugar de la URL pública del bucket.
  const pdfProxyUrl = useMemo(
    () => `/api/pdf-catalog/file?countryCode=${encodeURIComponent(countryCode)}`,
    [countryCode]
  );

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Recalcula el ancho de página para que el spread SIEMPRE entre completo en
  // el viewport (alto y ancho), con padding alrededor, usando el aspecto real
  // del PDF. Tomamos el menor entre "lo que permite el alto" y "lo que permite
  // el ancho" → nunca se recorta.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const compute = () => {
      const containerW = el.clientWidth;
      const containerH = el.clientHeight;
      // Padding vertical: deja aire arriba (header flotante) y abajo (nav
      // mobile). Padding horizontal: aire + flechas de navegación en desktop.
      const padY = isMobile ? 132 : 88;
      const padX = isMobile ? 32 : 160;
      const perPage = isMobile ? 1 : 2;
      const byHeight = (containerH - padY) / pageAspect;
      const byWidth = (containerW - padX) / perPage;
      const width = Math.floor(Math.max(160, Math.min(byHeight, byWidth)));
      setPageWidth(width);
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isMobile, pageAspect]);

  const spreads = useMemo(() => buildSpreads(numPages), [numPages]);
  const mobileSpreads = useMemo(
    () => Array.from({ length: numPages }, (_, i) => [i]),
    [numPages]
  );
  const activeSpreads = isMobile ? mobileSpreads : spreads;
  const canPrev = spreadIndex > 0;
  const canNext = spreadIndex < activeSpreads.length - 1;
  const currentSpread = activeSpreads[spreadIndex] ?? [];

  const goNext = useCallback(() => setSpreadIndex((s) => (s < activeSpreads.length - 1 ? s + 1 : s)), [activeSpreads.length]);
  const goPrev = useCallback(() => setSpreadIndex((s) => (s > 0 ? s - 1 : s)), []);

  // Salta al spread que contiene una página dada (1-based).
  const goToPage = useCallback(
    (pageNum: number) => {
      if (!numPages) return;
      const idx = Math.min(Math.max(1, Math.round(pageNum)), numPages) - 1;
      const spreadIdx = activeSpreads.findIndex((s) => s.includes(idx));
      if (spreadIdx >= 0) setSpreadIndex(spreadIdx);
    },
    [activeSpreads, numPages]
  );

  // Mantener el input de página en sync con el spread visible.
  useEffect(() => {
    if (currentSpread.length) setPageInput(String(currentSpread[0] + 1));
  }, [currentSpread]);

  const zoomIn = useCallback(() => setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP)), []);
  const zoomOut = useCallback(() => setZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP)), []);

  const handleDownload = useCallback(() => {
    const a = document.createElement("a");
    a.href = pdfProxyUrl;
    a.download = `${catalog.name || "catalogo"}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [pdfProxyUrl, catalog.name]);

  const handleShare = useCallback(async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const shareData = {
      title: catalog.name,
      text: `Mirá el catálogo ${catalog.name}`,
      url,
    };
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share(shareData);
      } else if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setShareState("copied");
        setTimeout(() => setShareState("idle"), 1500);
      }
    } catch {
      // usuario canceló el share nativo: sin acción
    }
  }, [catalog.name]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // No robar las flechas mientras se escribe en el input de página.
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "+" || e.key === "=") zoomIn();
      if (e.key === "-") zoomOut();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev, zoomIn, zoomOut]);

  const onPageLoadSuccess = useCallback(
    (page: { originalWidth?: number; originalHeight?: number }) => {
      if (page.originalWidth && page.originalHeight) {
        const a = page.originalHeight / page.originalWidth;
        setPageAspect((prev) => (Math.abs(prev - a) > 0.01 ? a : prev));
      }
    },
    []
  );

  const onHotspotClick = (h: PdfCatalogHotspot) => {
    if (h.type === "product" && h.product) setModal({ type: "product", product: h.product });
    else if (h.type === "video") setModal({ type: "video", data: h.data ?? {} });
    else if (h.type === "text") setModal({ type: "text", data: h.data ?? {} });
  };

  const renderOverlay = (pageIndex: number) =>
    catalog.hotspots
      .filter((h) => h.page_index === pageIndex)
      .map((h) => (
        <button
          key={h.id}
          type="button"
          onClick={() => onHotspotClick(h)}
          style={{ left: `${h.pos_x}%`, top: `${h.pos_y}%` }}
          aria-label="Ver detalle"
          className="absolute -translate-x-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-white/90 shadow-md ring-2 ring-black/70 flex items-center justify-center"
        >
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/60" />
          <span className="relative h-2 w-2 rounded-full bg-black" />
        </button>
      ));

  return (
    <div
      className="relative flex h-dvh w-screen flex-col overflow-hidden bg-neutral-100"
      suppressHydrationWarning
    >
      {/* Header flotante: volver + título del catálogo */}
      <div className="absolute left-3 top-3 z-30 flex items-center gap-2 rounded-lg bg-white/85 px-2 py-1.5 shadow-md backdrop-blur-sm">
        <LocalizedClientLink
          href="/"
          aria-label="Volver al inicio"
          className="flex h-8 w-8 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
        </LocalizedClientLink>
        <h1 className="max-w-[90px] truncate text-sm font-semibold leading-tight text-gray-900 sm:max-w-[200px]">
          {catalog.name}
        </h1>
      </div>

      {/* Toolbar flotante arriba a la derecha: zoom, compartir, descargar */}
      <div className="absolute right-3 top-3 z-30 flex items-center gap-1 rounded-lg bg-white/85 px-1.5 py-1.5 shadow-md backdrop-blur-sm">
        <button
          type="button"
          onClick={zoomOut}
          disabled={zoom <= ZOOM_MIN}
          aria-label="Alejar"
          className="flex h-8 w-8 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-30"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={zoomIn}
          disabled={zoom >= ZOOM_MAX}
          aria-label="Acercar"
          className="flex h-8 w-8 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-30"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <span className="mx-0.5 h-5 w-px bg-gray-200" />
        <button
          type="button"
          onClick={handleShare}
          aria-label="Compartir"
          className="flex h-8 w-8 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 hover:text-gray-900"
        >
          {shareState === "copied" ? (
            <Check className="h-4 w-4 text-green-600" />
          ) : (
            <Share2 className="h-4 w-4" />
          )}
        </button>
        <button
          type="button"
          onClick={handleDownload}
          aria-label="Descargar PDF"
          className="flex h-8 w-8 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 hover:text-gray-900"
        >
          <Download className="h-4 w-4" />
        </button>
      </div>

      {/* Indicador de página editable, flotante */}
      {numPages > 0 && (
        <div className="absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/10 px-2 py-0.5 text-xs text-gray-700 backdrop-blur-sm">
          <input
            type="number"
            min={1}
            max={numPages}
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                goToPage(Number(pageInput));
                e.currentTarget.blur();
              }
            }}
            onBlur={() => goToPage(Number(pageInput))}
            aria-label="Ir a la página"
            className="w-8 rounded bg-white/70 text-center tabular-nums outline-none focus:bg-white focus:ring-1 focus:ring-black/20 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <span className="tabular-nums">/ {numPages}</span>
        </div>
      )}

      {/* Área del PDF — ocupa todo el viewport; scrolleable al hacer zoom */}
      <div ref={containerRef} className="relative flex h-full w-full flex-1 select-none">
        <div className={`h-full w-full ${zoom > 1 ? "overflow-auto" : "overflow-hidden"}`}>
          {/* min-w/h-full + centrado: entero y centrado a zoom 1; scrolleable sin
              recortar cuando el zoom lo agranda. */}
          <div className="flex min-h-full min-w-full items-center justify-center p-2">
            <Document
              file={pdfProxyUrl}
              onLoadSuccess={({ numPages: n }) => setNumPages(n)}
              loading={<div className="p-12 text-gray-400">Cargando…</div>}
              error={<div className="p-12 text-red-500">No se pudo cargar el PDF</div>}
            >
              <div className="flex items-stretch gap-px overflow-hidden rounded-sm shadow-2xl">
                {currentSpread.map((pageIdx) => (
                  <div key={pageIdx} className="relative">
                    <Page
                      pageNumber={pageIdx + 1}
                      width={Math.round(pageWidth * zoom)}
                      onLoadSuccess={onPageLoadSuccess}
                      renderAnnotationLayer={false}
                      renderTextLayer={false}
                    />
                    <div className="absolute inset-0">{renderOverlay(pageIdx)}</div>
                  </div>
                ))}
              </div>
            </Document>
          </div>
        </div>

        <button
          onClick={goPrev}
          disabled={!canPrev}
          className="hidden md:flex absolute left-3 top-1/2 z-10 h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 shadow-md disabled:opacity-20 hover:bg-white"
          aria-label="Anterior"
        >
          ‹
        </button>
        <button
          onClick={goNext}
          disabled={!canNext}
          className="hidden md:flex absolute right-3 top-1/2 z-10 h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 shadow-md disabled:opacity-20 hover:bg-white"
          aria-label="Siguiente"
        >
          ›
        </button>
      </div>

      {/* Nav mobile, flotante abajo (no empuja el layout) */}
      <div className="md:hidden absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-4">
        <button
          onClick={goPrev}
          disabled={!canPrev}
          aria-label="Anterior"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-md disabled:opacity-30"
        >
          ‹
        </button>
        <button
          onClick={goNext}
          disabled={!canNext}
          aria-label="Siguiente"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-md disabled:opacity-30"
        >
          ›
        </button>
      </div>

      {/* Carrito propio del catálogo (se envía por WhatsApp) */}
      <CatalogCartSheet whatsappNumber={whatsappNumber} />

      {modal?.type === "product" && (
        <ProductModal
          product={modal.product}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "video" && <VideoModal data={modal.data} onClose={() => setModal(null)} />}
      {modal?.type === "text" && <TextModal data={modal.data} onClose={() => setModal(null)} />}
    </div>
  );
}

// ── Modales ──────────────────────────────────────────────────────────────────

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

// Quick view del producto: reutiliza el lenguaje visual de la tienda
// (tarjeta redondeada, precio con --primary-color, stepper con divide-x,
// botón primario h-12 rounded-md con el color de la plantilla).
function ProductModal({
  product,
  onClose,
}: {
  product: PdfCatalogProduct;
  onClose: () => void;
}) {
  const addItem = useCatalogCartStore((s) => s.addItem);
  const initialVariant =
    product.variant_id
      ? product.variants.find((v) => v.id === product.variant_id) ?? product.variants[0]
      : product.variants[0];
  const [variantId, setVariantId] = useState<string | undefined>(initialVariant?.id);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const variant = product.variants.find((v) => v.id === variantId) ?? initialVariant;
  const price = fmtPrice(variant?.calculated_amount ?? null, variant?.currency_code ?? null);
  const hasMultipleVariants = product.variants.length > 1;
  const outOfStock = (variant?.available ?? 0) <= 0;

  const handleAdd = () => {
    if (!variant) return;
    const name = hasMultipleVariants && variant.title
      ? `${product.title ?? ""} — ${variant.title}`.trim()
      : product.title ?? variant.title ?? "Producto";
    addItem(
      {
        key: variant.id,
        productId: product.product_id,
        variantId: variant.id,
        name,
        price: variant.calculated_amount ?? null,
        currency: variant.currency_code ?? null,
        image: product.thumbnail ?? null,
      },
      qty
    );
    setAdded(true);
    setTimeout(onClose, 700);
  };

  return (
    <Overlay onClose={onClose}>
      {/* biome-ignore lint/a11y/useAltText: alt provisto */}
      <img
        src={product.thumbnail || PLACEHOLDER_IMAGE}
        onError={handleImageError}
        alt={product.title}
        className="mx-auto mb-4 max-h-[38vh] w-auto rounded-xl border border-gray-200 bg-white object-contain p-2"
      />
      <h2 className="font-semibold text-gray-900 text-lg leading-snug">{product.title}</h2>
      {price && (
        <p className="mt-1 font-bold text-2xl text-[--primary-color]">{price}</p>
      )}

      {hasMultipleVariants && (
        <select
          value={variantId}
          onChange={(e) => setVariantId(e.target.value)}
          className="mt-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-[--primary-color] focus:outline-none"
        >
          {product.variants.map((v) => (
            <option key={v.id} value={v.id} disabled={v.available <= 0}>
              {v.title || v.id} {v.available <= 0 ? "(sin stock)" : ""}
            </option>
          ))}
        </select>
      )}

      <div className="mt-5 flex items-center gap-3">
        <div className="flex items-stretch divide-x divide-gray-200 overflow-hidden rounded-[10px] border border-gray-200">
          <button
            className="flex h-11 w-10 items-center justify-center text-gray-700 hover:bg-gray-100"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            aria-label="Restar"
            type="button"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="flex w-9 items-center justify-center font-medium text-sm tabular-nums">
            {qty}
          </span>
          <button
            className="flex h-11 w-10 items-center justify-center text-gray-700 hover:bg-gray-100"
            onClick={() => setQty((q) => q + 1)}
            aria-label="Sumar"
            type="button"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <button
          onClick={handleAdd}
          disabled={!variant || outOfStock}
          className="h-11 flex-1 rounded-md font-medium text-sm text-white transition-colors disabled:cursor-not-allowed disabled:bg-gray-300"
          style={{ backgroundColor: variant && !outOfStock ? "var(--primary-color)" : undefined }}
          type="button"
        >
          {outOfStock ? "Sin stock" : added ? "¡Agregado!" : "Agregar al pedido"}
        </button>
      </div>
    </Overlay>
  );
}

function VideoModal({ data, onClose }: { data: Record<string, unknown>; onClose: () => void }) {
  const id = extractYoutubeId(String(data.youtubeUrl ?? ""));
  return (
    <Overlay onClose={onClose}>
      {data.title ? <h2 className="mb-3 font-semibold text-gray-900 text-lg">{String(data.title)}</h2> : null}
      {id ? (
        <div className="aspect-video overflow-hidden rounded-lg">
          <iframe
            className="h-full w-full"
            src={`https://www.youtube.com/embed/${id}?autoplay=1`}
            allow="autoplay; encrypted-media"
            allowFullScreen
          />
        </div>
      ) : (
        <p className="text-gray-500">URL de video no válida</p>
      )}
    </Overlay>
  );
}

function TextModal({ data, onClose }: { data: Record<string, unknown>; onClose: () => void }) {
  return (
    <Overlay onClose={onClose}>
      {data.title ? <h2 className="mb-3 font-semibold text-gray-900 text-lg">{String(data.title)}</h2> : null}
      <p className="whitespace-pre-wrap text-gray-700">{String(data.content ?? "")}</p>
    </Overlay>
  );
}
