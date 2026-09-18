"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { formatPrice } from "../lib/resolve-variant";
import type { BundleProductEnrichment, VariantPresentation } from "../lib/variant-presentation";
import { detailGallery } from "../lib/variant-presentation";

/**
 * Detalle de una opción, sin salir del wizard. El PRD pedía "elegir"; en la
 * práctica nadie elige entre tres marcas que no puede mirar, así que el paso
 * ofrece ficha con galería, descripción, marca y código antes de decidir.
 *
 * Es un diálogo modal simple (sin dependencias nuevas): cierra con Escape, con
 * click en el fondo y con la X. En mobile entra como drawer desde abajo.
 *
 * Va por PORTAL a <body> y no inline: el template de página del storefront
 * envuelve todo en un contenedor con `transform` (la transición de entrada), y
 * un `transform` convierte a ese contenedor en el bloque contenedor de sus
 * descendientes `fixed` — el drawer quedaba anclado al alto de la página en vez
 * de al viewport y aparecía fuera de pantalla.
 */
export const BundleVariantDetail = ({
  variant,
  productTitle,
  quantity,
  enrichment,
  fallbackImage,
  isSelected,
  onSelect,
  onClose,
}: {
  variant: VariantPresentation;
  productTitle: string;
  quantity: number;
  enrichment?: BundleProductEnrichment;
  fallbackImage: string | null;
  isSelected: boolean;
  onSelect: () => void;
  onClose: () => void;
}) => {
  const gallery = detailGallery(variant, enrichment, fallbackImage);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const dialog = (
    <div
      className="fixed inset-0 z-[1002] flex items-end justify-center bg-neutral-900/40 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`${productTitle} — ${variant.label}`}
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-neutral-100 px-6 py-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-400">
              {productTitle}
            </p>
            <h3 className="text-lg font-medium text-neutral-900">{variant.label}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-full p-2 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
          >
            ✕
          </button>
        </div>

        <div className="grid gap-4 p-4 sm:grid-cols-2 sm:gap-6 sm:p-6">
          <div className="space-y-3">
            <div className="relative h-40 w-full overflow-hidden rounded-2xl bg-neutral-50 sm:aspect-square sm:h-auto">
              {gallery[active] ? (
                <Image
                  src={gallery[active]!}
                  alt={variant.label}
                  fill
                  sizes="(max-width: 640px) 90vw, 360px"
                  className="object-contain"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-neutral-400">
                  Sin foto
                </div>
              )}
            </div>
            {gallery.length > 1 && (
              <div className="flex gap-2">
                {gallery.map((url, i) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => setActive(i)}
                    aria-label={`Foto ${i + 1}`}
                    className={
                      "relative h-12 w-12 overflow-hidden rounded-lg border bg-white sm:h-14 sm:w-14 " +
                      (i === active ? "border-[--primary-color]" : "border-neutral-200")
                    }
                  >
                    <Image src={url} alt="" fill sizes="56px" className="object-contain" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 sm:gap-4">
            {variant.tierLabel && (
              <span className="self-start rounded-full bg-[--primary-soft-bg] px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-[--primary-color]">
                Opción {variant.tierLabel}
              </span>
            )}

            <p className="text-xl font-semibold text-neutral-900 sm:text-2xl">
              {formatPrice(variant.amount, variant.currencyCode)}
              {quantity > 1 && variant.amount !== null && (
                <span className="ml-2 text-sm font-normal text-neutral-500">
                  · {quantity} u. {formatPrice(variant.amount * quantity, variant.currencyCode)}
                </span>
              )}
            </p>

            {(variant.detalle || enrichment?.description) && (
              <p className="text-sm leading-relaxed text-neutral-600">
                {variant.detalle ?? enrichment?.description}
              </p>
            )}

            <dl className="space-y-1.5 border-t border-neutral-100 pt-3 text-sm sm:space-y-2 sm:pt-4">
              {variant.marca && (
                <div className="flex justify-between gap-4">
                  <dt className="text-neutral-500">Marca</dt>
                  <dd className="text-neutral-900">{variant.marca}</dd>
                </div>
              )}
              {variant.codigo && (
                <div className="flex justify-between gap-4">
                  <dt className="text-neutral-500">Código</dt>
                  <dd className="font-mono text-xs text-neutral-900">{variant.codigo}</dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt className="text-neutral-500">Cantidad en el kit</dt>
                <dd className="text-neutral-900">{quantity}</dd>
              </div>
            </dl>

            <button
              type="button"
              onClick={() => {
                onSelect();
                onClose();
              }}
              className={
                "mt-auto rounded-full px-6 py-3 text-sm font-medium transition-colors " +
                (isSelected
                  ? "border border-[--primary-color] text-[--primary-color]"
                  : "bg-[--primary-color] text-white hover:bg-[--primary-color-dark]")
              }
            >
              {isSelected ? "Ya es tu elección" : "Elegir esta opción"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Sin `document` en el server: el primer render devuelve null y el drawer
  // aparece apenas monta (sólo se abre por click, así que nadie lo nota).
  return typeof document === "undefined" ? null : createPortal(dialog, document.body);
};
