import type { ExportFormat, PixelRect, SmoothingQuality } from './types';
import type { Preset } from './presets';
/** Carga una imagen para mostrar (directo, con crossOrigin para intentar CORS). */
export declare function loadDisplayImage(url: string): Promise<HTMLImageElement>;
/**
 * Carga la imagen para EXPORTAR vía el proxy same-origin del backend, así el
 * canvas nunca queda "tainted" por CORS de S3 (toBlob no falla).
 */
export declare function loadExportImage(url: string): Promise<HTMLImageElement>;
/** Smart crop: devuelve el mejor recorte (px naturales) para un aspect dado. */
export declare function smartCrop(img: HTMLImageElement, aspect: number | null): Promise<PixelRect>;
/** Recorte centrado a un aspect dado (fallback cuando no hay crop manual/smart). */
export declare function centerCrop(img: HTMLImageElement, aspect: number | null): PixelRect;
export type ExportResult = {
    file: File;
    width: number;
    height: number;
    bytes: number;
};
/** Aplica crop + resize y exporta a File (webp/jpeg) con calidad/smoothing. */
export declare function exportImage(opts: {
    exportImg: HTMLImageElement;
    rect: PixelRect;
    preset: Preset;
    format: ExportFormat;
    quality: number;
    smoothing: SmoothingQuality;
    baseName: string;
    customW?: number;
    customH?: number;
}): Promise<ExportResult>;
