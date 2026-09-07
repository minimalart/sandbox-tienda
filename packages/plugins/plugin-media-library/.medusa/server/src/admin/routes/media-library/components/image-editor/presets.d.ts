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
export declare const PRESETS: Preset[];
export declare const DEFAULT_PRESET: Preset;
