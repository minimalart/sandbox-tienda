"use client";

import { toast } from "@medusajs/ui";
import CheckboxInput from "@modules/common/components/checkbox-input";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import { useCartStore } from "@lib/stores/cart.store";
import { convertToLocale } from "@lib/util/money";
import {
  PLACEHOLDER_IMAGE,
  handleImageError,
} from "@lib/util/placeholder-image";
import { useMemo, useRef, useState } from "react";
import type {
  ShopByLookData,
  ShopByLookProductData,
} from "@lib/data/shop-by-look";

type ItemState = {
  selected: boolean;
  quantity: number;
  variantId: string | null;
};

const initialState = (product: ShopByLookProductData): ItemState => ({
  selected: true,
  quantity: 1,
  variantId:
    product.variant_id ??
    (product.variants.length === 1 ? product.variants[0]!.id : null),
});

const money = (amount: number | null, currency: string | null) =>
  amount == null
    ? "—"
    : `$ ${convertToLocale({ amount, currency_code: currency || "ars" })}`;

const variantOf = (product: ShopByLookProductData, variantId: string | null) =>
  variantId ? product.variants.find((v) => v.id === variantId) ?? null : null;

const maxStock = (product: ShopByLookProductData, variantId: string | null) => {
  const v = variantOf(product, variantId);
  // Sin variante elegida: máximo del stock más alto disponible.
  const available = v
    ? v.available
    : Math.max(0, ...product.variants.map((x) => x.available));
  return available > 0 ? available : 1;
};

export default function ShopByLookCard({
  look,
  countryCode,
  titleClassName,
}: {
  look: ShopByLookData;
  countryCode: string;
  /** Clase del título, para que matchee el heading de cada template
   * (sp-section-title en sports, f-section-title en fashion, etc.). */
  titleClassName?: string;
}) {
  const [state, setState] = useState<Record<string, ItemState>>(() =>
    Object.fromEntries(look.products.map((p) => [p.product_id, initialState(p)]))
  );
  // Hotspot abierto: por hover (con delay al salir) o fijado con click.
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const openHover = (id: string) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setHoverId(id);
  };
  const scheduleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    // Delay: permite mover el cursor del marcador a la card sin que se cierre.
    closeTimer.current = setTimeout(() => setHoverId(null), 250);
  };
  const togglePin = (id: string) =>
    setPinnedId((cur) => (cur === id ? null : id));
  const isHotspotOpen = (id: string) => pinnedId === id || hoverId === id;

  const patch = (productId: string, p: Partial<ItemState>) =>
    setState((prev) => ({ ...prev, [productId]: { ...prev[productId]!, ...p } }));

  const selectedProducts = look.products.filter(
    (p) => state[p.product_id]?.selected
  );
  const missingVariant = selectedProducts.some(
    (p) => !state[p.product_id]?.variantId
  );
  const canAdd = selectedProducts.length > 0 && !missingVariant && !isAdding;

  const total = useMemo(() => {
    let amount = 0;
    let currency: string | null = null;
    for (const p of selectedProducts) {
      const s = state[p.product_id]!;
      const v = variantOf(p, s.variantId);
      if (v?.calculated_amount != null) {
        amount += v.calculated_amount * s.quantity;
        currency = currency ?? v.currency_code;
      }
    }
    return { amount, currency };
  }, [selectedProducts, state]);

  const ctaLabel = (() => {
    if (isAdding) return "Agregando...";
    if (selectedProducts.length === 0) return "Seleccioná al menos un producto";
    if (missingVariant) return "Elegir variantes";
    return look.cta_label || "Comprar look";
  })();

  const handleAdd = async () => {
    if (!canAdd) return;
    setIsAdding(true);
    try {
      const items = selectedProducts.map((p) => ({
        variantId: state[p.product_id]!.variantId!,
        quantity: state[p.product_id]!.quantity,
        metadata: { shop_by_look_id: look.id },
      }));

      const res = await fetch("/api/store/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "addMany", items, countryCode }),
      });
      const data = await res.json();

      // Refresca el carrito real (la respuesta trae el cart final del lote).
      await useCartStore.getState().fetchCart();

      const added: number = data?.added ?? 0;
      const failed: number = data?.failed ?? 0;

      if (added > 0 && failed === 0) {
        toast.success("Productos agregados al carrito", {
          description: `${added} producto${added > 1 ? "s" : ""} agregado${
            added > 1 ? "s" : ""
          }.`,
        });
      } else if (added > 0 && failed > 0) {
        const failedProducts = (data?.results ?? [])
          .filter((r: { success: boolean }) => !r.success)
          .map((r: { variantId: string }) => {
            const prod = look.products.find((p) =>
              p.variants.some((v) => v.id === r.variantId)
            );
            return prod?.title ?? r.variantId;
          });
        toast.warning("Se agregaron algunos productos", {
          description: `No se pudieron agregar: ${failedProducts.join(", ")}.`,
          duration: 5000,
        });
      } else {
        toast.error("No se pudieron agregar los productos", {
          description: "Intentá de nuevo más tarde.",
        });
      }
    } catch {
      toast.error("No se pudieron agregar los productos", {
        description: "Intentá de nuevo más tarde.",
      });
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {(look.title || look.subtitle) && (
        <div className="flex flex-col gap-1">
          {look.title && (
            <h2
              className={
                titleClassName ??
                "text-3xl font-bold tracking-tight text-gray-900 md:text-4xl"
              }
            >
              {look.title}
            </h2>
          )}
          {look.subtitle && <p className="text-gray-600">{look.subtitle}</p>}
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Imagen + hotspots. El contenedor interno `relative` abraza EXACTAMENTE
            a la imagen (altura = alto natural de la imagen), sin importar que el
            grid estire la celda: así los marcadores en % de X/Y caen 1:1 sobre la
            imagen, igual que en el editor del admin. */}
        <div className="self-start">
          <div className="relative w-full bg-gray-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={look.image_url}
              alt={look.image_alt || look.title}
              className="block w-full select-none"
              loading="lazy"
              draggable={false}
            />
            {look.products.map((product, i) => {
              const v = variantOf(product, state[product.product_id]?.variantId ?? null);
              const price =
                v?.calculated_amount ??
                product.variants.find((x) => x.calculated_amount != null)
                  ?.calculated_amount ??
                null;
              const currency = v?.currency_code ?? product.variants[0]?.currency_code ?? null;
              const open = isHotspotOpen(product.product_id);
              const pinned = pinnedId === product.product_id;
              return (
                <div
                  key={product.product_id}
                  className="absolute"
                  style={{ left: `${product.pos_x}%`, top: `${product.pos_y}%` }}
                  onMouseEnter={() => openHover(product.product_id)}
                  onMouseLeave={scheduleClose}
                >
                  <button
                    type="button"
                    aria-label={product.title}
                    aria-expanded={open}
                    onFocus={() => openHover(product.product_id)}
                    onBlur={scheduleClose}
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePin(product.product_id);
                    }}
                    className={`flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-xs font-semibold shadow-md ring-2 transition-transform hover:scale-110 ${
                      pinned
                        ? "bg-gray-900 text-white ring-white"
                        : "bg-white text-gray-900 ring-gray-900/70"
                    }`}
                  >
                    {i + 1}
                  </button>
                  {open && (
                    <div
                      role="dialog"
                      onMouseEnter={() => openHover(product.product_id)}
                      onMouseLeave={scheduleClose}
                      className="absolute left-1/2 top-5 z-20 w-52 -translate-x-1/2 rounded-xl border border-gray-200 bg-white p-3 shadow-lg"
                    >
                      <div className="flex items-center gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={product.thumbnail || PLACEHOLDER_IMAGE}
                          onError={handleImageError}
                          alt={product.title}
                          className="h-12 w-12 rounded-md object-cover"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-900">
                            {product.title}
                          </p>
                          <p className="text-sm text-gray-700">{money(price, currency)}</p>
                        </div>
                      </div>
                      {product.handle && (
                        <LocalizedClientLink
                          href={`/products/${product.handle}`}
                          className="mt-2 block text-xs font-medium text-gray-900 underline"
                        >
                          Ver producto
                        </LocalizedClientLink>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Lista editable */}
        <div className="flex flex-col gap-4">
          <ul className="flex flex-col divide-y divide-gray-100">
            {look.products.map((product, i) => {
              const s = state[product.product_id]!;
              const v = variantOf(product, s.variantId);
              const needsVariant = !s.variantId;
              const price = v?.calculated_amount ?? null;
              const currency = v?.currency_code ?? product.variants[0]?.currency_code ?? null;
              const stock = maxStock(product, s.variantId);
              return (
                <li key={product.product_id} className="flex gap-3 py-3">
                  <label className="flex cursor-pointer items-start pt-1">
                    <CheckboxInput
                      checked={s.selected}
                      onChange={(e) =>
                        patch(product.product_id, { selected: e.target.checked })
                      }
                    />
                  </label>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={product.thumbnail || PLACEHOLDER_IMAGE}
                    onError={handleImageError}
                    alt={product.title}
                    className="h-16 w-16 rounded-md object-cover"
                  />
                  <div className="flex flex-1 flex-col gap-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold text-gray-400">
                        {i + 1}
                      </span>
                      <p className="flex-1 text-sm font-medium text-gray-900">
                        {product.title}
                      </p>
                      <p className="text-sm text-gray-700">{money(price, currency)}</p>
                    </div>

                    {/* Variante (desktop: opciones lado a lado; mobile: select) + cantidad */}
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {product.variants.length > 1 && !product.variant_id && (
                        <>
                          {/* Desktop: pills lado a lado */}
                          <div className="hidden flex-wrap gap-1.5 sm:flex">
                            {product.variants.map((variant) => {
                              const soldOut = variant.available <= 0;
                              const selected = s.variantId === variant.id;
                              return (
                                <button
                                  key={variant.id}
                                  type="button"
                                  disabled={soldOut}
                                  onClick={() =>
                                    patch(product.product_id, {
                                      variantId: variant.id,
                                      quantity: 1,
                                    })
                                  }
                                  className={`rounded-full border px-3 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:line-through disabled:opacity-40 ${
                                    selected
                                      ? "border-gray-900 bg-gray-900 text-white"
                                      : "border-gray-300 text-gray-700 hover:border-gray-400"
                                  }`}
                                >
                                  {variant.title}
                                </button>
                              );
                            })}
                          </div>
                          {/* Mobile: select */}
                          <select
                            value={s.variantId ?? ""}
                            onChange={(e) =>
                              patch(product.product_id, {
                                variantId: e.target.value || null,
                                quantity: 1,
                              })
                            }
                            className={`rounded-md border px-2 py-1 text-sm sm:hidden ${
                              needsVariant && s.selected
                                ? "border-amber-400"
                                : "border-gray-300"
                            }`}
                          >
                            <option value="">Elegí una variante</option>
                            {product.variants.map((variant) => (
                              <option
                                key={variant.id}
                                value={variant.id}
                                disabled={variant.available <= 0}
                              >
                                {variant.title}
                                {variant.available <= 0 ? " (sin stock)" : ""}
                              </option>
                            ))}
                          </select>
                        </>
                      )}

                      {/* Cantidad */}
                      <div className="inline-flex items-center rounded-md border border-gray-300">
                        <button
                          type="button"
                          aria-label="Restar"
                          onClick={() =>
                            patch(product.product_id, {
                              quantity: Math.max(1, s.quantity - 1),
                            })
                          }
                          className="px-2 py-1 text-gray-700 disabled:opacity-40"
                          disabled={s.quantity <= 1}
                        >
                          −
                        </button>
                        <span className="min-w-8 px-2 text-center text-sm">
                          {s.quantity}
                        </span>
                        <button
                          type="button"
                          aria-label="Sumar"
                          onClick={() =>
                            patch(product.product_id, {
                              quantity: Math.min(stock, s.quantity + 1),
                            })
                          }
                          className="px-2 py-1 text-gray-700 disabled:opacity-40"
                          disabled={s.quantity >= stock}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Total + CTA */}
          <div className="flex items-center justify-between border-t border-gray-200 pt-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Total</p>
              <p className="text-xl font-semibold text-gray-900">
                {money(total.amount, total.currency)}
              </p>
            </div>
            <button
              type="button"
              onClick={handleAdd}
              disabled={!canAdd}
              className="rounded-full bg-gray-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {ctaLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
