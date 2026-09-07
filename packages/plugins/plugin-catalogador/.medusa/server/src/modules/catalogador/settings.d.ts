/**
 * Configuracion efectiva de settings del Catalogador — variante del plugin.
 *
 * En el HOST este archivo integraba la capa `app-settings` (precedencia
 * DB > env > default) para que rotar credenciales desde la card del
 * Catalogador se reflejara sin tocar el entorno. El plugin no tiene acceso a
 * `app-settings/*` (viven en `apps/backend/src/modules/`), asi que aca caemos
 * directo al ENTORNO — que es el mismo fallback que la version host aplica
 * cuando el snapshot todavia no se cargo o el descriptor no existe.
 *
 * Cuando `app-settings` se extraiga a su propio plugin/paquete compartido,
 * este archivo deberia volver a la version con precedencia DB > env > default.
 * Mientras tanto el comportamiento es EXACTAMENTE el de antes de la
 * migracion a `app-settings`: leer `process.env` y aplicar defaults.
 *
 * Es SINCRONICO por dos consumidores que no pueden esperar una promesa:
 *
 *  - `config.ts` arma `CatalogadorConfig` en un merge puro
 *    (`mergeCatalogadorConfig`), que tambien corre desde el snapshot
 *    congelado de una ejecucion.
 *  - `ai/external.ts` lee credenciales dentro de funciones que ya estan en
 *    el medio de un `fetch` con AbortController y no reciben el contenedor.
 *
 * Los 9 env vars declarados en `mercatto-plugin.json`:
 *   - CATALOGADOR_TEXT_MODEL
 *   - CATALOGADOR_IMAGE_MODEL
 *   - CATALOGADOR_BARCODE_API_URL
 *   - CATALOGADOR_BARCODE_API_KEY
 *   - CATALOGADOR_TAVILY_API_KEY
 *   - CATALOGADOR_SCRAPE_SEARCH_TEMPLATE
 *   - CATALOGADOR_JOB_SCHEDULE
 *   - OPENROUTER_API_KEY  (leida por `ai/openrouter.ts`)
 *   - OPENROUTER_SITE_URL (leida por `ai/openrouter.ts`)
 *
 * SERVER-ONLY: el bundle del admin nunca importa este archivo.
 */
export type CatalogadorSettings = {
    /** Modelo multimodal de texto/vision. Es el DEFAULT de `catalogador_config`. */
    textModel: string;
    /** Modelo de generacion de imagenes. Mismo criterio que el anterior. */
    imageModel: string;
    /** Endpoint del proveedor de barcode, con `{code}`. Vacio = feature apagada. */
    barcodeApiUrl: string;
    /** Bearer opcional del proveedor de barcode. */
    barcodeApiKey: string;
    /** Credencial de Tavily. Vacia = scraping "tavily" se saltea con warning. */
    tavilyApiKey: string;
    /** Template de busqueda del proveedor "http", con `{query}`/`{domain}`. */
    scrapeSearchTemplate: string;
};
export declare function getCatalogadorSettings(): CatalogadorSettings;
