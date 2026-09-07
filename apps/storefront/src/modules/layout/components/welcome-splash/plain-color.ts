// Color de fondo por defecto del splash (cuando el banner no define card_color).
export const SPLASH_DEFAULT_BG = '#0b1437';

const BASE_FOR_DARK_SPLASH = '#f4f4f5'; // splash oscuro → base claro
const BASE_FOR_LIGHT_SPLASH = '#0b1020'; // splash claro → base oscuro

/**
 * Devuelve un color pleno de base que CONTRASTA con el color de fondo del
 * splash (para que se note la animación del bloom). Si el splash es oscuro,
 * base claro; si es claro, base oscuro. Entrada inválida → se asume el default
 * (oscuro) y se devuelve base claro.
 */
export function contrastingPlainColor(hex?: string): string {
  const normalized = (hex ?? SPLASH_DEFAULT_BG).trim().replace('#', '');
  if (normalized.length !== 3 && normalized.length !== 6) {
    return BASE_FOR_DARK_SPLASH;
  }
  const full =
    normalized.length === 3
      ? normalized
          .split('')
          .map((c) => c + c)
          .join('')
      : normalized;
  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return BASE_FOR_DARK_SPLASH;
  }
  // Luminancia relativa aproximada (sRGB).
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? BASE_FOR_LIGHT_SPLASH : BASE_FOR_DARK_SPLASH;
}
