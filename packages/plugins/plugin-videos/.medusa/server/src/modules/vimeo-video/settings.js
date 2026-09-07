"use strict";
/**
 * Configuración efectiva de Videos que NO es opción de boot del módulo.
 *
 * Hoy es una sola clave (`VIMEO_OAUTH_REDIRECT_SUCCESS`). Se resuelve con la
 * precedencia **snapshot > env > default**.
 *
 * La capa de snapshot vive en el host (`app-settings`) y el plugin la recibe
 * vía `@minimalart/mercatto-plugin-runtime`: el host registra su
 * `resolveSettingSync` envuelto una sola vez al arrancar, y este archivo lo
 * lee vía `getAppSettingsSyncReader`.
 *
 * Es SINCRÓNICA a propósito. El consumidor original era un `const` de nivel
 * superior en `api/admin/vimeo/oauth/callback/route.ts` (ahora una función,
 * porque el destino puede cambiar en runtime al escribirse la card del admin,
 * pero la firma pública se mantiene sync).
 *
 * Cuando el host no registró un reader —proyecto sin `app-settings`, tests,
 * boot antes del bridge— se cae a `process.env`. Es la MISMA semántica que la
 * extensión original tenía "antes de que el loader llene el snapshot".
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVimeoSettings = getVimeoSettings;
const mercatto_plugin_runtime_1 = require("@minimalart/mercatto-plugin-runtime");
const NAMESPACE = 'extension:videos';
const DEFAULTS = {
    oauthRedirectSuccess: '/app/videos',
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
function readString(key, fallback) {
    const fromSnapshot = readFromSnapshot(key);
    if (typeof fromSnapshot === 'string' && fromSnapshot.trim() !== '') {
        return fromSnapshot;
    }
    const fromEnv = process.env[key];
    if (typeof fromEnv === 'string' && fromEnv.trim() !== '') {
        return fromEnv;
    }
    return fallback;
}
function getVimeoSettings() {
    return {
        oauthRedirectSuccess: readString('VIMEO_OAUTH_REDIRECT_SUCCESS', DEFAULTS.oauthRedirectSuccess),
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2V0dGluZ3MuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy92aW1lby12aWRlby9zZXR0aW5ncy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7R0FtQkc7O0FBc0NILDRDQU9DO0FBM0NELGlGQUErRTtBQU8vRSxNQUFNLFNBQVMsR0FBRyxrQkFBa0IsQ0FBQztBQUVyQyxNQUFNLFFBQVEsR0FBa0I7SUFDOUIsb0JBQW9CLEVBQUUsYUFBYTtDQUNwQyxDQUFDO0FBRUYsU0FBUyxnQkFBZ0IsQ0FBQyxHQUFXO0lBQ25DLE1BQU0sTUFBTSxHQUFHLElBQUEsa0RBQXdCLEdBQUUsQ0FBQztJQUMxQyxJQUFJLENBQUMsTUFBTTtRQUFFLE9BQU8sU0FBUyxDQUFDO0lBQzlCLElBQUksQ0FBQztRQUNILE9BQU8sTUFBTSxDQUFDLFNBQVMsRUFBRSxHQUFHLENBQUMsQ0FBQztJQUNoQyxDQUFDO0lBQUMsTUFBTSxDQUFDO1FBQ1AsbUVBQW1FO1FBQ25FLE9BQU8sU0FBUyxDQUFDO0lBQ25CLENBQUM7QUFDSCxDQUFDO0FBRUQsU0FBUyxVQUFVLENBQUMsR0FBVyxFQUFFLFFBQWdCO0lBQy9DLE1BQU0sWUFBWSxHQUFHLGdCQUFnQixDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQzNDLElBQUksT0FBTyxZQUFZLEtBQUssUUFBUSxJQUFJLFlBQVksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLEVBQUUsQ0FBQztRQUNuRSxPQUFPLFlBQVksQ0FBQztJQUN0QixDQUFDO0lBQ0QsTUFBTSxPQUFPLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUNqQyxJQUFJLE9BQU8sT0FBTyxLQUFLLFFBQVEsSUFBSSxPQUFPLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxFQUFFLENBQUM7UUFDekQsT0FBTyxPQUFPLENBQUM7SUFDakIsQ0FBQztJQUNELE9BQU8sUUFBUSxDQUFDO0FBQ2xCLENBQUM7QUFFRCxTQUFnQixnQkFBZ0I7SUFDOUIsT0FBTztRQUNMLG9CQUFvQixFQUFFLFVBQVUsQ0FDOUIsOEJBQThCLEVBQzlCLFFBQVEsQ0FBQyxvQkFBb0IsQ0FDOUI7S0FDRixDQUFDO0FBQ0osQ0FBQyJ9