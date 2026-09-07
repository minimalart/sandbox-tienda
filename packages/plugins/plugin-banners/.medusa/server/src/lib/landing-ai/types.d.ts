/**
 * Subset del `landing-page/ai/types` vendorizado en este plugin.
 *
 * Sólo se necesita `LandingAiError` para las rutas AI de banners
 * (ai-generate, ai-image, ai-compose). El resto de tipos del archivo original
 * (GenerateLandingInput, LandingSeo, PuckData, etc.) son propios de landings y
 * no aplican acá — se dejaron afuera a propósito para no arrastrar
 * `puck-schema.ts` ni la dep de Puck.
 *
 * Si banner en el futuro necesita más tipos, o (a) los vendorizamos también, o
 * (b) los exportamos desde `@minimalart/mercatto-plugin-landing-pages` y
 * consumimos por paquete.
 */
/** Error tipado para que las rutas devuelvan el status correcto. */
export declare class LandingAiError extends Error {
    status: number;
    constructor(message: string, status?: number);
}
