/** Presets de ecommerce para el editor de imágenes. */
export type Preset = {
  key: string;
  label: string;
  /** aspect (w/h) para el crop; null = libre / mantener ratio. */
  aspect: number | null;
  /** tamaño objetivo del export. Para 'original_optimizado' se usa maxDim. */
  width?: number;
  height?: number;
  /** lado máximo manteniendo ratio (para original optimizado). */
  maxDim?: number;
};

export const PRESETS: Preset[] = [
  { key: 'product_square', label: 'Producto principal (1200×1200)', aspect: 1, width: 1200, height: 1200 },
  { key: 'thumbnail', label: 'Thumbnail (600×600)', aspect: 1, width: 600, height: 600 },
  { key: 'banner', label: 'Banner / lifestyle (1600×900)', aspect: 16 / 9, width: 1600, height: 900 },
  { key: 'original_optimizado', label: 'Original optimizado (máx 2000px)', aspect: null, maxDim: 2000 },
  { key: 'free', label: 'Libre', aspect: null },
];

export const DEFAULT_PRESET = PRESETS[0]!;
