"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const mercatto_plugin_runtime_1 = require("@minimalart/mercatto-plugin-runtime");
const settings_1 = require("./settings");
/**
 * En el plugin la resolución es **snapshot > env > default**. La capa de
 * snapshot vive en el host (`app-settings`) y el plugin la recibe vía
 * `@minimalart/mercatto-plugin-runtime`. Estos tests ejercitan la ruta con
 * el reader conectado (registramos un mock en el runtime) y el fallback puro
 * a env cuando el registry está vacío. La capa de base necesita Postgres y
 * vive en el host, así que no se testea acá.
 */
const ENV_KEYS = [
    'GA_MEASUREMENT_ID',
    'NEXT_PUBLIC_GA_MEASUREMENT_ID',
    'GA_API_SECRET',
    'GTM_ID',
    'NEXT_PUBLIC_GTM_ID',
    'GA_DEBUG',
];
const saved = {};
(0, node_test_1.beforeEach)(() => {
    for (const key of ENV_KEYS) {
        saved[key] = process.env[key];
        delete process.env[key];
    }
    (0, mercatto_plugin_runtime_1.registerAppSettingsSyncReader)(null);
});
(0, node_test_1.afterEach)(() => {
    for (const key of ENV_KEYS) {
        if (saved[key] === undefined)
            delete process.env[key];
        else
            process.env[key] = saved[key];
    }
    (0, mercatto_plugin_runtime_1.registerAppSettingsSyncReader)(null);
});
function withReader(map) {
    (0, mercatto_plugin_runtime_1.registerAppSettingsSyncReader)((namespace, key) => {
        strict_1.default.equal(namespace, 'extension:ga4');
        return map[key];
    });
}
(0, node_test_1.test)('sin nada configurado cae a los defaults', () => {
    strict_1.default.deepEqual((0, settings_1.getGa4Settings)(), {
        measurementId: null,
        apiSecret: null,
        gtmId: null,
        debug: false,
    });
});
(0, node_test_1.test)('el alias NEXT_PUBLIC_ actúa de fallback, no de reemplazo', () => {
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = 'G-PUBLICO';
    strict_1.default.equal((0, settings_1.getGa4Settings)().measurementId, 'G-PUBLICO');
    process.env.GA_MEASUREMENT_ID = 'G-BACKEND';
    strict_1.default.equal((0, settings_1.getGa4Settings)().measurementId, 'G-BACKEND');
});
(0, node_test_1.test)('GA_DEBUG solo es true con el string "true"', () => {
    process.env.GA_DEBUG = 'false';
    strict_1.default.equal((0, settings_1.getGa4Settings)().debug, false);
    process.env.GA_DEBUG = 'true';
    strict_1.default.equal((0, settings_1.getGa4Settings)().debug, true);
});
(0, node_test_1.test)('el snapshot del host le gana al env cuando el bridge está conectado', () => {
    process.env.GA_MEASUREMENT_ID = 'G-DELENV';
    withReader({ GA_MEASUREMENT_ID: 'G-DELADMIN' });
    strict_1.default.equal((0, settings_1.getGa4Settings)().measurementId, 'G-DELADMIN');
});
(0, node_test_1.test)('cuando el reader devuelve undefined para una key, se cae al env', () => {
    process.env.GA_MEASUREMENT_ID = 'G-DELENV';
    withReader({ GA_API_SECRET: 'secret-del-admin' });
    const settings = (0, settings_1.getGa4Settings)();
    strict_1.default.equal(settings.measurementId, 'G-DELENV');
    strict_1.default.equal(settings.apiSecret, 'secret-del-admin');
});
(0, node_test_1.test)('un reader que tira NO rompe el getter: se cae al env sin propagar el error', () => {
    process.env.GA_MEASUREMENT_ID = 'G-DELENV';
    (0, mercatto_plugin_runtime_1.registerAppSettingsSyncReader)(() => {
        throw new Error('snapshot no está listo');
    });
    strict_1.default.equal((0, settings_1.getGa4Settings)().measurementId, 'G-DELENV');
});
(0, node_test_1.test)('la fila legacy le gana al env pero pierde contra el snapshot', () => {
    process.env.GA_MEASUREMENT_ID = 'G-DELENV';
    process.env.GTM_ID = 'GTM-DELENV';
    // Sin reader, manda la legacy sobre el env.
    let merged = (0, settings_1.mergeWithLegacyRow)({ measurement_id: 'G-LEGACY', gtm_id: 'GTM-LEGACY' });
    strict_1.default.equal(merged.measurementId, 'G-LEGACY');
    strict_1.default.equal(merged.gtmId, 'GTM-LEGACY');
    // Con snapshot para una sola key, esa key cambia y la otra no.
    withReader({ GA_MEASUREMENT_ID: 'G-DELADMIN' });
    merged = (0, settings_1.mergeWithLegacyRow)({ measurement_id: 'G-LEGACY', gtm_id: 'GTM-LEGACY' });
    strict_1.default.equal(merged.measurementId, 'G-DELADMIN');
    strict_1.default.equal(merged.gtmId, 'GTM-LEGACY');
});
(0, node_test_1.test)('una columna legacy en NULL no congela el env: cae al valor heredado', () => {
    process.env.GA_MEASUREMENT_ID = 'G-DELENV';
    const merged = (0, settings_1.mergeWithLegacyRow)({ measurement_id: null, api_secret: null, gtm_id: null });
    strict_1.default.equal(merged.measurementId, 'G-DELENV');
});
(0, node_test_1.test)('sin reader registrado, el getter usa el env directamente (host sin app-settings)', () => {
    process.env.GA_MEASUREMENT_ID = 'G-DELENV';
    (0, mercatto_plugin_runtime_1.registerAppSettingsSyncReader)(null);
    strict_1.default.equal((0, settings_1.getGa4Settings)().measurementId, 'G-DELENV');
    strict_1.default.equal((0, settings_1.mergeWithLegacyRow)({ measurement_id: 'G-LEGACY' }).measurementId, 'G-LEGACY');
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2V0dGluZ3MudGVzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL2dhNC9zZXR0aW5ncy50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEseUNBQXdEO0FBQ3hELGdFQUF3QztBQUN4QyxpRkFBb0Y7QUFDcEYseUNBQWdFO0FBRWhFOzs7Ozs7O0dBT0c7QUFFSCxNQUFNLFFBQVEsR0FBRztJQUNmLG1CQUFtQjtJQUNuQiwrQkFBK0I7SUFDL0IsZUFBZTtJQUNmLFFBQVE7SUFDUixvQkFBb0I7SUFDcEIsVUFBVTtDQUNGLENBQUM7QUFFWCxNQUFNLEtBQUssR0FBdUMsRUFBRSxDQUFDO0FBRXJELElBQUEsc0JBQVUsRUFBQyxHQUFHLEVBQUU7SUFDZCxLQUFLLE1BQU0sR0FBRyxJQUFJLFFBQVEsRUFBRSxDQUFDO1FBQzNCLEtBQUssQ0FBQyxHQUFHLENBQUMsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQzlCLE9BQU8sT0FBTyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUMxQixDQUFDO0lBQ0QsSUFBQSx1REFBNkIsRUFBQyxJQUFJLENBQUMsQ0FBQztBQUN0QyxDQUFDLENBQUMsQ0FBQztBQUVILElBQUEscUJBQVMsRUFBQyxHQUFHLEVBQUU7SUFDYixLQUFLLE1BQU0sR0FBRyxJQUFJLFFBQVEsRUFBRSxDQUFDO1FBQzNCLElBQUksS0FBSyxDQUFDLEdBQUcsQ0FBQyxLQUFLLFNBQVM7WUFBRSxPQUFPLE9BQU8sQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7O1lBQ2pELE9BQU8sQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ3JDLENBQUM7SUFDRCxJQUFBLHVEQUE2QixFQUFDLElBQUksQ0FBQyxDQUFDO0FBQ3RDLENBQUMsQ0FBQyxDQUFDO0FBRUgsU0FBUyxV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