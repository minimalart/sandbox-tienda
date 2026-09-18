"use client";

import Image from "next/image";
import type { StorefrontBundleDetail } from "@lib/data/bundles";
import { formatPrice } from "../lib/resolve-variant";
import type { BundleEnrichment } from "../lib/variant-presentation";
import { describeVariants } from "../lib/variant-presentation";

/**
 * Cierre del wizard: el kit completo, con la foto de cada variante elegida para
 * que se reconozca de un vistazo.
 *
 * Dos columnas y filas bajas a propósito: una lista escolar tiene doce
 * productos y en una sola columna no entra en pantalla — y el wizard no
 * scrollea en desktop. El total y el CTA los pone el shell en su fila fija.
 *
 * "Cambiar" vuelve al paso EXACTO de ese producto (no al primero): revisar y
 * tener que rehacer diez pasos para corregir uno es la forma más rápida de que
 * alguien abandone el kit.
 */
export const BundleReview = ({
  bundle,
  selections,
  enrichment = {},
  onEditItem,
}: {
  bundle: StorefrontBundleDetail;
  selections: Record<string, string | null>;
  enrichment?: BundleEnrichment;
  onEditItem: (bundleItemId: string) => void;
}) => {
  const rows = bundle.items.map((item) => {
    const variantId = selections[item.id] ?? item.auto_resolved_variant_id;
    const variant = item.product?.variants.find((v) => v.id === variantId) ?? null;
    const productEnrichment = enrichment[item.product_id];
    const presentation = item.product
      ? (describeVariants(item.product.variants, item.product, productEnrichment).find(
          (p) => p.id === variantId,
        ) ?? null)
      : null;

    const line = variant?.calculated_price
      ? {
          amount: variant.calculated_price.amount * item.quantity,
          currency_code: variant.calculated_price.currency_code,
        }
      : null;

    return {
      id: item.id,
      editable: !item.auto_resolved_variant_id,
      title: item.product?.title ?? item.product_id,
      variantLabel: presentation?.label ?? variant?.title ?? "—",
      tierLabel: presentation?.tierLabel ?? null,
      image: presentation?.image ?? item.product?.thumbnail ?? null,
      quantity: item.quantity,
      lineAmount: line,
    };
  });

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <header className="space-y-1 text-center">
        <p className="text-[11px] uppercase tracking-[0.22em] text-neutral-400">Último paso</p>
        <h2 className="text-2xl font-medium tracking-tight text-neutral-900">Así queda tu kit</h2>
        <p className="text-sm text-neutral-500">
          Revisá las {rows.length} opciones antes de agregarlas al carrito. Podés cambiar cualquiera.
        </p>
      </header>

      <ul className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center gap-3 border-b border-neutral-100 py-2">
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-neutral-50">
              {row.image ? (
                <Image
                  src={row.image}
                  alt={row.variantLabel}
                  fill
                  sizes="40px"
                  className="object-contain"
                />
              ) : null}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] leading-tight text-neutral-400">{row.title}</p>
              <p className="truncate text-sm font-medium leading-tight text-neutral-900">
                {row.variantLabel}
                {row.quantity > 1 && (
                  <span className="ml-1 text-xs font-normal text-neutral-500">× {row.quantity}</span>
                )}
              </p>
            </div>

            <div className="shrink-0 text-right">
              <p className="text-sm font-medium leading-tight text-neutral-900">
                {formatPrice(row.lineAmount?.amount, row.lineAmount?.currency_code)}
              </p>
              {row.editable ? (
                <button
                  type="button"
                  onClick={() => onEditItem(row.id)}
                  className="text-[11px] text-neutral-500 underline underline-offset-2 transition-colors hover:text-[--primary-color]"
                >
                  Cambiar
                </button>
              ) : (
                <span className="text-[11px] text-neutral-300">única opción</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};
