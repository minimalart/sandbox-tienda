import type { ChatMessage } from '../../../lib/landing-ai/client';
/** Producto usado como contexto para el copy (nombre real + descripción corta). */
export type BannerProductContext = {
    title: string;
    description?: string;
};
export type GenerateBannerCopyInput = {
    brief: string;
    tone?: string;
    goal?: string;
    audience?: string;
    locale?: string;
    placement?: string;
    /** Productos elegidos por el usuario; el copy debe girar en torno a ellos. */
    products?: BannerProductContext[];
};
/** Mensajes para generar el copy (title/subtitle/body + CTA) de un banner. */
export declare function buildBannerCopyMessages(input: GenerateBannerCopyInput): ChatMessage[];
/**
 * Prompt para la imagen del banner. Igual que en landings, prohíbe texto en la
 * imagen (el copy va superpuesto por el front) y pide zonas de tono parejo.
 * Si se pasan productos con imágenes de referencia (`withProductRefs`), instruye
 * al modelo a componer la escena manteniendo cada producto FIEL a su foto (sin
 * deformarlo ni cambiar su diseño/packaging).
 */
export declare function buildBannerImagePrompt(input: {
    brief: string;
    title?: string;
    styleHint?: string;
    productTitles?: string[];
    withProductRefs?: boolean;
}): string;
