import type { TenantTemplate } from "./types";

/**
 * Helpers de template para evitar repetir las uniones de strings por todo el
 * storefront. Las verticales "premium / impulso" (tecnología, tech-retail,
 * fashion, sports) reemplazan el chrome de grocery (SmartHeader / HomeTopbar /
 * Footer) por su propio header + footer y comparten ajustes de la tienda/PDP.
 *
 * Agregar una vertical nueva es una sola línea acá en vez de tocar ~5 archivos.
 */

/** Templates que montan su propio header/footer y ocultan el chrome de grocery. */
export const CUSTOM_CHROME_TEMPLATES = new Set<TenantTemplate>([
  "technology",
  "fashion",
  "tech-retail",
  "sports",
  "campaign",
]);

/** ¿El template usa header/footer propios (no el de grocery)? */
export function usesCustomChrome(template?: TenantTemplate): boolean {
  return !!template && CUSTOM_CHROME_TEMPLATES.has(template);
}

/**
 * Templates "de impulso": ajustan la grilla/cards de la tienda y muestran
 * "Comprar ahora" en el PDP. Hoy coincide con los de chrome propio.
 */
export function isImpulseTemplate(template?: TenantTemplate): boolean {
  return usesCustomChrome(template);
}
