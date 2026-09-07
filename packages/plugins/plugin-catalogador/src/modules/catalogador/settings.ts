/**
 * Configuracion efectiva de settings del Catalogador — variante del plugin.
 *
 * Precedencia DB > env > default, para que rotar credenciales desde la card del
 * Catalogador se refleje sin tocar el entorno.
 *
 * Este archivo leyo `process.env` a secas durante la etapa en que el plugin no
 * tenia forma de llegar a `app-settings/*` (viven en `apps/backend/src/modules/`).
 * Ahora la tiene: el host publica un lector en `globalThis` desde el loader de
 * `app-settings` y `lib/host-settings.ts` lo consume, con degradacion al entorno
 * cuando ese puente no esta. El motivo por el que la deuda se pago —y lo que
 * costo— esta en el encabezado de ese archivo (DESDEELSUR-46).
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

import {
  CATALOGADOR_SETTINGS_NAMESPACE,
  readForeignSetting,
} from '../../lib/host-settings';

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

/**
 * Un valor con espacios de mas tiene que seguir comportandose como vacio,
 * no como una URL rota. Historicamente se leia con `process.env.X?.trim()`;
 * `readForeignSetting` mantiene ese contrato (devuelve `''`, nunca `undefined`)
 * y le agrega adelante la fila de la base.
 *
 * `CATALOGADOR_JOB_SCHEDULE` NO pasa por aca a proposito: es `envOnly` porque
 * Medusa hornea el schedule al arrancar y no se puede reprogramar en runtime,
 * asi que leerlo de la base daria un valor que la UI muestra y el job ignora.
 * Lo lee `jobs/catalogador-process.ts` de `process.env` directo.
 */
function readTrimmed(key: string): string {
  return readForeignSetting(CATALOGADOR_SETTINGS_NAMESPACE, key);
}

export function getCatalogadorSettings(): CatalogadorSettings {
  return {
    textModel: readTrimmed('CATALOGADOR_TEXT_MODEL') || 'google/gemini-2.5-flash',
    imageModel: readTrimmed('CATALOGADOR_IMAGE_MODEL') || 'google/gemini-2.5-flash-image',
    barcodeApiUrl: readTrimmed('CATALOGADOR_BARCODE_API_URL'),
    barcodeApiKey: readTrimmed('CATALOGADOR_BARCODE_API_KEY'),
    tavilyApiKey: readTrimmed('CATALOGADOR_TAVILY_API_KEY'),
    scrapeSearchTemplate: readTrimmed('CATALOGADOR_SCRAPE_SEARCH_TEMPLATE'),
  };
}
