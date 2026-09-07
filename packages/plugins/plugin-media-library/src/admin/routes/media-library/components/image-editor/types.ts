export type PixelRect = { x: number; y: number; width: number; height: number };

export type ExportFormat = 'webp' | 'jpeg';
export type SmoothingQuality = 'low' | 'medium' | 'high';

export type ExportSettings = {
  presetKey: string;
  format: ExportFormat;
  quality: number; // 0..1
  smoothing: SmoothingQuality;
};

/** Imagen en edición dentro del modal (single o batch). */
export type EditorImage = {
  /** id del MediaAsset origen (si viene de la galería). */
  sourceAssetId?: string;
  sourceFileId?: string | null;
  sourceUrl: string;
  filename: string;
  /** crop manual (px sobre la imagen natural) desde react-easy-crop. */
  manualPixels?: PixelRect;
  /** crop inteligente (px) si se aplicó smartcrop. */
  smartPixels?: PixelRect;
  useSmart?: boolean;
};
