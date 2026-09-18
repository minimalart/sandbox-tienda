/**
 * Tonos automáticos para las cards de bundles (PRD V2 §31-§35).
 *
 * Cada tienda ya tiene su color primario; los kits se diferencian visualmente
 * derivando una escala de ese color, sin configuración manual por bundle y sin
 * persistir nada: el mismo bundle compartido entre dos tiendas se ve con el
 * color de cada una (§43-§44).
 *
 * Los tonos se generan **mezclando** color, no bajando opacidad: con opacidad,
 * la legibilidad del texto depende de lo que haya atrás y varía muchísimo según
 * el primario (§32). Acá el fondo es un color sólido y el texto se elige por
 * contraste WCAG medido, no a ojo.
 *
 * Módulo PURO a propósito (sin imports): así lo puede usar el server component
 * del listado, un client component y `node --test` sin tocar nada más. El mismo
 * input da siempre el mismo output, de modo que SSR y cliente pintan igual
 * (§33).
 */

export interface BundleTone {
  /** Fondo de la card. */
  background: string;
  /** Fondo en hover: un paso más oscuro de la misma escala. */
  backgroundHover: string;
  /** Borde, apenas más oscuro que el fondo. */
  border: string;
  /** Color de texto con contraste suficiente sobre `background`. */
  foreground: string;
  /** Color del texto secundario: el mismo tono, un poco más suave. */
  foregroundMuted: string;
  /** Índice de tono usado, para tests y depuración. */
  toneIndex: number;
}

/**
 * Seis pasos alcanzan para un listado escolar (un kit por grado) y garantizan
 * que dos cards contiguas nunca compartan tono, porque el índice avanza de a
 * uno (§35).
 */
export const BUNDLE_TONE_COUNT = 6;

/** Luminosidades de la escala, de más clara a más profunda. */
const TONE_LIGHTNESS = [94, 88, 82, 76, 70, 64];

/** Saturación mínima para que un primario apagado no produzca seis grises. */
const MIN_SATURATION = 18;

const FALLBACK_HEX = "#4b5563"; // neutral-600: si el primario no es un hex válido.

type Rgb = { r: number; g: number; b: number };
type Hsl = { h: number; s: number; l: number };

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const parseHex = (input: string | null | undefined): Rgb | null => {
  if (typeof input !== "string") return null;
  const hex = input.trim().replace(/^#/, "");
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((c) => c + c)
          .join("")
      : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
  };
};

const rgbToHsl = ({ r, g, b }: Rgb): Hsl => {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  const l = (max + min) / 2;

  if (delta === 0) return { h: 0, s: 0, l: l * 100 };

  const s = delta / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === rn) h = ((gn - bn) / delta) % 6;
  else if (max === gn) h = (bn - rn) / delta + 2;
  else h = (rn - gn) / delta + 4;
  h *= 60;
  if (h < 0) h += 360;

  return { h, s: s * 100, l: l * 100 };
};

const hslToRgb = ({ h, s, l }: Hsl): Rgb => {
  const sn = clamp(s, 0, 100) / 100;
  const ln = clamp(l, 0, 100) / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const hp = ((h % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const [r1, g1, b1] =
    hp < 1
      ? [c, x, 0]
      : hp < 2
        ? [x, c, 0]
        : hp < 3
          ? [0, c, x]
          : hp < 4
            ? [0, x, c]
            : hp < 5
              ? [x, 0, c]
              : [c, 0, x];
  const m = ln - c / 2;
  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  };
};

const toHex = ({ r, g, b }: Rgb): string =>
  `#${[r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0")).join("")}`;

/** Luminancia relativa WCAG. */
const luminance = ({ r, g, b }: Rgb): number => {
  const channel = (value: number): number => {
    const v = value / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

/** Ratio de contraste WCAG entre dos colores (1 a 21). */
export const contrastRatio = (a: Rgb, b: Rgb): number => {
  const la = luminance(a);
  const lb = luminance(b);
  const [light, dark] = la >= lb ? [la, lb] : [lb, la];
  return (light + 0.05) / (dark + 0.05);
};

const WHITE: Rgb = { r: 255, g: 255, b: 255 };

/**
 * Tono `index` de la escala derivada de `primaryColor`.
 *
 * El índice se envuelve con módulo, así que sirve para cualquier cantidad de
 * bundles; dos cards contiguas nunca comparten tono porque el índice avanza de
 * a uno sobre una escala de seis.
 */
export const generateBundleTone = (
  primaryColor: string | null | undefined,
  index: number,
): BundleTone => {
  const rgb = parseHex(primaryColor) ?? parseHex(FALLBACK_HEX)!;
  const base = rgbToHsl(rgb);
  const saturation = Math.max(base.s, base.s === 0 ? 0 : MIN_SATURATION);

  const safeIndex = Number.isFinite(index) ? Math.abs(Math.trunc(index)) : 0;
  const toneIndex = safeIndex % BUNDLE_TONE_COUNT;
  const lightness = TONE_LIGHTNESS[toneIndex]!;

  const background = hslToRgb({ h: base.h, s: saturation, l: lightness });
  const backgroundHover = hslToRgb({ h: base.h, s: saturation, l: lightness - 6 });
  const border = hslToRgb({ h: base.h, s: saturation, l: lightness - 12 });

  // Texto: se prueba un oscuro del MISMO matiz (que se ve intencional, no
  // negro genérico) y se baja la luminosidad hasta llegar a AA. Si ni el más
  // oscuro alcanza — sólo pasa con fondos muy oscuros — se usa blanco.
  let foreground = hslToRgb({ h: base.h, s: Math.min(saturation, 60), l: 24 });
  for (let l = 24; l >= 8; l -= 4) {
    foreground = hslToRgb({ h: base.h, s: Math.min(saturation, 60), l });
    if (contrastRatio(foreground, background) >= 4.5) break;
  }
  if (contrastRatio(foreground, background) < 4.5) foreground = WHITE;

  const muted =
    contrastRatio(foreground, background) >= 7
      ? hslToRgb({ h: base.h, s: Math.min(saturation, 45), l: 38 })
      : foreground;

  return {
    background: toHex(background),
    backgroundHover: toHex(backgroundHover),
    border: toHex(border),
    foreground: toHex(foreground),
    foregroundMuted: toHex(
      contrastRatio(muted, background) >= 4.5 ? muted : foreground,
    ),
    toneIndex,
  };
};
