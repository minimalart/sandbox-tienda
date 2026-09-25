import type { SyntheticEvent } from "react";

/**
 * Imagen de reemplazo para productos sin foto. Vive en `public/placeholder.png`:
 * NO cambiar por un path que no exista en `public/` — cuando el archivo falta,
 * el browser dibuja su ícono de imagen rota con el `alt` encima (era la causa
 * de las "imágenes rotas" en la grilla de tienda).
 *
 * Vive en un módulo plano (sin "use client") para que lo puedan importar tanto
 * los server components — que sólo lo usan como dato, ej. el thumbnail que se
 * pasa al comparador — como los client components.
 */
export const PLACEHOLDER_IMAGE = "/placeholder.png";

/**
 * Fallback al placeholder para `<img>` crudos (los que no pasan por
 * `next/image`). Los catálogos importados (Demo Stores) hotlinkean las imágenes
 * de la tienda origen, así que una URL puede morir en cualquier momento (404,
 * protección de hotlinking, http en página https).
 *
 * El flag en el dataset evita el loop si el propio placeholder fallara.
 */
export function handleImageError(event: SyntheticEvent<HTMLImageElement>): void {
  const img = event.currentTarget;
  if (img.dataset.placeholderApplied === "true") return;
  img.dataset.placeholderApplied = "true";
  img.src = PLACEHOLDER_IMAGE;
}
