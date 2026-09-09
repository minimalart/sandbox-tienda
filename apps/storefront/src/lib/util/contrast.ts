/**
 * Elige texto claro u oscuro para un fondo hex arbitrario, para no forzar al
 * operador a coordinar dos campos (bg + fg) cada vez que cambia el color.
 *
 * Usa luminancia percibida (fórmula sRGB 0.299/0.587/0.114). El umbral 0.6 se
 * eligió para que grises "medios" (#888) caigan del lado texto blanco: en la
 * duda, contraste alto sobre fondo oscuro.
 *
 * `hex` puede venir sin `#`, con mayúsculas y en formato corto `#abc`. Formatos
 * inválidos devuelven `null` — el caller decide qué usar como fallback.
 */
export function pickContrastText(
  hex: string | undefined,
  opts?: { onLight?: string; onDark?: string },
): string | null {
  if (!hex) return null;
  const cleaned = hex.trim().replace(/^#/, "");
  let full: string | null = null;
  if (/^[0-9a-fA-F]{6}$/.test(cleaned)) full = cleaned;
  else if (/^[0-9a-fA-F]{3}$/.test(cleaned))
    full = cleaned
      .split("")
      .map((c) => c + c)
      .join("");
  if (!full) return null;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const isLight = luminance > 0.6;
  return isLight ? (opts?.onLight ?? "#0f1114") : (opts?.onDark ?? "#ffffff");
}
