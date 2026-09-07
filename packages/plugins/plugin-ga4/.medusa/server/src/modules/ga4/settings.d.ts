/**
 * Configuración efectiva de GA4 con la precedencia **snapshot > env > default**.
 *
 * La capa de snapshot vive en el host (`app-settings`) y el plugin la recibe vía
 * `@minimalart/mercatto-plugin-runtime`: el host registra su `resolveSettingSync`
 * envuelto una sola vez al arrancar, y este archivo lo lee vía
 * `getAppSettingsSyncReader`.
 *
 * Es SINCRÓNICA a propósito. `dispatch()` y `dispatchBuiltin()` corren por cada
 * evento del event bus, y meterles un `SELECT` a `site_setting` por hit sería
 * pagar una consulta por cada `add_to_cart` del sitio. El snapshot ya está en
 * memoria del host y se refresca en cada escritura del admin, así que leer de
 * ahí es gratis y consistente.
 *
 * Cuando el host no registró un reader —proyecto sin `app-settings`, tests,
 * boot antes del bridge— se cae a `process.env`. Es la MISMA semántica que la
 * extensión original tenía "antes de que el loader llene el snapshot".
 */
export type Ga4ResolvedSettings = {
    measurementId: string | null;
    apiSecret: string | null;
    gtmId: string | null;
    debug: boolean;
};
/**
 * La fila legacy `ga4_settings`, que existe desde antes de `app-settings`.
 * Ver `mergeWithLegacyRow` para por qué sigue viva.
 */
export type LegacyGa4SettingsRow = {
    measurement_id?: string | null;
    api_secret?: string | null;
    gtm_id?: string | null;
    debug?: boolean | null;
};
export declare function getGa4Settings(): Ga4ResolvedSettings;
/**
 * Mezcla la fila legacy `ga4_settings` con los ajustes de `app-settings`.
 *
 * Precedencia, por campo:
 *
 *   1. entrada en `site_setting` — alguien la guardó en la card. Intención
 *      explícita y en el sistema nuevo: gana siempre.
 *   2. columna NO nula de `ga4_settings` — el panel viejo de GA4, o la semilla
 *      que ese panel escribía desde el env. Hay instalaciones con valores
 *      reales ahí y perderlos sería apagarles la medición en silencio.
 *   3. env → 4. default (los dos ya los resuelve `getGa4Settings`).
 */
export declare function mergeWithLegacyRow(legacy: LegacyGa4SettingsRow | undefined): Ga4ResolvedSettings;
