import { cache } from "react";
import { getActiveTenant } from "../active-tenant";
import type React from "react";

/**
 * Generates CSS variables from the site config theme colors.
 * Injected inline on <body> by the root layout.
 */
export const getTenantThemeStyles = cache(
  async (): Promise<React.CSSProperties> => {
    const tenant = await getActiveTenant();
    const { colors } = tenant.theme;
    return {
      "--primary-color": colors.primary,
      "--secondary-color": colors.secondary || colors.primary,
      ...(colors.accent && { "--accent-color": colors.accent }),
      // Fondos del chrome: solo se declaran si el tenant los configuró. El
      // header/footer los consumen como `var(--header-bg, <su default>)`, así
      // que no declararlos = cada template conserva su fondo propio.
      ...(colors.headerBackground && { "--header-bg": colors.headerBackground }),
      ...(colors.footerBackground && { "--footer-bg": colors.footerBackground }),
    } as React.CSSProperties;
  }
);

/** Parsea un hex (#rrggbb) a componentes HSL (0-360, 0-100, 0-100). */
function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const m = hex.trim().replace(/^#/, "").match(/^([0-9a-fA-F]{6})$/);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/** Triple HSL "h s% l%" que consumen las vars shadcn (vía hsl(var(--x))). */
function hexToHslTriple(hex: string): string | null {
  const hsl = hexToHsl(hex);
  return hsl ? `${hsl.h} ${hsl.s}% ${hsl.l}%` : null;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/**
 * Estilos del portal B2B: además de las vars del tenant, mapea el color primario
 * del demo sobre las vars del design system (shadcn) que usan Button/Sidebar/rings,
 * para que el portal NO quede pegado al verde por defecto. Scopeado al subárbol
 * del portal (se aplica en (b2b)/layout), no afecta el B2C.
 */
export const getB2BPortalThemeStyles = cache(
  async (): Promise<React.CSSProperties> => {
    const tenant = await getActiveTenant();
    const { colors } = tenant.theme;
    const style: Record<string, string> = {
      "--primary-color": colors.primary,
      "--secondary-color": colors.secondary || colors.primary,
      ...(colors.accent && { "--accent-color": colors.accent }),
    };
    const hsl = hexToHsl(colors.primary);
    if (hsl) {
      const triple = `${hsl.h} ${hsl.s}% ${hsl.l}%`;
      style["--primary"] = triple;
      style["--primary-foreground"] = "0 0% 100%";
      style["--sidebar-primary"] = triple;
      style["--sidebar-primary-foreground"] = "0 0% 100%";
      style["--ring"] = triple;
      style["--sidebar-ring"] = triple;
      // Hover/activo de la nav + acentos suaves: tinte pálido y texto oscuro
      // derivados del hue/sat de la demo (antes quedaban pegados al verde).
      const accentBg = `${hsl.h} ${clamp(hsl.s, 25, 60)}% 95%`;
      const accentFg = `${hsl.h} ${clamp(hsl.s, 35, 90)}% 25%`;
      style["--accent"] = accentBg;
      style["--accent-foreground"] = accentFg;
      style["--sidebar-accent"] = accentBg;
      style["--sidebar-accent-foreground"] = accentFg;
    }
    return style as React.CSSProperties;
  }
);

/**
 * Overrides de las vars de marca (shadcn) para el modo oscuro del portal. La clase
 * `.dark` de globals.css re-declara `--primary`/`--accent`/etc. con el verde por
 * defecto sobre su propio subárbol, pisando el color del demo que hereda por inline
 * style. Inyectamos estos valores en un `.dark{}` scopeado (después de globals.css)
 * para que el demo gane también en oscuro. El primario se aclara para contraste
 * sobre el fondo oscuro (mismo criterio que el verde de globals.css: l≈48, texto
 * oscuro encima), derivado del hue/sat de la demo.
 */
export const getB2BPortalDarkThemeStyles = cache(
  async (): Promise<React.CSSProperties> => {
    const tenant = await getActiveTenant();
    const { colors } = tenant.theme;
    const hsl = hexToHsl(colors.primary);
    if (!hsl) return {} as React.CSSProperties;
    // Primario aclarado para leerse sobre fondo oscuro; texto oscuro encima.
    const l = clamp(hsl.l + 14, 48, 62);
    const s = clamp(hsl.s, 30, 72);
    const triple = `${hsl.h} ${s}% ${l}%`;
    const fg = "0 0% 8%";
    // Acentos oscuros tintados con el hue de la demo (paralelo al verde de .dark).
    const accentBg = `${hsl.h} ${clamp(hsl.s, 15, 35)}% 22%`;
    const accentFg = `${hsl.h} ${clamp(hsl.s, 30, 72)}% 80%`;
    return {
      "--primary": triple,
      "--primary-foreground": fg,
      "--ring": triple,
      "--accent": accentBg,
      "--accent-foreground": accentFg,
      "--sidebar-primary": triple,
      "--sidebar-primary-foreground": fg,
      "--sidebar-accent": accentBg,
      "--sidebar-accent-foreground": accentFg,
      "--sidebar-ring": triple,
    } as React.CSSProperties;
  }
);
