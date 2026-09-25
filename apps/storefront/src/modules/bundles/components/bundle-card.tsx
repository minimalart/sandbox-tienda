"use client";

import Link from "next/link";
import { useSiteHref } from "@lib/site-config/context";
import type { CSSProperties } from "react";
import { generateBundleTone } from "../lib/bundle-tone";
import { formatPrice } from "../lib/resolve-variant";

/**
 * Card de descubrimiento de un kit (PRD V2 §28-§39).
 *
 * NO reutiliza ProductCard: un kit no es un producto, es algo que el comprador
 * va a configurar, y la card tiene que decir eso antes de que lo abra. Por eso
 * el patrón es tipográfico + color en vez de foto: así ninguna tienda necesita
 * producir un asset por kit para que el listado se vea bien (§37).
 *
 * El color sale de la escala derivada del primario de la tienda: el mismo kit
 * compartido entre dos tiendas se ve con el color de cada una y no hay nada que
 * configurar ni que guardar por bundle (§30, §43-§44).
 *
 * `BundleEntry` sigue siendo la introducción al wizard; esto es la card del
 * listado (§40).
 */
export const BundleCard = ({
  handle,
  title,
  itemCount,
  configurableCount,
  fromAmount,
  currencyCode,
  primaryColor,
  index,
  className,
}: {
  handle: string;
  title: string;
  /** Productos que incluye el kit. */
  itemCount: number;
  /** Cuántos hay que elegir; 0 oculta la línea. */
  configurableCount?: number;
  /** Precio "desde", sólo cuando el backend pudo calcularlo. */
  fromAmount?: number | null;
  currencyCode?: string | null;
  /** Primario de la tienda activa (hex). */
  primaryColor: string | null | undefined;
  /** Posición estable dentro del listado: define el tono. */
  index: number;
  /** Para estirarla a la celda cuando convive con cards de producto. */
  className?: string;
}) => {
  const siteHref = useSiteHref();
  const tone = generateBundleTone(primaryColor, index);

  // El tono viaja como CSS vars para que el hover viva en CSS: con estilos
  // inline no hay `:hover` y habría que meter estado de JS para algo que el
  // navegador ya sabe hacer.
  const style = {
    "--tone-bg": tone.background,
    "--tone-bg-hover": tone.backgroundHover,
    "--tone-border": tone.border,
    "--tone-fg": tone.foreground,
    "--tone-fg-muted": tone.foregroundMuted,
  } as CSSProperties;

  return (
    <Link
      href={siteHref(`/bundles/${encodeURIComponent(handle)}`)}
      style={style}
      data-tone={tone.toneIndex}
      className={`group flex min-h-[220px] flex-col justify-between rounded-2xl border border-[--tone-border] bg-[--tone-bg] p-6 text-[--tone-fg] transition-colors duration-200 hover:bg-[--tone-bg-hover] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${className ?? ""}`}
    >
      <div className="space-y-2">
        <p className="text-[11px] uppercase tracking-[0.18em] text-[--tone-fg-muted]">Kit</p>
        <h3 className="text-2xl font-medium leading-tight tracking-tight">{title}</h3>
      </div>

      <div className="mt-6 space-y-1 text-sm text-[--tone-fg-muted]">
        <p>
          {itemCount} {itemCount === 1 ? "producto" : "productos"}
          {configurableCount ? (
            <>
              {" · "}
              {configurableCount} a elegir
            </>
          ) : null}
        </p>
        {typeof fromAmount === "number" && currencyCode ? (
          <p className="text-lg font-semibold text-[--tone-fg]">
            Desde {formatPrice(fromAmount, currencyCode)}
          </p>
        ) : null}
      </div>

      <span className="mt-6 inline-flex items-center gap-2 text-sm font-medium">
        Armar mi kit
        <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-1">
          →
        </span>
      </span>
    </Link>
  );
};
