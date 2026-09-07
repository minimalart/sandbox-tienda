/** Shared AI account and landing defaults are resolved on each call.
 * Before the host registers its reader, env remains the compatibility fallback. */
export type LandingAiSettings = {
    /** Credencial de OpenRouter. `''` si no está seteada → los clientes tiran 503. */
    apiKey: string;
    /** Modelo de texto para landings y banners. */
    model: string;
    /** Reintentos ante JSON inválido. Nunca negativo. */
    maxRetries: number;
    /** `HTTP-Referer` de atribución. */
    siteUrl: string;
};
export declare function getLandingAiSettings(): LandingAiSettings;
