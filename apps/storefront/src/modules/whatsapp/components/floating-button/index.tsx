"use client";

import {
  FLOATING_LAYER,
  floatingObstacle,
} from "@lib/util/floating-obstacle";
import { cn } from "@lib/util/cn";
import { useSafeBottomOffset } from "@lib/hooks/use-safe-bottom-offset";
import { useTenant } from "@lib/site-config/context";
import { useRef } from "react";

type WhatsappFloatingButtonProps = {
  /** Teléfono destino, solo dígitos y con código de país (lo normaliza el backend). */
  phone: string;
  /** Mensaje pre-cargado; vacío abre el chat en blanco. */
  message?: string;
  /** Nombre accesible y tooltip. */
  label: string;
};

/**
 * Distancia mínima al borde inferior. `useSafeBottomOffset` la sube sola cuando
 * hay algo anclado abajo (nav mobile, barra de agregar al carrito, banners…).
 */
const BASE_OFFSET = 20;

/**
 * z-index deliberadamente por DEBAJO de los overlays del storefront:
 *  - drawers y modales (>= 9000) tienen que taparlo,
 *  - el nav mobile (9999) y el banner de cookies (10000) también,
 *  - "volver arriba" (1000) gana si por algún motivo quedaran encimados.
 * Y por ENCIMA de lo que es contenido de página (barra sticky del PDP: 30).
 */
const Z_INDEX = 998;

/**
 * Botón flotante de WhatsApp. Se muestra solo si el toggle está activo en
 * Admin → WhatsApp → Ajustes (el slot del servidor decide si montarlo).
 *
 * Ubicación: esquina inferior derecha en todos los breakpoints — "volver arriba"
 * vive a la izquierda en mobile, así que no compiten. El offset vertical se mide
 * en runtime para no pisar el nav inferior, la barra de agregar al carrito de la
 * ficha (que es alta y también existe en desktop) ni los banners anclados abajo.
 */
export default function WhatsappFloatingButton({
  phone,
  message,
  label,
}: WhatsappFloatingButtonProps) {
  const anchorRef = useRef<HTMLAnchorElement>(null);
  const bottom = useSafeBottomOffset(
    anchorRef,
    BASE_OFFSET,
    FLOATING_LAYER.floatingButton,
  );
  const tenant = useTenant();
  // El template sports aplana bordes y sombras; seguimos su identidad como hace
  // "volver arriba", así el botón no se ve pegado de otra tienda.
  const isSportsTemplate = tenant.template === "sports";

  const href = message
    ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
    : `https://wa.me/${phone}`;

  return (
    <a
      ref={anchorRef}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      data-testid="whatsapp-floating-button"
      {...floatingObstacle(
        "whatsapp-floating-button",
        FLOATING_LAYER.floatingButton,
      )}
      className={cn(
        "fixed right-4 flex h-12 w-12 items-center justify-center bg-[#25D366] text-white transition-[bottom,transform,opacity] duration-300 hover:scale-105 active:scale-95 lg:right-6 lg:h-14 lg:w-14",
        isSportsTemplate
          ? "rounded-none border-2 border-[--sp-ink] shadow-none"
          : "rounded-full shadow-lg",
      )}
      style={{ bottom, zIndex: Z_INDEX }}
    >
      {/* Glifo oficial de WhatsApp, inline para no depender de una fuente de iconos. */}
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="h-6 w-6 lg:h-7 lg:w-7"
      >
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.966 1.164-.198.199-.396.223-.694.075-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.347-.397.52-.595.174-.198.232-.34.348-.567.116-.226.058-.425-.03-.594-.087-.17-.66-1.59-.904-2.178-.238-.573-.48-.487-.66-.497l-.562-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.073.149.198 2.096 3.2 5.077 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.572-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414-.074-.124-.272-.198-.57-.347z" />
        <path d="M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .104 5.334.101 11.892c0 2.096.549 4.14 1.595 5.945L0 24l6.335-1.652a12.02 12.02 0 0 0 5.71 1.447h.006c6.585 0 11.946-5.335 11.949-11.893a11.82 11.82 0 0 0-3.48-8.453zM12.05 21.785h-.004a9.87 9.87 0 0 1-5.032-1.378l-.361-.214-3.741.98 1.005-3.648-.239-.375a9.86 9.86 0 0 1-1.516-5.26c.002-5.45 4.455-9.884 9.933-9.884a9.86 9.86 0 0 1 7.01 2.906 9.78 9.78 0 0 1 2.9 6.99c-.003 5.45-4.456 9.883-9.955 9.883z" />
      </svg>
    </a>
  );
}
