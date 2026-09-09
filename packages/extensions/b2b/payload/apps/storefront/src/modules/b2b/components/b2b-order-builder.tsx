"use client";

import { presentationFactor, type CatalogCommercial } from "@lib/util/catalog-commercial";
import type { B2BPriceInfo } from "@lib/data/company";
import { useTypesenseProducts } from "@lib/hooks/use-typesense-products";
import { useDemoHref } from "@lib/site-config/context";
import { handleImageError } from "@lib/util/placeholder-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import InfiniteScrollSentinel from "@modules/store/components/infinite-scroll-sentinel";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import { ArrowLeft, Check, Loader2, Search, ShoppingCart, Trash2, X } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type Tier = { minQty: number; discount: number };

type Props = {
  company: { id: string; name: string };
  placedBy: { id: string; email: string };
  /** Canal mayorista de la empresa (o del demo). Ausente → canal B2C de env. */
  salesChannelId?: string;
  /** Escalas mayoristas por cantidad (demo B2B). Ausente = sin escalas. */
  tiers?: Tier[];
};

/**
 * Fila por variante del selector. Los productos vienen de Typesense (instantáneo)
 * y el precio mayorista + stock llegan aparte por lote (/api/b2b/prices, price
 * list por customer group). `pending` = el lote de su producto todavía no llegó
 * → shimmer en el precio y stepper deshabilitado.
 */
type BuilderRow = {
  commercial?: CatalogCommercial;
  product_id: string;
  variant_id: string;
  sku: string | null;
  product_title: string;
  variant_title: string;
  thumbnail?: string | null;
  available: number;
  unit_price: number | null;
  pending: boolean;
};

const fmt = (n?: number | null) => (n == null ? "—" : `$${Math.round(n).toLocaleString("es-AR")}`);

/**
 * Precio unitario efectivo para una cantidad, aplicando las escalas. `unitPrice`
 * es el precio del primer tramo (minQty 1); reconstruimos la base y aplicamos el
 * tramo de mayor `minQty` que la cantidad alcanza. Coincide con lo que el motor
 * de precios cobra en el carrito por `min_quantity`. Sin tiers → precio unitario.
 */
const priceForQty = (unitPrice: number | null, tiers: Tier[] | undefined, qty: number): number | null => {
  if (unitPrice == null) return unitPrice;
  if (!tiers || tiers.length === 0) return unitPrice;
  const sorted = [...tiers].sort((a, b) => a.minQty - b.minQty);
  const first = sorted[0]!;
  if (first.discount >= 1) return unitPrice;
  const base = unitPrice / (1 - first.discount);
  const q = Math.max(1, qty);
  const applicable = [...sorted].reverse().find((t) => q >= t.minQty) ?? first;
  return base * (1 - applicable.discount);
};

/** Quiebres por cantidad a mostrar como hint (tramos con minQty > 1). */
const tierBreaks = (unitPrice: number | null, tiers?: Tier[]): Array<{ minQty: number; price: number }> => {
  if (unitPrice == null || !tiers || tiers.length < 2) return [];
  const sorted = [...tiers].sort((a, b) => a.minQty - b.minQty);
  const first = sorted[0]!;
  if (first.discount >= 1) return [];
  const base = unitPrice / (1 - first.discount);
  return sorted.filter((t) => t.minQty > 1).map((t) => ({ minQty: t.minQty, price: base * (1 - t.discount) }));
};

/**
 * Stepper de cantidad por fila. Definido a nivel de módulo (no dentro del
 * componente) para que su identidad sea estable entre renders: si se define
 * inline, cada `setQty` recrea la función → React desmonta y remonta el input
 * → el foco se pierde tras la primera tecla.
 */
function Stepper({
  row,
  qty,
  onChange,
  mode,
  onMode,
}: {
  mode: "unit" | "package";
  onMode: (mode: "unit" | "package") => void;
  row: BuilderRow;
  qty: number;
  onChange: (vid: string, n: number) => void;
}) {
  const disabled = row.pending || row.unit_price == null || row.available <= 0;
  const factor = mode === "package" ? presentationFactor(row.commercial) : 1;
  const shown = qty / factor;
  const p = row.commercial?.presentation;
  const policy = row.commercial?.purchasePolicy;
  const canPackage = policy?.enabled && policy.allowedModes?.includes("package") && (presentationFactor(row.commercial) > 1 || (p?.mode === "own-sku" && p.priceBasis === "sku"));
  return (<div className="space-y-1">
    {canPackage && <select aria-label={`Presentación de ${row.product_title}`} value={mode} onChange={e => onMode(e.target.value as "unit" | "package")} className="w-full rounded border bg-background px-1 py-1 text-xs focus-visible:outline focus-visible:outline-2">
      {(policy?.allowedModes?.includes("unit") ?? true) && <option value="unit">{p?.mode === "own-sku" ? "SKU" : "Unidades"}</option>}
      <option value="package" disabled={qty > 0 && qty % presentationFactor(row.commercial) !== 0}>{p?.label || "Bulto"}{p?.unitsPerPackage ? ` × ${p.unitsPerPackage}` : ""}</option>
    </select>}

    <div className="flex items-center justify-center gap-1">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(row.variant_id, qty - factor)}
        className="flex size-7 items-center justify-center rounded-md border border-input text-foreground hover:bg-muted disabled:opacity-40"
      >
        −
      </button>
      <input
        type="number"
        min={0}
        disabled={disabled}
        aria-label={`Cantidad de ${row.product_title}`}
        value={shown || ""}
        onChange={(e) => onChange(row.variant_id, (Number(e.target.value) || 0) * factor)}
        className={cn(
          "h-7 w-12 rounded-md border text-center text-sm tabular-nums outline-none disabled:opacity-40",
          qty > 0 ? "border-primary bg-primary/5 font-semibold text-primary" : "border-input",
        )}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(row.variant_id, qty + factor)}
        className="flex size-7 items-center justify-center rounded-md border border-input text-foreground hover:bg-muted disabled:opacity-40"
      >
        +
      </button>
    </div>
    {p?.label && <p className="text-xs text-muted-foreground">{p.label}{p.unitsPerPackage ? ` × ${p.unitsPerPackage}` : ""}</p>}
    {mode === "package" && <p className="text-xs text-muted-foreground">{qty} {p?.mode === "own-sku" ? "cajas" : "unidades"} · {fmt((row.unit_price ?? 0) * factor)} por {p?.label || "bulto"}</p>}
    </div>
  );
}

const VISIBLE_CHIPS = 12;
const IVA = 0.21;
const PER = 50;
const SKELETON_ROWS = 8;

export default function B2BOrderBuilder({ company, placedBy, salesChannelId, tiers }: Props) {
  const { countryCode } = useParams() as { countryCode: string };
  const demoHref = useDemoHref();

  // Búsqueda con debounce (#2).
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  // Categorías (#10) — nombres para los chips, filtradas vía Typesense.
  const [cats, setCats] = useState<string[]>([]);
  const [catsOpen, setCatsOpen] = useState(false);

  // Productos desde Typesense (browser, instantáneo): búsqueda por título/SKU,
  // filtro por canal mayorista y categorías, infinite scroll. `omitPriceFilter`
  // porque el precio indexado es retail: un producto solo-mayorista (precio solo
  // en la price list) indexa price 0 y desaparecería del selector.
  const { products, page, totalPages, facetUniverse, isLoading, error, loadMore, refresh } =
    useTypesenseProducts({
      q: debouncedQ || undefined,
      limit: PER,
      salesChannelId,
      categoryNames: cats,
      facets: true,
      omitPriceFilter: true,
    });

  // Lista de chips: congelada en la primera respuesta con facetas no vacías
  // (el facet-universe comparte la `q`; sin congelar se achicaría al buscar).
  const [categories, setCategories] = useState<string[]>([]);
  useEffect(() => {
    if (categories.length) return;
    const facet = facetUniverse.find((f) => f.field_name === "categories.name");
    const names = (facet?.counts ?? []).map((c) => c.value).filter(Boolean);
    if (names.length) setCategories(names);
  }, [facetUniverse, categories.length]);

  // Precios mayoristas + stock por lote: una llamada por página nueva de
  // Typesense. `requested` (ref) = productos en vuelo o resueltos, para nunca
  // re-pedir al scrollear/re-buscar; ante error se liberan y reintenta en el
  // próximo trigger. El merge por variant_id es idempotente → respuestas fuera
  // de orden son inofensivas.
  const [priceMap, setPriceMap] = useState<Record<string, B2BPriceInfo>>({});
  const [resolvedProducts, setResolvedProducts] = useState<Set<string>>(new Set());
  const requested = useRef<Set<string>>(new Set());
  useEffect(() => {
    const newIds = products.map((p) => p.id).filter((id) => !requested.current.has(id));
    if (!newIds.length) return;
    for (const id of newIds) requested.current.add(id);
    (async () => {
      try {
        const res = await fetch("/api/b2b/prices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ product_ids: newIds }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { prices?: Record<string, B2BPriceInfo> };
        setPriceMap((prev) => ({ ...prev, ...(data.prices ?? {}) }));
        setResolvedProducts((prev) => {
          const next = new Set(prev);
          for (const id of newIds) next.add(id);
          return next;
        });
      } catch {
        for (const id of newIds) requested.current.delete(id);
      }
    })();
  }, [products]);

  // Filas por variante: aplanado de los docs de Typesense + merge del lote de
  // precios. Sin lote todavía → pending (shimmer). Producto resuelto pero sin
  // la variante en la respuesta (ej. despublicado) → precio null, fila "—".
  const rows: BuilderRow[] = useMemo(
    () =>
      products.flatMap((p) =>
        (p.variants ?? []).map((v) => {
          const info = priceMap[v.id];
          return {
            product_id: p.id,
            variant_id: v.id,
            sku: v.sku ?? null,
            product_title: p.title,
            variant_title: v.title,
            thumbnail: p.thumbnail,
            commercial: info?.commercial,
            available: info?.available ?? 0,
            unit_price: info?.unit_price ?? null,
            pending: !resolvedProducts.has(p.id),
          };
        }),
      ),
    [products, priceMap, resolvedProducts],
  );

  // Caché de filas para el resumen (una selección puede no estar en la página
  // visible). Es state (no ref) para que el resumen se refresque cuando el lote
  // de precios llega después de seleccionar.
  const [rowCache, setRowCache] = useState<Map<string, BuilderRow>>(new Map());
  useEffect(() => {
    if (!rows.length) return;
    setRowCache((prev) => {
      const next = new Map(prev);
      for (const r of rows) next.set(r.variant_id, r);
      return next;
    });
  }, [rows]);

  // Selección + cantidades.
  const [sel, setSel] = useState<Record<string, number>>({});
  const [presentationModes, setPresentationModes] = useState<Record<string, "unit" | "package">>({});
  const setQty = (vid: string, n: number) =>
    setSel((p) => {
      const q2 = Math.max(0, n || 0);
      const next = { ...p };
      if (q2 <= 0) delete next[vid];
      else next[vid] = q2;
      return next;
    });

  // Al editar un pedido existente, precargamos el carrito B2B actual para no
  // arrancar vacío (agregar sin lo que ya tiene el carrito es anti-intuitivo).
  // Corre una sola vez al montar; si el carrito está vacío no hace nada.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/b2b/cart");
        if (!res.ok) return;
        const { cart } = (await res.json()) as {
          cart?: {
            items?: Array<{
              variant_id?: string | null;
              product_id?: string | null;
              quantity: number;
              product_title?: string | null;
              title?: string | null;
              variant_title?: string | null;
              variant_sku?: string | null;
              thumbnail?: string | null;
              unit_price?: number | null;
              metadata?: any;
              variant?: any;
            }>;
          } | null;
        };
        const items = cart?.items ?? [];
        if (!items.length) return;
        const initSel: Record<string, number> = {};
        const initModes: Record<string, "unit" | "package"> = {};
        const seeded: BuilderRow[] = [];
        for (const it of items) {
          if (!it.variant_id) continue;
          initSel[it.variant_id] = it.quantity;
          if (it.metadata?.catalog_presentation) initModes[it.variant_id] = "package";
          seeded.push({
            product_id: it.product_id ?? it.variant_id,
            variant_id: it.variant_id,
            sku: it.variant_sku ?? null,
            product_title: it.product_title ?? it.title ?? "Producto",
            variant_title: it.variant_title ?? "",
            thumbnail: it.thumbnail ?? null,
            commercial: it.variant?.metadata?.catalog_commercial,
            available: 9999,
            unit_price: it.unit_price ?? null,
            pending: false,
          });
        }
        setSel(initSel);
        setPresentationModes(initModes);
        // Sembramos el caché para que el resumen muestre estos ítems aunque no
        // estén en la página visible de Typesense. Cuando la fila real del
        // catálogo llega (con stock/precio), sobreescribe la sembrada.
        setRowCache((prev) => {
          const next = new Map(prev);
          for (const r of seeded) if (!next.has(r.variant_id)) next.set(r.variant_id, r);
          return next;
        });
      } catch {
        // best-effort: si falla, el builder arranca vacío como antes.
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Selección masiva (#3).
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [bulkQty, setBulkQty] = useState("");
  const toggleCheck = (vid: string) =>
    setChecked((p) => {
      const n = new Set(p);
      if (n.has(vid)) n.delete(vid);
      else n.add(vid);
      return n;
    });
  const applyBulk = () => {
    const q2 = parseInt(bulkQty, 10) || 0;
    setSel((p) => {
      const n = { ...p };
      checked.forEach((vid) => {
        if (q2 <= 0) delete n[vid];
        else n[vid] = q2;
      });
      return n;
    });
    setChecked(new Set());
    setBulkQty("");
  };

  const selected = useMemo(
    () =>
      Object.entries(sel).map(([vid, quantity]) => {
        const row = rowCache.get(vid);
        // Precio unitario del tramo que corresponde a la cantidad elegida (escalas).
        const price = row ? priceForQty(row.unit_price, tiers, quantity) : null;
        return { vid, row, price, quantity };
      }),
    [sel, tiers, rowCache],
  );
  const totals = useMemo(() => {
    let cnt = 0;
    let subtotal = 0;
    for (const s of selected) {
      cnt += s.quantity;
      if (s.price != null) subtotal += s.price * s.quantity;
    }
    return { count: cnt, subtotal, iva: subtotal * IVA, total: subtotal * (1 + IVA) };
  }, [selected]);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const finalize = async () => {
    const lines = Object.entries(sel)
      .filter(([, q2]) => q2 > 0)
      .map(([variant_id, quantity]) => {
        const mode = presentationModes[variant_id] ?? (rowCache.get(variant_id)?.commercial?.purchasePolicy?.enabled && rowCache.get(variant_id)?.commercial?.purchasePolicy?.allowedModes?.length === 1 && rowCache.get(variant_id)?.commercial?.purchasePolicy?.allowedModes?.includes("package") ? "package" : undefined);
        const factor = mode === "package" ? presentationFactor(rowCache.get(variant_id)?.commercial) : 1;
        return { variant_id, quantity: quantity / factor, ...(mode ? { presentation_mode: mode } : {}) };
      });
    if (!lines.length) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/b2b/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sync",
          countryCode,
          lines,
          company: {
            id: company.id,
            name: company.name,
            placed_by_id: placedBy.id,
            placed_by_email: placedBy.email,
          },
        }),
      });
      const r = (await res.json().catch(() => ({ ok: false, error: "Error" }))) as {
        ok: boolean;
        error?: string;
      };
      if (!r.ok) {
        setErr(r.error ?? "No se pudo continuar.");
        setBusy(false);
        return;
      }
      // Navegación dura al checkout. Preservamos el prefijo /demo/{slug} (demoHref)
      // para no salir del contexto del demo. Top-level navigation que garantiza que
      // la cookie _b2b_cart_id recién seteada viaje y el checkout SSR la encuentre.
      window.location.assign(demoHref("/b2b/checkout"));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo continuar.");
      setBusy(false);
    }
  };

  const Chip = ({ name }: { name: string }) => {
    const active = cats.includes(name);
    return (
      <button
        type="button"
        onClick={() => setCats((p) => (active ? p.filter((c) => c !== name) : [...p, name]))}
        className={cn(
          "shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-xs transition-colors",
          active
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border text-foreground hover:bg-muted",
        )}
      >
        {name}
      </button>
    );
  };

  const PriceShimmer = () => (
    <div className="flex flex-col items-end gap-1">
      <div className="h-4 w-16 animate-pulse rounded bg-muted" />
      {tiers && tiers.length > 1 ? <div className="h-3 w-12 animate-pulse rounded bg-muted" /> : null}
    </div>
  );

  const showSkeleton = isLoading && rows.length === 0;

  return (
    <div className="flex flex-col gap-3 pb-24 lg:flex-row lg:pb-0">
      <div className="min-w-0 flex-1 lg:max-w-3xl">
        {/* Volver + buscador (#7 sin títulos, #8 al nivel del volver) */}
        <div className="mb-3 flex items-center gap-2">
          <LocalizedClientLink
            href="/b2b/pedidos"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted"
            aria-label="Volver a pedidos"
          >
            <ArrowLeft className="size-4" />
          </LocalizedClientLink>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-9 pl-9" placeholder="Buscar producto o SKU…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>

        {/* Chips de categorías (#10) */}
        {categories.length > 0 ? (
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            {categories.slice(0, VISIBLE_CHIPS).map((name) => (
              <Chip key={name} name={name} />
            ))}
            {categories.length > VISIBLE_CHIPS || cats.length ? (
              <button
                type="button"
                onClick={() => setCatsOpen(true)}
                className="shrink-0 whitespace-nowrap rounded-full border border-dashed border-border px-3 py-1 text-xs text-muted-foreground hover:bg-muted"
              >
                Más{cats.length ? ` (${cats.length})` : ""}
              </button>
            ) : null}
          </div>
        ) : null}

        {/* Error de catálogo (Typesense caído / no configurado) */}
        {error ? (
          <div className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <span>No se pudo cargar el catálogo.</span>
            <Button type="button" size="sm" variant="outline" onClick={() => refresh()}>
              Reintentar
            </Button>
          </div>
        ) : null}

        {/* Barra sticky de seleccionados (#3) */}
        {checked.size > 0 ? (
          <div className="sticky top-0 z-10 mb-2 flex items-center justify-between gap-2 rounded-lg border border-primary bg-primary/5 px-3 py-2">
            <span className="flex items-center gap-2 text-sm font-medium text-primary">
              <span className="grid size-5 place-items-center rounded-full bg-primary text-primary-foreground">
                <Check className="size-3" />
              </span>
              {checked.size} seleccionado{checked.size === 1 ? "" : "s"}
            </span>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                value={bulkQty}
                onChange={(e) => setBulkQty(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyBulk()}
                placeholder="Cant."
                className="h-8 w-20 text-center text-sm"
              />
              <Button type="button" size="sm" onClick={applyBulk} disabled={!bulkQty}>
                Aplicar
              </Button>
              <button type="button" onClick={() => setChecked(new Set())} className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>
          </div>
        ) : null}

        {/* Tabla */}
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full table-fixed text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="w-9 px-2 py-2.5" />
                <th className="px-2 py-2.5 text-left font-medium">Producto</th>
                <th className="hidden w-36 px-2 py-2.5 text-right font-medium sm:table-cell">Precio / u.</th>
                <th className="w-40 px-2 py-2.5 text-center font-medium">Cantidad</th>
                <th className="hidden w-32 px-2 py-2.5 text-right font-medium sm:table-cell">Total</th>
              </tr>
            </thead>
            <tbody>
              {showSkeleton ? (
                Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-2 py-2">
                      <div className="size-4 animate-pulse rounded bg-muted" />
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-2.5">
                        <div className="size-10 shrink-0 animate-pulse rounded-md bg-muted" />
                        <div className="h-4 w-40 animate-pulse rounded bg-muted" />
                      </div>
                    </td>
                    <td className="hidden px-2 py-2 sm:table-cell">
                      <div className="ml-auto h-4 w-16 animate-pulse rounded bg-muted" />
                    </td>
                    <td className="px-2 py-2">
                      <div className="mx-auto h-7 w-28 animate-pulse rounded bg-muted" />
                    </td>
                    <td className="hidden px-2 py-2 sm:table-cell">
                      <div className="ml-auto h-4 w-14 animate-pulse rounded bg-muted" />
                    </td>
                  </tr>
                ))
              ) : rows.length === 0 && !isLoading ? (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">
                    No se encontraron productos.
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const qty = sel[r.variant_id] ?? 0;
                  const noStock = !r.pending && r.available <= 0;
                  const breaks = tierBreaks(r.unit_price, tiers);
                  const effUnit = priceForQty(r.unit_price, tiers, qty || 1);
                  const title =
                    r.product_title +
                    (r.variant_title && r.variant_title !== r.product_title ? ` · ${r.variant_title}` : "");
                  return (
                    <tr key={r.variant_id} className={cn("border-t border-border", qty > 0 && "bg-primary/5")}>
                      <td className="px-2 py-2 align-middle">
                        <Checkbox checked={checked.has(r.variant_id)} onCheckedChange={() => toggleCheck(r.variant_id)} />
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-2.5">
                          <div className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-muted">
                            {r.thumbnail ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={r.thumbnail} onError={handleImageError} alt="" className="size-full object-cover" />
                            ) : (
                              <ShoppingCart className="size-4 text-muted-foreground" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p
                              className="line-clamp-2 max-w-[22ch] break-words font-medium text-foreground"
                              title={title}
                            >
                              <LocalizedClientLink href={`/b2b/productos/${r.product_id}`}>{title}</LocalizedClientLink>
                            </p>
                            {noStock ? (
                              <Badge variant="outline" className="mt-0.5 text-[10px] text-destructive">
                                Sin stock
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-2 py-2 align-top text-right sm:table-cell">
                        {r.pending ? (
                          <PriceShimmer />
                        ) : (
                          <>
                            <div className="font-medium tabular-nums text-foreground">{fmt(effUnit)}</div>
                            {breaks.length > 0 ? (
                              <div className="mt-1 flex flex-col items-end gap-0.5">
                                {breaks.map((b) => {
                                  const reached = qty >= b.minQty;
                                  return (
                                    <span
                                      key={b.minQty}
                                      title={`Desde ${b.minQty} u.: ${fmt(b.price)} c/u`}
                                      className={cn(
                                        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] leading-none tabular-nums",
                                        reached
                                          ? "bg-primary/10 font-medium text-primary"
                                          : "bg-muted text-muted-foreground",
                                      )}
                                    >
                                      <span className="opacity-70">{b.minQty}+</span>
                                      <span>{fmt(b.price)}</span>
                                    </span>
                                  );
                                })}
                              </div>
                            ) : null}
                          </>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <Stepper row={r} qty={qty} onChange={setQty} mode={presentationModes[r.variant_id] ?? (r.commercial?.purchasePolicy?.enabled && r.commercial.purchasePolicy.allowedModes?.length === 1 && r.commercial.purchasePolicy.allowedModes.includes("package") ? "package" : "unit")} onMode={mode => setPresentationModes(previous => ({ ...previous, [r.variant_id]: mode }))} />
                      </td>
                      <td className="hidden px-2 py-2 text-right font-medium tabular-nums text-foreground sm:table-cell">
                        {qty > 0 && r.unit_price != null ? fmt((priceForQty(r.unit_price, tiers, qty) ?? 0) * qty) : "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          {isLoading && rows.length > 0 ? (
            <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Cargando…
            </div>
          ) : null}
          <InfiniteScrollSentinel onIntersect={loadMore} disabled={isLoading || page >= totalPages} />
        </div>
      </div>

      {/* Resumen (desktop) */}
      <aside className="hidden shrink-0 lg:block lg:w-80">
        <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card lg:sticky lg:top-4">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="font-semibold text-foreground">Resumen</h2>
            {selected.length > 0 ? (
              <button type="button" onClick={() => setSel({})} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="size-4" />
              </button>
            ) : null}
          </div>
          <div className="max-h-[40vh] overflow-y-auto px-4 py-3">
            {selected.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <ShoppingCart className="mx-auto mb-2 size-8 opacity-40" />
                <p className="text-sm">Todavía no agregaste productos.</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {selected.map((s) => (
                  <li key={s.vid} className="flex items-center justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate text-foreground">{s.row?.product_title ?? "Producto"}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.quantity} × {fmt(s.price)}
                      </p>
                    </div>
                    <span className="shrink-0 font-medium tabular-nums text-foreground">
                      {s.price != null ? fmt(s.price * s.quantity) : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="space-y-2 border-t border-border bg-muted/30 px-4 py-3">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Subtotal</span>
              <span className="tabular-nums">{fmt(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>IVA (21%)</span>
              <span className="tabular-nums">{fmt(totals.iva)}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-2 text-lg font-bold text-foreground">
              <span>Total</span>
              <span className="tabular-nums">{fmt(totals.total)}</span>
            </div>
            <Button type="button" className="mt-1 h-11 w-full" onClick={finalize} disabled={busy || totals.count === 0}>
              {busy ? "Procesando…" : "Finalizar"}
            </Button>
            {err ? <p className="text-xs text-destructive">{err}</p> : null}
          </div>
        </div>
      </aside>

      {/* Resumen fijo (mobile): siempre accesible */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-border bg-card px-4 py-3 lg:hidden">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">
            {totals.count} ítem{totals.count === 1 ? "" : "s"}
          </p>
          <p className="font-bold text-foreground">{fmt(totals.total)}</p>
        </div>
        <Button type="button" className="h-11 px-6" onClick={finalize} disabled={busy || totals.count === 0}>
          {busy ? "Procesando…" : "Finalizar"}
        </Button>
      </div>

      {/* Sheet con TODAS las categorías (#10) */}
      <Sheet open={catsOpen} onOpenChange={setCatsOpen}>
        <SheetContent className="w-80 overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Categorías</SheetTitle>
          </SheetHeader>
          <div className="mt-4 flex flex-col gap-1">
            {cats.length > 0 ? (
              <button type="button" onClick={() => setCats([])} className="mb-2 self-start text-xs text-primary hover:underline">
                Limpiar ({cats.length})
              </button>
            ) : null}
            {categories.map((name) => {
              const active = cats.includes(name);
              return (
                <label key={name} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted">
                  <Checkbox
                    checked={active}
                    onCheckedChange={() => setCats((p) => (active ? p.filter((x) => x !== name) : [...p, name]))}
                  />
                  <span className="text-sm text-foreground">{name}</span>
                </label>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
