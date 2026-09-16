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
 * Templates "de impulso": ajustan la grilla/cards de la tienda con tokens
 * scopeados (--f-*, --tech-*, --tr-*, --sp-*) y muestran "Comprar ahora" en
 * el PDP.
 *
 * `campaign` NO entra acá aunque comparta chrome custom: es una landing
 * institucional que reusa el tratamiento default del catálogo (grocery-like) y
 * NO ofrece PDP con "Comprar ahora" — el flow es hero → grid → carrito directo.
 * Si estuviera en esta lista la card cae al bloque default `--tech-*` que no
 * existe en el scope de campaign y rompe visualmente (bordes, badges, etc.).
 */
const IMPULSE_TEMPLATES = new Set<TenantTemplate>([
  "technology",
  "fashion",
  "tech-retail",
  "sports",
]);

export function isImpulseTemplate(template?: TenantTemplate): boolean {
  return !!template && IMPULSE_TEMPLATES.has(template);
}

/**
 * Templates sin PLP dedicada (`/store`). En campaña, por ejemplo, todo el
 * feed vive en la home (`/`) y esa ruta devuelve 404 — cualquier link a "la
 * tienda" (checkout, empty state del cart, breadcrumbs) tiene que caer al
 * home del template en su lugar.
 */
const TEMPLATES_WITHOUT_STORE_PAGE = new Set<TenantTemplate>(["campaign"]);

/** Href al feed principal según el template: `/` cuando no hay PLP, `/store` si la hay. */
export function storeFeedHref(template?: TenantTemplate): "/" | "/store" {
  return template && TEMPLATES_WITHOUT_STORE_PAGE.has(template) ? "/" : "/store";
}

/** Campaign keeps product browsing in quick view, without a dedicated PDP. */
export function usesQuickViewOnly(template?: TenantTemplate): boolean {
  return template === "campaign";
}

/** Normalize recipient copy at presentation time, preserving saved site content. */
export function recipientWording(text: string, template?: TenantTemplate): string {
  if (template !== "campaign") return text;
  return text
    .replace(/\buna persona válida\b/g, "un estudiante válido")
    .replace(/\buna persona repetida\b/g, "un estudiante repetido")
    .replace(/\bla persona ya cargada\b/g, "el estudiante ya cargado")
    .replace(/\b([Ll])a persona\b/g, (_, letter) => letter === "L" ? "El estudiante" : "el estudiante")
    .replace(/\b([Uu])na persona\b/g, (_, letter) => letter === "U" ? "Un estudiante" : "un estudiante")
    .replace(/\b([Ll])as personas\b/g, (_, letter) => letter === "L" ? "Los estudiantes" : "los estudiantes")
    .replace(/\b(destinatarios?|alumnos?|personas?)\b/gi, word => {
      const value = word.toLowerCase().endsWith("s") ? "estudiantes" : "estudiante";
      return word[0] === word[0].toUpperCase() ? value[0].toUpperCase() + value.slice(1) : value;
    });
}
