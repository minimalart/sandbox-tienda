"use strict";
/**
 * Configuración efectiva de carritos abandonados en el plugin.
 *
 * La precedencia es **snapshot > env > default**, IGUAL que la extensión
 * original. La diferencia es que el snapshot vive en el host (`app-settings`)
 * y el plugin no lo puede importar directamente. La coordinación pasa por
 * `@minimalart/mercatto-plugin-runtime`: el host registra su `resolveSettingSync`
 * envuelto una sola vez al arrancar, y este archivo lo lee vía `getAppSettingsSyncReader`.
 *
 * Cuando el host no registró un reader —proyecto sin `app-settings`, tests,
 * boot antes del bridge— se cae a `process.env`. Es la MISMA semántica que la
 * extensión original tenía "antes de que el loader llene el snapshot".
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderedStepHours = orderedStepHours;
exports.getAbandonedCartSettings = getAbandonedCartSettings;
const mercatto_plugin_runtime_1 = require("@minimalart/mercatto-plugin-runtime");
const NAMESPACE = 'extension:abandoned-cart';
function readFromSnapshot(key) {
    const reader = (0, mercatto_plugin_runtime_1.getAppSettingsSyncReader)();
    if (!reader)
        return undefined;
    try {
        return reader(NAMESPACE, key);
    }
    catch {
        // Un reader que tira NO tiene que romper el barrido: se cae al env.
        // El host puede estar refrescando el snapshot, o el descriptor puede haber
        // cambiado entre versiones — cualquiera de esos casos vuelve a env.
        return undefined;
    }
}
function readEnvBool(key, fallback) {
    const raw = process.env[key];
    if (raw === undefined)
        return fallback;
    const value = raw.trim().toLowerCase();
    if (value === '')
        return fallback;
    if (value === 'true' || value === '1')
        return true;
    if (value === 'false' || value === '0')
        return false;
    return fallback;
}
function readBool(key, fallback) {
    const fromSnapshot = readFromSnapshot(key);
    if (typeof fromSnapshot === 'boolean')
        return fromSnapshot;
    return readEnvBool(key, fallback);
}
/**
 * Igual que `readEnvNumber`, pero exige un número POSITIVO.
 *
 * Sin este guard, un `ABANDONED_CART_BATCH_SIZE=0` heredado apagaría el barrido
 * sin un solo error: la paginación iría de a cero carritos por página, para
 * siempre y en silencio.
 */
function readPositive(key, fallback) {
    const fromSnapshot = readFromSnapshot(key);
    if (fromSnapshot !== undefined && fromSnapshot !== null) {
        const num = Number(fromSnapshot);
        if (Number.isFinite(num) && num > 0)
            return num;
    }
    const raw = process.env[key];
    if (raw === undefined || raw.trim() === '')
        return fallback;
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : fallback;
}
/**
 * Fuerza que la secuencia sea NO DECRECIENTE, arrastrando cada paso hasta el
 * anterior si viene antes.
 *
 * Por qué CLAMP y no `sort()`: los pasos no son intercambiables. El 2 es el
 * único que manda WhatsApp y el 3 es el del incentivo, así que ordenar los
 * VALORES reasigna el contenido a otro momento — alguien que puso el paso 2 en
 * 2h por error terminaría mandando el mail del descuento antes que el primer
 * recordatorio. El clamp sólo DEMORA: nunca cambia qué mail va en qué posición.
 */
function clampUp(floor, value) {
    const hours = Number.isFinite(value) && value > 0 ? value : floor;
    return Math.max(hours, floor);
}
function orderedStepHours(raw) {
    const out = [];
    let floor = 0;
    for (const value of raw) {
        floor = clampUp(floor, value);
        out.push(floor);
    }
    return out;
}
function getAbandonedCartSettings() {
    const step1 = readPositive('ABANDONED_CART_STEP1_HOURS', 1);
    const step2 = clampUp(step1, readPositive('ABANDONED_CART_STEP2_HOURS', 24));
    const step3 = clampUp(step2, readPositive('ABANDONED_CART_STEP3_HOURS', 72));
    return {
        enabled: readBool('ABANDONED_CART_ENABLED', true),
        stepHours: [step1, step2, step3],
        maxAgeHours: readPositive('ABANDONED_CART_MAX_AGE_HOURS', 24 * 14),
        batchSize: readPositive('ABANDONED_CART_BATCH_SIZE', 100),
        maxPages: readPositive('ABANDONED_CART_MAX_PAGES', 20),
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2V0dGluZ3MuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy9hYmFuZG9uZWQtY2FydC9zZXR0aW5ncy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7Ozs7OztHQVlHOztBQXFGSCw0Q0FRQztBQUVELDREQVlDO0FBekdELGlGQUErRTtBQWtCL0UsTUFBTSxTQUFTLEdBQUcsMEJBQTBCLENBQUM7QUFFN0MsU0FBUyxnQkFBZ0IsQ0FBQyxHQUFXO0lBQ25DLE1BQU0sTUFBTSxHQUFHLElBQUEsa0RBQXdCLEdBQUUsQ0FBQztJQUMxQyxJQUFJLENBQUMsTUFBTTtRQUFFLE9BQU8sU0FBUyxDQUFDO0lBQzlCLElBQUksQ0FBQztRQUNILE9BQU8sTUFBTSxDQUFDLFNBQVMsRUFBRSxHQUFHLENBQUMsQ0FBQztJQUNoQyxDQUFDO0lBQUMsTUFBTSxDQUFDO1FBQ1Asb0VBQW9FO1FBQ3BFLDJFQUEyRTtRQUMzRSxvRUFBb0U7UUFDcEUsT0FBTyxTQUFTLENBQUM7SUFDbkIsQ0FBQztBQUNILENBQUM7QUFFRCxTQUFTLFdBQVcsQ0FBQyxHQUFXLEVBQUUsUUFBaUI7SUFDakQsTUFBTSxHQUFHLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUM3QixJQUFJLEdBQUcsS0FBSyxTQUFTO1FBQUUsT0FBTyxRQUFRLENBQUM7SUFDdkMsTUFBTSxLQUFLLEdBQUcsR0FBRyxDQUFDLElBQUksRUFBRSxDQUFDLFdBQVcsRUFBRSxDQUFDO0lBQ3ZDLElBQUksS0FBSyxLQUFLLEVBQUU7UUFBRSxPQUFPLFFBQVEsQ0FBQztJQUNsQyxJQUFJLEtBQUssS0FBSyxNQUFNLElBQUksS0FBSyxLQUFLLEdBQUc7UUFBRSxPQUFPLElBQUksQ0FBQztJQUNuRCxJQUFJLEtBQUssS0FBSyxPQUFPLElBQUksS0FBSyxLQUFLLEdBQUc7UUFBRSxPQUFPLEtBQUssQ0FBQztJQUNyRCxPQUFP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