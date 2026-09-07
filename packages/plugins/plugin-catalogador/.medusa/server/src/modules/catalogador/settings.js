"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCatalogadorSettings = getCatalogadorSettings;
/**
 * Un valor con espacios de mas tiene que seguir comportandose como vacio,
 * no como una URL rota. Historicamente se leia con `process.env.X?.trim()`.
 */
function readTrimmed(key) {
    const raw = process.env[key];
    return typeof raw === 'string' ? raw.trim() : '';
}
function getCatalogadorSettings() {
    return {
        textModel: readTrimmed('CATALOGADOR_TEXT_MODEL') || 'google/gemini-2.5-flash',
        imageModel: readTrimmed('CATALOGADOR_IMAGE_MODEL') || 'google/gemini-2.5-flash-image',
        barcodeApiUrl: readTrimmed('CATALOGADOR_BARCODE_API_URL'),
        barcodeApiKey: readTrimmed('CATALOGADOR_BARCODE_API_KEY'),
        tavilyApiKey: readTrimmed('CATALOGADOR_TAVILY_API_KEY'),
        scrapeSearchTemplate: readTrimmed('CATALOGADOR_SCRAPE_SEARCH_TEMPLATE'),
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2V0dGluZ3MuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy9jYXRhbG9nYWRvci9zZXR0aW5ncy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBbUNHOztBQTBCSCx3REFTQztBQWxCRDs7O0dBR0c7QUFDSCxTQUFTLFdBQVcsQ0FBQyxHQUFXO0lBQzlCLE1BQU0sR0FBRyxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDN0IsT0FBTyxPQUFPLEdBQUcsS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO0FBQ25ELENBQUM7QUFFRCxTQUFnQixzQkFBc0I7SUFDcEMsT0FBTztRQUNMLFNBQVMsRUFBRSxXQUFXLENBQUMsd0JBQXdCLENBQUMsSUFBSSx5QkFBeUI7UUFDN0UsVUFBVSxFQUFFLFdBQVcsQ0FBQyx5QkFBeUIsQ0FBQyxJQUFJLCtCQUErQjtRQUNyRixhQUFhLEVBQUUsV0FBVyxDQUFDLDZCQUE2QixDQUFDO1FBQ3pELGFBQWEsRUFBRSxXQUFXLENBQUMsNkJBQTZCLENBQUM7UUFDekQsWUFBWSxFQUFFLFdBQVcsQ0FBQyw0QkFBNEIsQ0FBQztRQUN2RCxvQkFBb0IsRUFBRSxXQUFXLENBQUMsb0NBQW9DLENBQUM7S0FDeEUsQ0FBQztBQUNKLENBQUMifQ==