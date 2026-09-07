// Etiquetas de variantes para las cards del catálogo.
//
// Convierte las `options` a nivel PRODUCTO (Formato, Color, Medida…) en dos
// grupos que la card pinta en esquinas opuestas a los controles:
//  - `sizes`  → etiqueta de texto abajo a la izquierda (opuesta al add-to-cart)
//  - `colors` → círculos de color arriba a la izquierda (opuesta a favoritos)
//
// Sirve tanto para el documento Typesense (`values: string[]`) como para el
// producto de la Store API (`values: [{ value }]`), porque las cards del PLP y
// las de colecciones traen shapes distintos.
//
// OJO: el documento Typesense NO indexa las options por variante (ver
// `card-variant.ts`), así que acá se listan los valores que OFRECE el producto,
// no el valor de una variante puntual. Para un producto de una sola presentación
// (el caso mayoritario) eso es exactamente lo mismo.

/** Shape mínimo de una option, compatible con Typesense y con la Store API. */
export type VariantLabelOption = {
  title?: string | null;
  values?: Array<string | { value?: string | null } | null> | null;
};

export type ColorSwatch = {
  /** Nombre tal como está cargado (se muestra en el tooltip). */
  name: string;
  hex: string;
  /** Los tonos de madera se pintan con una textura de vetas encima del color. */
  isWood: boolean;
};

export type VariantLabels = {
  /** Valores de las options que NO son de color (Formato, Medida, Peso…). */
  sizes: string[];
  /** Valores de una option de color que pudimos resolver a un hex. */
  colors: ColorSwatch[];
  /** Colores cargados con un nombre que no está en el mapa: van como texto. */
  unknownColors: string[];
};

const EMPTY_LABELS: VariantLabels = { sizes: [], colors: [], unknownColors: [] };

/**
 * Valores que Medusa (y el sync del ERP) usan como relleno cuando el producto
 * no tiene presentaciones reales. Mostrarlos sería ruido en TODAS las cards: el
 * catálogo de Zeus trae `Formato: Único` en la enorme mayoría de los productos.
 */
const PLACEHOLDER_VALUE_RE =
  /^(unico|default|default option|default title|standard|estandar|n\/?a|na|sin especificar|-{1,2}|—+)$/;

/** Títulos de option que se pintan como círculo de color en vez de texto. */
const COLOR_OPTION_RE = /(colou?r|tono)/;

/** Minúsculas y sin tildes, para comparar contra los mapas de abajo. */
const normalize = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/**
 * Tonos de madera: además del color llevan una textura de vetas en el SVG.
 * Son los acabados típicos de protectores/lasures para madera (Xylasol y
 * compañía), donde el nombre del color ES una especie de madera.
 */
const WOOD_TONES: Record<string, string> = {
  natural: "#D9B382",
  cristal: "#E6D9C2",
  incoloro: "#E6D9C2",
  transparente: "#E6D9C2",
  pino: "#D8B778",
  "pino oregon": "#C89A5B",
  roble: "#B07D4A",
  "roble claro": "#C99B62",
  "roble oscuro": "#6B4423",
  nogal: "#5A3A22",
  "nogal claro": "#7B5230",
  "nogal oscuro": "#422917",
  caoba: "#6E2717",
  cedro: "#A8552B",
  teca: "#9A6B3F",
  teka: "#9A6B3F",
  algarrobo: "#7A4A2A",
  cerezo: "#8B4A32",
  wengue: "#3E2A20",
  ebano: "#2B2118",
  cipres: "#C2A173",
  guindo: "#8A3324",
  petiribi: "#8C5A34",
};

/** Colores "planos": círculo lleno, sin textura. */
const FLAT_COLORS: Record<string, string> = {
  blanco: "#FFFFFF",
  "blanco mate": "#FAFAF7",
  hueso: "#F2EADB",
  marfil: "#FFFFF0",
  crema: "#F5EBDC",
  beige: "#E8D8BE",
  arena: "#DDBF94",
  tiza: "#F2EFE6",
  negro: "#111111",
  gris: "#9CA3AF",
  "gris claro": "#D1D5DB",
  "gris oscuro": "#4B5563",
  grafito: "#383E42",
  cemento: "#9AA0A6",
  plata: "#C0C0C0",
  plateado: "#C0C0C0",
  aluminio: "#B6B9BC",
  dorado: "#D4AF37",
  cobre: "#B87333",
  bronce: "#8C6A3F",
  rojo: "#DC2626",
  bordo: "#7F1D1D",
  teja: "#B04A2F",
  terracota: "#C1613C",
  naranja: "#EA580C",
  ocre: "#CC7722",
  amarillo: "#FACC15",
  verde: "#16A34A",
  "verde claro": "#4ADE80",
  "verde oscuro": "#166534",
  "verde ingles": "#1F4F3A",
  oliva: "#6B7A34",
  celeste: "#7DD3FC",
  turquesa: "#14B8A6",
  azul: "#2563EB",
  "azul marino": "#1E3A8A",
  violeta: "#7C3AED",
  lila: "#C4B5FD",
  rosa: "#EC4899",
  fucsia: "#D946EF",
  salmon: "#FA8072",
  marron: "#78350F",
};

/**
 * ¿Esta option se pinta como color? Lo usan el selector del PDP y el del quick
 * view para mostrar el círculo al lado (o en vez) del nombre del valor.
 */
export function isColorOptionTitle(title: string | null | undefined): boolean {
  return COLOR_OPTION_RE.test(normalize(title ?? ""));
}

/** Resuelve un nombre de color a hex, o `null` si no lo conocemos. */
export function resolveColorSwatch(name: string): ColorSwatch | null {
  const key = normalize(name);
  if (!key) return null;
  const wood = WOOD_TONES[key];
  if (wood) return { name: name.trim(), hex: wood, isWood: true };
  const flat = FLAT_COLORS[key];
  if (flat) return { name: name.trim(), hex: flat, isWood: false };
  return null;
}

/** Aplana `values` (string[] | {value}[]) descartando placeholders y vacíos. */
function readValues(option: VariantLabelOption): string[] {
  const raw = option.values ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of raw) {
    const value = (typeof entry === "string" ? entry : entry?.value ?? "")?.trim();
    if (!value) continue;
    const key = normalize(value);
    if (PLACEHOLDER_VALUE_RE.test(key)) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

/**
 * Etiquetas a pintar en la card para un producto. Devuelve listas vacías
 * cuando el producto no tiene options con valores reales (el caso mayoritario),
 * así la card no pinta nada.
 */
export function getVariantLabels(
  product: { options?: VariantLabelOption[] | null } | null | undefined,
): VariantLabels {
  const options = product?.options;
  if (!Array.isArray(options) || options.length === 0) return EMPTY_LABELS;

  const sizes: string[] = [];
  const colors: ColorSwatch[] = [];
  const unknownColors: string[] = [];

  for (const option of options) {
    const values = readValues(option);
    if (values.length === 0) continue;
    if (COLOR_OPTION_RE.test(normalize(option.title ?? ""))) {
      for (const value of values) {
        const swatch = resolveColorSwatch(value);
        if (swatch) colors.push(swatch);
        else unknownColors.push(value);
      }
    } else {
      sizes.push(...values);
    }
  }

  if (sizes.length === 0 && colors.length === 0 && unknownColors.length === 0) {
    return EMPTY_LABELS;
  }
  return { sizes, colors, unknownColors };
}
