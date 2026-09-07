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
export type VimeoSettings = {
    /** A dónde redirige el callback de OAuth cuando la conexión sale bien. */
    oauthRedirectSuccess: string;
};
export declare function getVimeoSettings(): VimeoSettings;
