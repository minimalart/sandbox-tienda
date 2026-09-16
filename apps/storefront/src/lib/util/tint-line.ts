/**
 * Lectura del color entonado que viaja en `metadata.tint` de una LÍNEA (carrito
 * u orden). Lo escribe únicamente `POST /store/tinting/line-items` en el
 * backend; acá se lee siempre a la defensiva porque el objeto queda guardado en
 * órdenes viejas y viene versionado.
 *
 * Vive en `lib/util` y no dentro de un componente porque lo consumen cuatro
 * vistas distintas: el carrito, la página de orden confirmada, el detalle de
 * orden de la cuenta y el drawer. Antes lo tenía sólo `LineItemOptions`, y por
 * eso el color se veía en el carrito y desaparecía después de comprar.
 */

export type TintLine = {
  /** Nombre de la carta, o el código si la orden vieja no guardó el nombre. */
  label: string;
  /** Código de carta (ej. `82YR 83/056`). Puede venir vacío. */
  code: string;
  /** Hex de la carta. `null` cuando no se conoce — NUNCA se inventa uno. */
  hex: string | null;
};

type TintMetadata = {
  color_name?: unknown;
  color_code?: unknown;
  color_hex?: unknown;
};

export function readTintLine(
  metadata: Record<string, unknown> | null | undefined,
): TintLine | null {
  const tint = metadata?.tint as TintMetadata | undefined;
  if (!tint || typeof tint !== "object") return null;
  const name = typeof tint.color_name === "string" ? tint.color_name : "";
  const code = typeof tint.color_code === "string" ? tint.color_code : "";
  if (!name && !code) return null;
  return {
    label: name || code,
    code,
    hex:
      typeof tint.color_hex === "string" && /^#[0-9A-Fa-f]{6}$/.test(tint.color_hex)
        ? tint.color_hex
        : null,
  };
}

/** Texto plano del color, para `aria-label`, `title` y vistas sin swatch. */
export function tintLineText(tint: TintLine): string {
  const suffix = tint.code && tint.label !== tint.code ? ` (${tint.code})` : "";
  return `Color: ${tint.label}${suffix}`;
}
