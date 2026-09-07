"use client";

// Etiquetas de variantes de la card: qué presentaciones ofrece el producto,
// visible sin abrir el quick view. Los valores los resuelve
// `@lib/util/variant-labels` a partir de las options del producto.
//
// Ubicación (la elige la card, no este componente):
//  - colores → arriba a la izquierda, opuesto al botón de favoritos
//  - tamaño  → abajo a la izquierda, opuesto al add-to-cart
//
// Se apagan por demo con el toggle "Etiquetas de variantes"
// (useTenantSections().areVariantLabelsVisible).

import { useTenantSections } from "@lib/site-config/context";
import type { ColorSwatch, VariantLabelOption } from "@lib/util/variant-labels";
import { getVariantLabels } from "@lib/util/variant-labels";
import { useId } from "react";

/** Cuántos valores se muestran antes de resumir en "+N". */
const MAX_COLORS = 4;
const MAX_SIZES = 2;

/**
 * Círculo del color. Los tonos de madera (nogal, caoba, cedro, roble…) llevan
 * encima una textura de vetas: el nombre del color ES una madera, así que un
 * círculo plano marrón no se distingue de otro.
 */
export const ColorDot = ({
  swatch,
  className = "h-6 w-6",
}: {
  swatch: ColorSwatch;
  /**
   * Tamaño del círculo. El default (24px) es el que va DENTRO del pill con el
   * nombre del color. Cuando el círculo va suelto sobre la imagen (producto con
   * varios colores) se pide más grande, para que se note al menos como el botón
   * de favoritos (28px).
   */
  className?: string;
}) => {
  // `useId` trae caracteres (`:`) que rompen `url(#id)`, así que los saco.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const clipId = `vl-clip-${uid}`;
  const sheenId = `vl-sheen-${uid}`;

  return (
    <svg
      aria-hidden="true"
      className={`${className} shrink-0 drop-shadow-sm`}
      viewBox="0 0 24 24"
    >
      <defs>
        <clipPath id={clipId}>
          <circle cx="12" cy="12" r="10.5" />
        </clipPath>
        <linearGradient id={sheenId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.38" />
          <stop offset="55%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.16" />
        </linearGradient>
      </defs>
      {/* Anillo blanco: separa el círculo del fondo gris de la imagen. */}
      <circle cx="12" cy="12" r="12" fill="#ffffff" />
      <circle cx="12" cy="12" r="10.5" fill={swatch.hex} />
      {swatch.isWood && (
        <g clipPath={`url(#${clipId})`}>
          <g
            fill="none"
            stroke="#000000"
            strokeOpacity="0.24"
            strokeWidth="1.1"
            strokeLinecap="round"
          >
            <path d="M-2 5 C 6 2.2, 14 7.8, 26 5" />
            <path d="M-2 10 C 7 7.2, 15 12.8, 26 10" />
            <path d="M-2 15 C 6 12.2, 14 17.8, 26 15" />
            <path d="M-2 20 C 7 17.2, 15 22.8, 26 20" />
          </g>
          <g
            fill="none"
            stroke="#ffffff"
            strokeOpacity="0.22"
            strokeWidth="0.7"
            strokeLinecap="round"
          >
            <path d="M-2 7.4 C 6 4.6, 14 10.2, 26 7.4" />
            <path d="M-2 17.4 C 6 14.6, 14 20.2, 26 17.4" />
          </g>
        </g>
      )}
      <circle
        cx="12"
        cy="12"
        r="10.5"
        fill={`url(#${sheenId})`}
        clipPath={`url(#${clipId})`}
      />
      {/* Contorno marcado: sin esto los tonos pálidos (Cristal #E6D9C2, Natural)
          se pierden contra el fondo gris #F6F6F6 de la caja de imagen. */}
      <circle
        cx="12"
        cy="12"
        r="10.5"
        fill="none"
        stroke="#000000"
        strokeOpacity="0.42"
        strokeWidth="1.2"
      />
    </svg>
  );
};

const pillBase =
  "inline-flex max-w-full items-center rounded-[8px] border border-gray-200 bg-white/95 font-semibold text-[#111827] leading-none shadow-sm backdrop-blur-[2px]";

/** Pill del formato/medida: el texto es el contenido, así que va más grande. */
const pillClass = `${pillBase} h-[30px] truncate px-3 text-[14px]`;

/** Pill del color: lleva el círculo pegado al borde izquierdo y el nombre. */
const colorPillClass = `${pillBase} h-[32px] gap-1.5 py-0 pl-1 pr-2.5 text-[12px]`;

/**
 * Colores que ofrece el producto. Los nombres que no están en el mapa de
 * colores se muestran como texto en vez de descartarse (o de pintar un círculo
 * gris que mentiría sobre el color real).
 *
 * Con UN solo color se muestra el círculo junto al nombre ("Cristal"), que es lo
 * más claro y el caso mayoritario del catálogo (cada acabado es su propio
 * producto). Con dos o más no se pueden listar los nombres, así que caen a
 * círculos sueltos y más grandes.
 */
export const VariantColorLabels = ({
  colors,
  unknownColors,
}: {
  colors: ColorSwatch[];
  unknownColors: string[];
}) => {
  if (colors.length === 0 && unknownColors.length === 0) return null;
  const shown = colors.slice(0, MAX_COLORS);
  const extra = colors.length - shown.length;

  if (colors.length === 1 && unknownColors.length === 0) {
    const swatch = colors[0];
    return (
      <span className={colorPillClass} title={swatch.name}>
        <ColorDot swatch={swatch} />
        <span className="truncate">{swatch.name}</span>
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {shown.length > 0 && (
        <span
          className="flex flex-wrap items-center gap-1.5"
          title={colors.map((c) => c.name).join(" · ")}
        >
          {shown.map((swatch) => (
            <ColorDot
              className="h-[30px] w-[30px]"
              key={swatch.name}
              swatch={swatch}
            />
          ))}
          {extra > 0 && (
            <span className="font-semibold text-[#111827] text-[11px] leading-none">
              +{extra}
            </span>
          )}
        </span>
      )}
      {unknownColors.slice(0, 2).map((name) => (
        <span key={name} className={pillClass}>
          {name}
        </span>
      ))}
    </div>
  );
};

/**
 * Colores del producto, sin posicionamiento: para montarlos dentro de un stack
 * que ya arma el caller (p. ej. el quick view, que apila el badge de estado y
 * los colores en la misma esquina). Lee el toggle por su cuenta.
 */
export const ProductColorLabels = ({
  options,
}: {
  options?: VariantLabelOption[] | null;
}) => {
  const { areVariantLabelsVisible } = useTenantSections();
  if (!areVariantLabelsVisible) return null;
  const { colors, unknownColors } = getVariantLabels({ options });
  return <VariantColorLabels colors={colors} unknownColors={unknownColors} />;
};

/**
 * Formato/medida del producto con su posicionamiento a cargo del caller.
 * Devuelve `null` cuando no hay nada que mostrar, así no queda un wrapper vacío.
 */
export const ProductSizeLabel = ({
  options,
  className,
}: {
  options?: VariantLabelOption[] | null;
  className?: string;
}) => {
  const { areVariantLabelsVisible } = useTenantSections();
  if (!areVariantLabelsVisible) return null;
  const { sizes } = getVariantLabels({ options });
  if (sizes.length === 0) return null;
  return (
    <div className={className}>
      <VariantSizeLabel sizes={sizes} />
    </div>
  );
};

/**
 * Etiquetas sobre la imagen del producto (PDP y quick view), en las mismas
 * esquinas que en la card: colores arriba a la izquierda, formato abajo a la
 * izquierda. Lee el toggle por su cuenta, así lo puede montar un server
 * component (el template del PDP) sin volverse cliente.
 *
 * El contenedor padre tiene que ser `relative`.
 */
export const ImageVariantLabels = ({
  options,
  colorTopClass = "top-3",
}: {
  options?: VariantLabelOption[] | null;
  /**
   * Dónde empieza la columna de colores. El default choca con un badge de
   * estado en la misma esquina: los callers que ya pintan uno ("Nuevo", "Sin
   * Stock") pasan `top-12` para dejarlo arriba.
   */
  colorTopClass?: string;
}) => {
  const { areVariantLabelsVisible } = useTenantSections();
  if (!areVariantLabelsVisible) return null;

  const { sizes, colors, unknownColors } = getVariantLabels({ options });
  const hasColors = colors.length > 0 || unknownColors.length > 0;
  if (!hasColors && sizes.length === 0) return null;

  return (
    <>
      {hasColors && (
        <div
          className={`pointer-events-none absolute ${colorTopClass} left-3 z-20 max-w-[calc(100%-4.5rem)]`}
        >
          <VariantColorLabels colors={colors} unknownColors={unknownColors} />
        </div>
      )}
      {sizes.length > 0 && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-20 max-w-[calc(100%-4.5rem)]">
          <VariantSizeLabel sizes={sizes} />
        </div>
      )}
    </>
  );
};

/** Presentación/tamaño del producto (Formato, Medida, Peso…). */
export const VariantSizeLabel = ({ sizes }: { sizes: string[] }) => {
  if (sizes.length === 0) return null;
  const shown = sizes.slice(0, MAX_SIZES);
  const extra = sizes.length - shown.length;

  return (
    <span className={pillClass} title={sizes.join(" · ")}>
      {shown.join(" · ")}
      {extra > 0 ? ` +${extra}` : ""}
    </span>
  );
};
