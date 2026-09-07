"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_WSAA_SERVICE = exports.SAFE_ARCA_ENVIRONMENT = exports.ARCA_SETTINGS_NAMESPACE = void 0;
exports.normalizeEnvironment = normalizeEnvironment;
exports.getArcaSettings = getArcaSettings;
exports.loadArcaSettingsViaPg = loadArcaSettingsViaPg;
/** ARCA CUIT lookups use the global Minimalart account from the host. */
const mercatto_plugin_runtime_1 = require("@minimalart/mercatto-plugin-runtime");
const types_1 = require("./types");
exports.ARCA_SETTINGS_NAMESPACE = 'extension:fiscal-documentation';
/**
 * El entorno SEGURO. Es el piso cuando ninguna capa aportó valor. Homologación
 * a propósito: un default productivo emitiría comprobantes de verdad ante el
 * primer llamado que apunte a `wsfe`.
 */
exports.SAFE_ARCA_ENVIRONMENT = 'homologacion';
/** El único servicio WSAA que este módulo sabe consumir. */
exports.DEFAULT_WSAA_SERVICE = 'ws_sr_constancia_inscripcion';
function readTrimmed(key) {
    const raw = (0, mercatto_plugin_runtime_1.getAppSettingsSyncReader)()?.('extension:fiscal-documentation', key) ?? process.env[key];
    return typeof raw === 'string' ? raw.trim() : '';
}
/**
 * Traduce lo que sea que haya en el entorno a uno de los dos entornos.
 *
 * FAIL-SAFE: cualquier cosa que no sea exactamente `production` cae en
 * homologación. Acepta `homologación` con tilde porque es como se escribe en
 * castellano.
 */
function normalizeEnvironment(raw) {
    const value = String(raw ?? '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '');
    return value === 'production' ? 'production' : exports.SAFE_ARCA_ENVIRONMENT;
}
function buildSettings(read = readTrimmed) {
    const environment = normalizeEnvironment(read('ARCA_ENVIRONMENT'));
    return {
        // Sólo dígitos, igual que hacía el loader viejo.
        cuitRepresentada: read('ARCA_CUIT_REPRESENTADA').replace(/\D/g, ''),
        environment,
        service: read('ARCA_WSAA_SERVICE') || exports.DEFAULT_WSAA_SERVICE,
        urls: types_1.ARCA_URLS[environment],
        certificateBase64: read('ARCA_CERTIFICATE_BASE64'),
        privateKeyBase64: read('ARCA_PRIVATE_KEY_BASE64'),
    };
}
/** Instance settings for callers without a store. */
function getArcaSettings() {
    return buildSettings();
}
/** Global Minimalart account, independent of the queried company and active store. */
async function loadArcaSettingsViaPg(pg, _resolution) {
    const reader = (0, mercatto_plugin_runtime_1.getExternalReader)(mercatto_plugin_runtime_1.EXTERNAL_KEYS.APP_SETTINGS_VIA_PG)?.();
    if (!reader)
        return getArcaSettings();
    const values = await reader('extension:fiscal-documentation', pg);
    if (!values)
        return getArcaSettings();
    // Missing scoped values stay empty: do not resurrect an instance credential.
    return buildSettings((key) => typeof values[key] === 'string' ? values[key].trim() : '');
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2V0dGluZ3MuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvbGliL2FyY2Evc2V0dGluZ3MudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBc0RBLG9EQU9DO0FBZ0JELDBDQUVDO0FBU0Qsc0RBWUM7QUFwR0QseUVBQXlFO0FBQ3pFLGlGQUk2QztBQUU3QyxtQ0FBMEQ7QUFFN0MsUUFBQSx1QkFBdUIsR0FBRyxnQ0FBZ0MsQ0FBQztBQUV4RTs7OztHQUlHO0FBQ1UsUUFBQSxxQkFBcUIsR0FBb0IsY0FBYyxDQUFDO0FBRXJFLDREQUE0RDtBQUMvQyxRQUFBLG9CQUFvQixHQUFHLDhCQUE4QixDQUFDO0FBc0JuRSxTQUFTLFdBQVcsQ0FBQyxHQUFXO0lBQzlCLE1BQU0sR0FBRyxHQUNQLElBQUEsa0RBQXdCLEdBQUUsRUFBRSxDQUFDLGdDQUFnQyxFQUFFLEdBQUcsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDMUYsT0FBTyxPQUFPLEdBQUcsS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO0FBQ25ELENBQUM7QUFFRDs7Ozs7O0dBTUc7QUFDSCxTQUFnQixvQkFBb0IsQ0FBQyxHQUE4QjtJQUNqRSxNQUFNLEtBQUssR0FBRyxNQUFNLENBQUMsR0FBRyxJQUFJLEVBQUUsQ0FBQztTQUM1QixJQUFJLEVBQUU7U0FDTixXQUFXLEVBQUU7U0FDYixTQUFTLENBQUMsS0FBSyxDQUFDO1NBQ2hCLE9BQU8sQ0FBQyxRQUFRLEVBQUUsRUFBRSxDQUFDLENBQUM7SUFDekIsT0FBTyxLQUFLLEtBQUssWUFBWSxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLDZCQUFxQixDQUFDO0FBQ3ZFLENBQUM7QUFFRCxTQUFTLGFBQWEsQ0FBQyxJQUFJLEdBQUcsV0FBVztJQUN2QyxNQUFNLFdBQVcsR0FBRyxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDO0lBQ25FLE9BQU87UUFDTCxpREFBaUQ7UUFDakQsZ0JBQWdCLEVBQUUsSUFBSSxDQUFDLHdCQUF3QixDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUM7UUFDbkUsV0FBVztRQUNYLE9BQU8sRUFBRSxJQUFJLENBQUMsbUJBQW1CLENBQUMsSUFBSSw0QkFBb0I7UUFDMUQsSUFBSSxFQUFFLGlCQUFTLENBQUMsV0FBVyxDQUFDO1FBQzVCLGlCQUFpQixFQUFFLElBQUksQ0FBQyx5QkFBeUIsQ0FBQztRQUNsRCxnQkFBZ0IsRUFBRSxJQUFJLENBQUMseUJBQXlCLENBQUM7S0FDbEQsQ0FBQztBQUNKLENBQUM7QUFFRCxxREFBcUQ7QUFDckQsU0FBZ0IsZUFBZTtJQUM3QixPQUFPLGFBQWEsRUFBRSxDQUFDO0FBQ3pCLENBQUM7QUFRRCxzRkFBc0Y7QUFDL0UsS0FBSyxVQUFVLHFCQUFxQixDQUN6QyxFQUErQixFQUMvQixXQUE0QjtJQUU1QixNQUFNLE1BQU0sR0FBRyxJQUFBLDJDQUFpQixFQUFlLHVDQUFhLENBQUMsbUJBQW1CLENBQUMsRUFBRSxFQUFFLENBQUM7SUFDdEYsSUFBSSxDQUFDLE1BQU07UUFBRSxPQUFPLGVBQWUsRUFBRSxDQUFDO0lBQ3RDLE1BQU0sTUFBTSxHQUFHLE1BQU0sTUFBTSxDQUFDLGdDQUFnQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO0lBQ2xFLElBQUksQ0FBQyxNQUFNO1FBQUUsT0FBTyxlQUFlLEVBQUUsQ0FBQztJQUN0Qyw2RUFBNkU7SUFDN0UsT0FBTyxhQUFhLENBQUMsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUMzQixPQUFPLE1BQU0sQ0FBQyxHQUFHLENBQUMsS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFFLE1BQU0sQ0FBQyxHQUFHLENBQVksQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUN0RSxDQUFDO0FBQ0osQ0FBQyJ9