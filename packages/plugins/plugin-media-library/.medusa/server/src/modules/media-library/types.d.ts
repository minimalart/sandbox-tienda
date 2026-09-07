/** Catálogo de assets ya subidos (imágenes/archivos) para reusar sin re-subir. */
export declare const MEDIA_LIBRARY_MODULE = "media_library";
export type MediaAssetInput = {
    url: string;
    file_id?: string | null;
    filename: string;
    mime_type?: string | null;
    size?: number | null;
    alt?: string | null;
    title?: string | null;
    source?: string | null;
    metadata?: Record<string, unknown> | null;
};
