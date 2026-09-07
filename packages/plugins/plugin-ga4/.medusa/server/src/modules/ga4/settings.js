"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGa4Settings = getGa4Settings;
exports.mergeWithLegacyRow = mergeWithLegacyRow;
const mercatto_plugin_runtime_1 = require("@minimalart/mercatto-plugin-runtime");
const NAMESPACE = 'extension:ga4';
/**
 * Alias del env que el descriptor del host mapea a la misma key. Se replican
 * acá porque cuando no hay reader (host sin app-settings, tests) el plugin
 * hace el fallback a env por su cuenta y necesita conocer los aliases.
 */
const ENV_ALIASES = {
    GA_MEASUREMENT_ID: ['GA_MEASUREMENT_ID', 'NEXT_PUBLIC_GA_MEASUREMENT_ID'],
    GA_API_SECRET: ['GA_API_SECRET'],
    GTM_ID: ['GTM_ID', 'NEXT_PUBLIC_GTM_ID'],
    GA_DEBUG: ['GA_DEBUG'],
};
function readFromSnapshot(key) {
    const reader = (0, mercatto_plugin_runtime_1.getAppSettingsSyncReader)();
    if (!reader)
        return undefined;
    try {
        return reader(NAMESPACE, key);
    }
    catch {
        // Un reader que tira NO tiene que romper el getter: se cae al env.
        return undefined;
    }
}
function readEnvString(key) {
    for (const alias of ENV_ALIASES[key] ?? [key]) {
        const raw = process.env[alias];
        if (raw !== undefined && raw !== '')
            return raw;
    }
    return null;
}
function readString(key, fallback) {
    const fromSnapshot = readFromSnapshot(key);
    if (typeof fromSnapshot === 'string' && fromSnapshot !== '')
        return fromSnapshot;
    const fromEnv = readEnvString(key);
    return fromEnv ?? fallback;
}
function readBool(key, fallback) {
    const fromSnapshot = readFromSnapshot(key);
    if (typeof fromSnapshot === 'boolean')
        return fromSnapshot;
    const raw = process.env[ENV_ALIASES[key]?.[0] ?? key];
    if (raw === undefined)
        return fallback;
    const value = raw.trim().toLowerCase();
    if (value === '')
        return fallback;
    if (value === 'true')
        return true;
    if (value === 'false')
        return false;
    return fallback;
}
/**
 * `true` si el snapshot del host tiene una entrada explícita para esta key. Es
 * la señal de intención que necesita `mergeWithLegacyRow` para decidir quién
 * gana; el valor efectivo no alcanza, porque un valor heredado del env se ve
 * idéntico a uno guardado en `site_setting`.
 *
 * En el plugin no tenemos acceso directo a `site_setting`: si el reader del
 * runtime devuelve un valor distinto de `undefined`, asumimos que ese valor
 * vino del snapshot (guardado en el admin). El host debería devolver
 * `undefined` cuando no hay override — así lo hace `resolveSettingSync` cuando
 * no hay fila en `site_setting`, incluso si el env tiene algo.
 */
function isOverriddenInDb(key) {
    const reader = (0, mercatto_plugin_runtime_1.getAppSettingsSyncReader)();
    if (!reader)
        return false;
    try {
        return reader(NAMESPACE, key) !== undefined;
    }
    catch {
        return false;
    }
}
function getGa4Settings() {
    return {
        measurementId: readString('GA_MEASUREMENT_ID', null),
        apiSecret: readString('GA_API_SECRET', null),
        gtmId: readString('GTM_ID', null),
        debug: readBool('GA_DEBUG', false),
    };
}
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
function mergeWithLegacyRow(legacy) {
    const resolved = getGa4Settings();
    if (!legacy)
        return resolved;
    const pick = (key, legacyValue, resolvedValue) => isOverriddenInDb(key) ? resolvedValue : (legacyValue ?? resolvedValue);
    return {
        measurementId: pick('GA_MEASUREMENT_ID', legacy.measurement_id, resolved.measurementId),
        apiSecret: pick('GA_API_SECRET', legacy.api_secret, resolved.apiSecret),
        gtmId: pick('GTM_ID', legacy.gtm_id, resolved.gtmId),
        debug: pick('GA_DEBUG', legacy.debug, resolved.debug),
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2V0dGluZ3MuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy9nYTQvc2V0dGluZ3MudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7Ozs7Ozs7Ozs7OztHQWlCRzs7QUFnR0gsd0NBT0M7QUFjRCxnREFhQztBQWhJRCxpRkFBK0U7QUFvQi9FLE1BQU0sU0FBUyxHQUFHLGVBQWUsQ0FBQztBQUVsQzs7OztHQUlHO0FBQ0gsTUFBTSxXQUFXLEdBQTZCO0lBQzVDLGlCQUFpQixFQUFFLENBQUMsbUJBQW1CLEVBQUUsK0JBQStCLENBQUM7SUFDekUsYUFBYSxFQUFFLENBQUMsZUFBZSxDQUFDO0lBQ2hDLE1BQU0sRUFBRSxDQUFDLFFBQVEsRUFBRSxvQkFBb0IsQ0FBQztJQUN4QyxRQUFRLEVBQUUsQ0FBQyxVQUFVLENBQUM7Q0FDdkIsQ0FBQztBQUVGLFNBQVMsZ0JBQWdCLENBQUMsR0FBVztJQUNuQyxNQUFNLE1BQU0sR0FBRyxJQUFBLGtEQUF3QixHQUFFLENBQUM7SUFDMUMsSUFBSSxDQUFDLE1BQU07UUFBRSxPQUFPLFNBQVMsQ0FBQztJQUM5QixJQUFJLENBQUM7UUFDSCxPQUFPLE1BQU0sQ0FBQyxTQUFTLEVBQUUsR0FBRyxDQUFDLENBQUM7SUFDaEMsQ0FBQztJQUFDLE1BQU0sQ0FBQztRQUNQLG1FQUFtRTtRQUNuRSxPQUFPLFNBQVMsQ0FBQztJQUNuQixDQUFDO0FBQ0gsQ0FBQztBQUVELFNBQVMsYUFBYSxDQUFDLEdBQVc7SUFDaEMsS0FBSyxNQUFNLEtBQUssSUFBSSxXQUFXLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDO1FBQzlDLE1BQU0sR0FBRyxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDL0IsSUFBSSxHQUFHLEtBQUssU0FBUyxJQUFJLEdBQUcsS0FBSyxFQUFFO1lBQUUsT0FBTyxHQUFHLENBQUM7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