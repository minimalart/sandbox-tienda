"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decodePemMaterial = decodePemMaterial;
exports.toArcaConfig = toArcaConfig;
exports.isArcaConfigured = isArcaConfigured;
exports.getArcaConfig = getArcaConfig;
exports.arcaPgFrom = arcaPgFrom;
exports.loadArcaConfigViaPg = loadArcaConfigViaPg;
exports.getArcaConfigForSite = getArcaConfigForSite;
exports.describeArcaSettings = describeArcaSettings;
exports.loadArcaStatusViaPg = loadArcaStatusViaPg;
const fs_1 = require("fs");
const utils_1 = require("@medusajs/framework/utils");
const settings_1 = require("./settings");
const types_1 = require("./types");
/* -------------------------------------------------------------------------- */
/* Normalización del PEM                                                       */
/* -------------------------------------------------------------------------- */
/**
 * Convierte lo que haya en la capa de base64 a un PEM.
 *
 * Acepta las TRES formas que aparecen en producción, y no es tolerancia gratuita:
 *
 *  - base64 de un PEM, que es lo que sugiere la documentación de AFIP;
 *  - el PEM crudo multilínea, porque DO App Platform guarda el valor tal cual y
 *    exigir base64 sólo suma fricción (caso real de prod);
 *  - el PEM crudo con los saltos escapados como `\n`, que es lo que queda cuando el
 *    valor pasó por un JSON o por un input de una sola línea.
 *
 * Devuelve `null` cuando la capa no aportó nada, para que el caller siga bajando en
 * la precedencia. Sólo TIRA cuando SÍ había algo y no era un PEM: eso no es "falta
 * configuración" sino una configuración rota, y seguir de largo hacia el disco
 * escondería el problema real detrás de un error que nombra otra variable.
 */
function decodePemMaterial(raw, label, sourceName) {
    const inline = String(raw ?? '').trim();
    if (!inline)
        return null;
    if (inline.includes('-----BEGIN')) {
        return inline.replace(/\\n/g, '\n').trim();
    }
    const pem = Buffer.from(inline, 'base64').toString('utf8').trim();
    if (!pem.includes('-----BEGIN')) {
        throw new types_1.ArcaConfigError(`${sourceName} no contiene ${label} válido (ni PEM crudo ni base64 de un PEM).`);
    }
    return pem;
}
/**
 * Escalón 4: el PEM desde un archivo del contenedor.
 *
 * El `process.env` es DIRECTO y no dinámico (`process.env[nombre]`) a propósito. El
 * acceso dinámico del loader viejo era invisible para todo grep del repo —por eso
 * estas 7 variables no aparecían en ningún inventario— y `env-coverage.test.ts` tuvo
 * que agregar una heurística entera (cosechar literales UPPER_SNAKE de los archivos
 * con corchete dinámico) sólo para atraparlas. Con el acceso directo, las dos únicas
 * env que este módulo sigue leyendo a mano se ven de lejos.
 */
function pemFromLegacyPath(path, label, pathVar) {
    const trimmed = path?.trim();
    if (!trimmed)
        return null;
    try {
        return (0, fs_1.readFileSync)(trimmed, 'utf8').trim();
    }
    catch {
        // El mensaje nombra la VARIABLE, nunca la ruta: un path filtra la estructura
        // del contenedor y no ayuda a diagnosticar más que el nombre.
        throw new types_1.ArcaConfigError(`No se pudo leer ${label} desde ${pathVar}.`);
    }
}
/**
 * El par ya materializado, aplicando los escalones 3 y 4 sobre lo que resolvieron
 * el 1 y el 2.
 *
 * Los dos `process.env.*_PATH` se leen ACÁ y no en `settings.ts` porque son
 * `envOnly`: no tienen descriptor, así que `app-settings` no los resuelve. Que la
 * única lectura de entorno cruda que le queda al módulo sea la de los dos paths
 * legacy es exactamente el estado que esta migración persigue.
 */
function materializePair(settings) {
    const certificatePem = decodePemMaterial(settings.certificateBase64, 'un certificado X.509', 'ARCA_CERTIFICATE_BASE64') ??
        pemFromLegacyPath(process.env.ARCA_CERTIFICATE_PATH, 'el certificado X.509', 'ARCA_CERTIFICATE_PATH');
    const privateKeyPem = decodePemMaterial(settings.privateKeyBase64, 'una clave privada', 'ARCA_PRIVATE_KEY_BASE64') ??
        pemFromLegacyPath(process.env.ARCA_PRIVATE_KEY_PATH, 'la clave privada', 'ARCA_PRIVATE_KEY_PATH');
    if (!certificatePem) {
        throw new types_1.ArcaConfigError('Falta el certificado X.509 de ARCA (cargalo en la pantalla de credenciales de la ' +
            'tienda, en ARCA_CERTIFICATE_BASE64, o dejá ARCA_CERTIFICATE_PATH en el entorno).');
    }
    if (!privateKeyPem) {
        throw new types_1.ArcaConfigError('Falta la clave privada de ARCA (cargala en la pantalla de credenciales de la ' +
            'tienda, en ARCA_PRIVATE_KEY_BASE64, o dejá ARCA_PRIVATE_KEY_PATH en el entorno).');
    }
    return { certificatePem, privateKeyPem };
}
/**
 * De la configuración resuelta a la config lista para firmar. Función PURA salvo por
 * los dos paths legacy, así que se puede testear sin base ni contenedor.
 *
 * El CUIT se valida ANTES que el par y con mensaje propio: sin CUIT no hay a quién
 * representar, y para una tienda secundaria apagada por fail-closed éste es el error
 * que la explica. La alternativa —dejarlo pasar y que WSAA rechace el login—
 * convierte un problema de configuración en un 424 opaco.
 */
function toArcaConfig(settings) {
    if (settings.cuitRepresentada.length !== 11) {
        throw new types_1.ArcaConfigError('Falta el CUIT de Minimalart (11 dígitos) en Integraciones → Globales → ARCA / AFIP.');
    }
    return {
        cuitRepresentada: settings.cuitRepresentada,
        ...materializePair(settings),
        environment: settings.environment,
        service: settings.service,
        urls: settings.urls,
    };
}
/* -------------------------------------------------------------------------- */
/* Camino SINCRÓNICO: configuración de la INSTANCIA                            */
/* -------------------------------------------------------------------------- */
/**
 * Hay con qué intentar una consulta a nivel INSTANCIA.
 *
 * Es un diagnóstico, no una guarda: dice "el backend tiene cargadas las piezas", no
 * "esta tienda puede consultar". Una tienda secundaria puede dar `true` acá y fallar
 * igual por fail-closed, que es lo correcto — la respuesta verdadera para una tienda
 * sólo la puede dar el camino async.
 */
function isArcaConfigured() {
    const settings = (0, settings_1.getArcaSettings)();
    return (settings.cuitRepresentada.length === 11 &&
        (Boolean(settings.certificateBase64) || Boolean(process.env.ARCA_CERTIFICATE_PATH?.trim())) &&
        (Boolean(settings.privateKeyBase64) || Boolean(process.env.ARCA_PRIVATE_KEY_PATH?.trim())));
}
/** Config de la INSTANCIA. Tira `ArcaConfigError` si falta alguna pieza. */
function getArcaConfig() {
    return toArcaConfig((0, settings_1.getArcaSettings)());
}
/** `PG_CONNECTION` del contenedor, o `undefined`. */
function arcaPgFrom(container) {
    try {
        return container.resolve(utils_1.ContainerRegistrationKeys.PG_CONNECTION);
    }
    catch {
        return undefined;
    }
}
/** All callers use Minimalart's global CUIT lookup account. Legacy site hints
 * remain in the signature for compatibility, but never select credentials. */
async function loadArcaConfigViaPg(pg, _hint, _logger) {
    return { config: toArcaConfig(await (0, settings_1.loadArcaSettingsViaPg)(pg)) };
}
/** Atajo para los call sites que tienen el contenedor completo. */
async function getArcaConfigForSite(container, hint, logger) {
    return (await loadArcaConfigViaPg(arcaPgFrom(container), hint, logger)).config;
}
/**
 * Estado de la config, SIN material sensible y sin tirar.
 *
 * No reusa `toArcaConfig` porque ése corta ante la primera pieza faltante, y lo que
 * la card necesita mostrar es justamente CUÁL falta.
 *
 * Recibe los settings EFECTIVOS —o sea, ya con `site_credential` aplicado encima— y
 * no los crudos. Con los crudos, una tienda que cargó su certificado por la pantalla
 * de credenciales vería "Falta certificado" en la card mientras opera perfecto: una
 * card que miente sobre credenciales es peor que no tenerla, porque induce a cargar
 * de nuevo un secreto que ya estaba.
 *
 * Los booleanos son lo ÚNICO que sale del backend sobre un certificado. Ni siquiera
 * una "cola de cuatro" como la de los secretos de `app-settings`: el final de un PEM
 * en base64 es idéntico en todos, así que no distingue nada, y serían bytes de una
 * clave privada viajando por HTTP para nada.
 */
function describeArcaSettings(settings, siteId = null, credentialsSource = 'instance') {
    const certPath = Boolean(process.env.ARCA_CERTIFICATE_PATH?.trim());
    const keyPath = Boolean(process.env.ARCA_PRIVATE_KEY_PATH?.trim());
    return {
        environment: settings.environment,
        service: settings.service,
        cuit_present: settings.cuitRepresentada.length === 11,
        certificate_present: Boolean(settings.certificateBase64) || certPath,
        private_key_present: Boolean(settings.privateKeyBase64) || keyPath,
        uses_legacy_path: (!settings.certificateBase64 && certPath) || (!settings.privateKeyBase64 && keyPath),
        credentials_source: credentialsSource,
        site_id: siteId,
    };
}
/** Status reports the same global account used by every lookup. */
async function loadArcaStatusViaPg(pg, _hint) {
    return describeArcaSettings(await (0, settings_1.loadArcaSettingsViaPg)(pg));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uZmlnLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL2xpYi9hcmNhL2NvbmZpZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQStDQSw4Q0FtQkM7QUFxRkQsb0NBYUM7QUFjRCw0Q0FPQztBQUdELHNDQUVDO0FBa0JELGdDQU1DO0FBSUQsa0RBTUM7QUFHRCxvREFNQztBQWdERCxvREFrQkM7QUFHRCxrREFLQztBQW5URCwyQkFBa0M7QUFDbEMscURBQXNFO0FBR3RFLHlDQUtvQjtBQUNwQixtQ0FBZ0U7QUFpQmhFLGdGQUFnRjtBQUNoRixpRkFBaUY7QUFDakYsZ0ZBQWdGO0FBRWhGOzs7Ozs7Ozs7Ozs7Ozs7R0FlRztBQUNILFNBQWdCLGlCQUFpQixDQUMvQixHQUE4QixFQUM5QixLQUFhLEVBQ2IsVUFBa0I7SUFFbEIsTUFBTSxNQUFNLEdBQUcsTUFBTSxDQUFDLEdBQUcsSUFBSSxFQUFFLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQztJQUN4QyxJQUFJLENBQUMsTUFBTTtRQUFFLE9BQU8sSUFBSSxDQUFDO0lBRXpCLElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQyxZQUFZLENBQUMsRUFBRSxDQUFDO1FBQ2xDLE9BQU8sTUFBTSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUM7SUFDN0MsQ0FBQztJQUVELE1BQU0sR0FBRyxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLFFBQVEsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQztJQUNsRSxJQUFJLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxZQUFZLENBQUMsRUFBRSxDQUFDO1FBQ2hDLE1BQU0sSUFBSSx1QkFBZSxDQUN2QixHQUFHLFVBQVUsZ0JBQWdCLEtBQUssNkNBQTZDLENBQ2hGLENBQUM7SUFDSixDQUFDO0lBQ0QsT0FBTyxHQUFHLENB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