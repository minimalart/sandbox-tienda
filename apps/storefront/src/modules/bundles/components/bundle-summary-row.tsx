"use client";

import Image from "next/image";
import Link from "next/link";
import { TrashIcon } from "@heroicons/react/24/outline";
import { useSiteHref } from "@lib/site-config/context";
import { useState } from "react";
import { formatPrice } from "../lib/resolve-variant";
import type { BundlePresentation } from "../lib/cart-presentation";

/**
 * El kit como UNA unidad visual (PRD V2 §16, §17).
 *
 * Es el mismo componente para el minicarrito y para el carrito: dos componentes
 * distintos es lo que lleva a que el mismo kit muestre un total en un lugar y
 * otro en el otro.
 *
 * La anatomía calca la fila de producto del carrito —tacho arriba a la derecha,
 * precio abajo a la derecha— a propósito: si la acción de eliminar cambia de
 * lugar según la fila, hay que buscarla en cada una.
 *
 * Muestra las opciones que ELIGIÓ el comprador, no los doce productos del kit:
 * el detalle completo está a un click en "Editar", dentro del wizard, que es
 * además el único lugar donde se pueden cambiar.
 */
export const BundleSummaryRow = ({
  bundle,
  currencyCode,
  onRemove,
  onNavigate,
  maxSelections = 3,
}: {
  bundle: BundlePresentation;
  currencyCode: string;
  onRemove: () => void | Promise<void>;
  /** Para cerrar el drawer cuando el link navega. */
  onNavigate?: () => void;
  maxSelections?: number;
}) => {
  const siteHref = useSiteHref();
  const [removing, setRemoving] = useState(false);

  // Las instancias viejas no tienen el handle en la metadata: se cae al
  // `bundle_id`, que la página del wizard también sabe resolver. La acción
  // siempre está — un kit que no se puede volver a abrir no es editable en
  // ningún lado.
  //
  // `useSiteHref` y no un path con countryCode: desde /tienda/{slug}/... un href
  // absoluto saca al comprador de la tienda hija.
  const editHref = siteHref(
    `/bundles/${encodeURIComponent(
      bundle.bundleHandle ?? bundle.bundleId,
    )}?instance=${encodeURIComponent(bundle.bundleInstanceId)}`,
  );

  const thumbnails = bundle.items
    .map((item) => item.thumbnail ?? null)
    .filter((url): url is string => !!url)
    .slice(0, 3);

  const shown = bundle.selections.slice(0, maxSelections);
  const hidden = bundle.selections.length - shown.length;

  const handleRemove = async () => {
    setRemoving(true);
    try {
      await onRemove();
    } finally {
      setRemoving(false);
    }
  };

  return (
    <li
      className="rounded-xl border border-neutral-200 bg-white p-3"
      data-bundle-instance={bundle.bundleInstanceId}
    >
      <div className="flex gap-3">
        {/* Pila de miniaturas: alcanza para reconocer el kit sin listar todo. */}
        <div className="relative h-16 w-16 shrink-0">
          {thumbnails.length ? (
            thumbnails.map((url, i) => (
              <div
                key={url}
                className="absolute h-12 w-12 overflow-hidden rounded-lg border border-neutral-200 bg-white"
                style={{ left: i * 8, top: i * 6, zIndex: thumbnails.length - i }}
              >
                <Image src={url} alt="" fill sizes="48px" className="object-contain" />
              </div>
            ))
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[--primary-soft-bg] text-[10px] uppercase tracking-wide text-[--primary-color]">
              Kit
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-medium leading-tight text-neutral-900">{bundle.title}</p>
              <p className="text-xs text-neutral-500">
                {bundle.itemCount} {bundle.itemCount === 1 ? "producto" : "productos"}
              </p>
            </div>
            <button
              type="button"
              aria-label="Eliminar kit"
              onClick={handleRemove}
              disabled={removing}
              className="shrink-0 text-gray-500 hover:text-red-600 disabled:opacity-50"
            >
              {removing ? (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
              ) : (
                <TrashIcon className="h-4 w-4" />
              )}
            </button>
          </div>

          {shown.length > 0 && (
            <ul className="mt-1.5 space-y-0.5">
              {shown.map((selection) => (
                <li key={selection.lineId} className="truncate text-xs text-neutral-600">
                  {selection.product} · <span className="text-neutral-900">{selection.option}</span>
                </li>
              ))}
              {hidden > 0 && <li className="text-xs text-neutral-400">y {hidden} más</li>}
            </ul>
          )}

          {/* Misma fila que en la card de producto: acción a la izquierda,
              precio a la derecha, los dos alineados abajo. */}
          <div className="mt-2 flex items-end justify-between gap-2">
            <Link
              href={editHref}
              onClick={onNavigate}
              className="text-xs text-neutral-600 underline underline-offset-2 transition-colors hover:text-[--primary-color]"
            >
              Editar
            </Link>
            <span className="font-semibold text-[15px] text-neutral-900">
              {formatPrice(bundle.subtotal, currencyCode)}
            </span>
          </div>
        </div>
      </div>
    </li>
  );
};
