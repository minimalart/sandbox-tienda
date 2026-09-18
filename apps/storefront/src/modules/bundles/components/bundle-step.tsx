"use client";

import { useMemo, useState } from "react";
import type { StorefrontBundleItem, StorefrontVariant } from "@lib/data/bundles";
import {
  findVariantByOptions,
  isVariantBuyable,
  listAvailableValuesForOption,
} from "../lib/resolve-variant";
import type { BundleProductEnrichment } from "../lib/variant-presentation";
import { describeVariants, stepQuestion } from "../lib/variant-presentation";
import { BundleVariantCard } from "./bundle-variant-card";
import { BundleVariantDetail } from "./bundle-variant-detail";

interface BundleStepProps {
  item: StorefrontBundleItem;
  currentVariantId: string | null;
  enrichment?: BundleProductEnrichment;
  onChange: (variantId: string) => void;
}

/**
 * Un paso = una pregunta. El caso real del catálogo escolar es un producto con
 * UNA sola opción ("Opción": económica / intermedia / cara), así que el paso
 * muestra una grilla de tarjetas — foto, gama, marca y precio — en vez de chips
 * de texto: la decisión es entre productos concretos, no entre atributos.
 *
 * Para productos con varias opciones (talle × color) se cae al selector clásico
 * de chips, que sigue respetando PRD §13: los valores que no llevan a una
 * variante comprable se muestran deshabilitados, no ocultos.
 */
export const BundleStep = ({ item, currentVariantId, enrichment, onChange }: BundleStepProps) => {
  const product = item.product;
  const [detailVariantId, setDetailVariantId] = useState<string | null>(null);

  const buyableVariants = useMemo(
    () => (product?.variants ?? []).filter(isVariantBuyable),
    [product],
  );

  const presentations = useMemo(
    () =>
      product
        ? describeVariants(buyableVariants, product, enrichment).sort(
            (a, b) => a.tierRank - b.tierRank || (a.amount ?? 0) - (b.amount ?? 0),
          )
        : [],
    [product, buyableVariants, enrichment],
  );

  // Estado local de opciones, sólo para el fallback multi-opción. Se siembra
  // desde `currentVariantId` para que volver atrás preserve la selección (PRD §46).
  const seed = useMemo<Record<string, string | null>>(() => {
    const initial: Record<string, string | null> = {};
    for (const opt of product?.options ?? []) initial[opt.title] = null;
    if (currentVariantId && product) {
      const chosen = product.variants.find((v) => v.id === currentVariantId);
      if (chosen) {
        for (const opt of product.options) initial[opt.title] = chosen.options[opt.title] ?? null;
      }
    }
    return initial;
  }, [product, currentVariantId]);
  const [selection, setSelection] = useState(seed);

  if (!product) {
    return (
      <p className="text-red-700">No pudimos cargar este producto. Probá recargando la página.</p>
    );
  }

  const { question, requested } = stepQuestion(item, enrichment);
  const isSingleOption = product.options.length <= 1;
  const detailVariant = presentations.find((p) => p.id === detailVariantId) ?? null;

  const chooseOption = (title: string, value: string) => {
    const next = { ...selection, [title]: value };
    setSelection(next);
    const variant: StorefrontVariant | null = findVariantByOptions(product, next);
    if (variant && isVariantBuyable(variant)) onChange(variant.id);
  };

  return (
    <div className="space-y-6">
      <header className="mx-auto max-w-2xl space-y-2 text-center">
        <h2 className="text-xl font-medium tracking-tight text-neutral-900 sm:text-2xl xl:text-[30px] xl:leading-tight">
          {question}
        </h2>
        {/* La ayuda genérica se esconde en mobile: ocupa tres renglones y lo
            que dice ya lo dicen las tarjetas. Lo que NO se esconde es el
            artículo tal cual lo pidió el colegio, que es el dato a chequear. */}
        <p className="text-xs leading-relaxed text-neutral-500 sm:text-sm">
          {requested ? (
            <>
              El colegio pide <span className="text-neutral-700">{requested}</span>.
              <span className="hidden sm:inline">
                {" "}
                Elegí la opción que prefieras — podés ver el detalle de cada una antes de decidir.
              </span>
            </>
          ) : (
            <span className="hidden sm:inline">
              Elegí la opción que prefieras. Podés ver el detalle de cada una antes de decidir.
            </span>
          )}
        </p>
      </header>

      {isSingleOption ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-4">
          {presentations.map((variant) => (
            <BundleVariantCard
              key={variant.id}
              className="w-full sm:w-44 xl:w-48"
              variant={variant}
              quantity={item.quantity}
              selected={currentVariantId === variant.id}
              onSelect={() => onChange(variant.id)}
              onDetail={() => setDetailVariantId(variant.id)}
            />
          ))}
        </div>
      ) : (
        <div className="mx-auto max-w-2xl space-y-6">
          {product.options.map((opt) => {
            const available = listAvailableValuesForOption(product, selection, opt.title);
            return (
              <fieldset key={opt.id} className="space-y-3">
                <legend className="text-xs uppercase tracking-[0.18em] text-neutral-400">
                  {opt.title}
                </legend>
                <div className="flex flex-wrap gap-2">
                  {opt.values.map((value) => {
                    const disabled = !available.has(value);
                    const active = selection[opt.title] === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        disabled={disabled}
                        onClick={() => chooseOption(opt.title, value)}
                        aria-pressed={active}
                        className={
                          "rounded-full border px-4 py-2 text-sm transition-colors " +
                          (active
                            ? "border-[--primary-color] bg-[--primary-color] text-white"
                            : disabled
                              ? "border-neutral-200 text-neutral-300 line-through"
                              : "border-neutral-300 text-neutral-700 hover:border-[--primary-color]")
                        }
                      >
                        {value}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            );
          })}
        </div>
      )}

      {detailVariant && (
        <BundleVariantDetail
          variant={detailVariant}
          productTitle={product.title}
          quantity={item.quantity}
          enrichment={enrichment}
          fallbackImage={product.thumbnail}
          isSelected={currentVariantId === detailVariant.id}
          onSelect={() => onChange(detailVariant.id)}
          onClose={() => setDetailVariantId(null)}
        />
      )}
    </div>
  );
};
