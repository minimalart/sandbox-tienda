"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const lib_1 = require("./lib");
const config_1 = require("./config");
/**
 * Estos tests fijan el contrato de la detección y de las métricas, que estuvieron
 * roturados en silencio: el panel mostraba todo en 0 porque la ventana temporal se
 * filtraba en memoria DESPUÉS de paginar, así que los carritos abiertos más viejos
 * de la tienda consumían la corrida entera y nunca se detectaba nada.
 */
const HOUR_MS = 60 * 60 * 1000;
const NOW = new Date('2026-08-03T12:00:00.000Z');
/** Config con los defaults reales (pasos 1h/24h/72h, ventana 14 días). */
const config = () => (0, config_1.getAbandonedCartConfig)();
const hoursAgo = (h) => new Date(NOW.getTime() - h * HOUR_MS);
// ── Ventana de detección ─────────────────────────────────────────────────────
(0, node_test_1.test)('la ventana va del primer paso hasta la edad máxima', () => {
    const w = (0, lib_1.detectionWindow)(NOW, config());
    strict_1.default.equal(w.idleBefore.toISOString(), hoursAgo(1).toISOString());
    strict_1.default.equal(w.oldestAllowed.toISOString(), hoursAgo(24 * 14).toISOString());
});
(0, node_test_1.test)('un carrito recién tocado NO entra: todavía no llegó al umbral de inactividad', () => {
    const w = (0, lib_1.detectionWindow)(NOW, config());
    strict_1.default.equal((0, lib_1.isWithinDetectionWindow)(hoursAgo(0.5), w), false);
});
(0, node_test_1.test)('un carrito inactivo hace 2h entra en la ventana', () => {
    const w = (0, lib_1.detectionWindow)(NOW, config());
    strict_1.default.equal((0, lib_1.isWithinDetectionWindow)(hoursAgo(2), w), true);
});
(0, node_test_1.test)('un carrito de 20 días NO entra: la ventana de recuperación ya cerró', () => {
    const w = (0, lib_1.detectionWindow)(NOW, config());
    strict_1.default.equal((0, lib_1.isWithinDetectionWindow)(hoursAgo(24 * 20), w), false);
});
(0, node_test_1.test)('los bordes exactos de la ventana son inclusivos', () => {
    const w = (0, lib_1.detectionWindow)(NOW, config());
    strict_1.default.equal((0, lib_1.isWithinDetectionWindow)(w.idleBefore, w), true);
    strict_1.default.equal((0, lib_1.isWithinDetectionWindow)(w.oldestAllowed, w), true);
});
(0, node_test_1.test)('sin última actividad, o con una fecha ilegible, el carrito no entra', () => {
    const w = (0, lib_1.detectionWindow)(NOW, config());
    strict_1.default.equal((0, lib_1.isWithinDetectionWindow)(null, w), false);
    strict_1.default.equal((0, lib_1.isWithinDetectionWindow)(undefined, w), false);
    strict_1.default.equal((0, lib_1.isWithinDetectionWindow)('no-es-una-fecha', w), false);
});
(0, node_test_1.test)('una avalancha de carritos viejos no tapa a los que sí están en ventana', () => {
    // Reproduce el bug original: con el filtro en memoria, 200 carritos de 2 años
    // consumían el lote entero y el de 2h nunca se llegaba a evaluar. Al filtrar por
    // ventana, los viejos simplemente no forman parte del universo.
    const w = (0, lib_1.detectionWindow)(NOW, config());
    const carts = [
        ...Array.from({ length: 200 }, () => hoursAgo(24 * 730)),
        hoursAgo(2),
    ];
    const inWindow = carts.filter((c) => (0, lib_1.isWithinDetectionWindow)(c, w));
    strict_1.default.equal(inWindow.length, 1);
    strict_1.default.equal(inWindow[0].toISOString(), hoursAgo(2).toISOString());
});
// ── Contactabilidad ──────────────────────────────────────────────────────────
(0, node_test_1.test)('contactable con email, con teléfono, o con cualquiera de los dos', () => {
    strict_1.default.equal((0, lib_1.isContactable)({ email: 'a@b.com', phone: null }), true);
    strict_1.default.equal((0, lib_1.isContactable)({ email: null, phone: '+5491100000000' }), true);
    strict_1.default.equal((0, lib_1.isContactable)({ email: 'a@b.com', phone: '+5491100000000' }), true);
});
(0, node_test_1.test)('no contactable sin email ni teléfono, tratando el string vacío como ausente', () => {
    strict_1.default.equal((0, lib_1.isContactable)({ email: null, phone: null }), false);
    strict_1.default.equal((0, lib_1.isContactable)({}), false);
    strict_1.default.equal((0, lib_1.isContactable)({ email: '', phone: '' }), false);
});
// ── Programación de pasos ────────────────────────────────────────────────────
(0, node_test_1.test)('sin pasos enviados, el próximo vencimiento es la actividad + primer paso', () => {
    const last = hoursAgo(2);
    const next = (0, lib_1.nextEligibleAfter)(last, 0, config());
    strict_1.default.equal(next?.toISOString(), new Date(last.getTime() + 1 * HOUR_MS).toISOString());
});
(0, node_test_1.test)('los offsets son acumulados desde la actividad, no entre pasos', () => {
    const last = hoursAgo(2);
    const cfg = config();
    strict_1.default.equal((0, lib_1.nextEligibleAfter)(last, 1, cfg)?.toISOString(), new Date(last.getTime() + 24 * HOUR_MS).toISOString());
    strict_1.default.equal((0, lib_1.nextEligibleAfter)(last, 2, cfg)?.toISOString(), new Date(last.getTime() + 72 * HOUR_MS).toISOString());
});
(0, node_test_1.test)('después del último paso no queda vencimiento', () => {
    strict_1.default.equal((0, lib_1.nextEligibleAfter)(hoursAgo(2), 3, config()), null);
});
(0, node_test_1.test)('si el carrito revive, el vencimiento se corre con la actividad nueva', () => {
    // Sin recalcular, el next_eligible_at viejo queda en el pasado y dispara un
    // recordatorio sobre un carrito que el cliente está usando en este momento.
    const cfg = config();
    const original = (0, lib_1.nextEligibleAfter)(hoursAgo(10), 0, cfg);
    const revived = (0, lib_1.nextEligibleAfter)(NOW, 0, cfg);
    strict_1.default.ok(original && revived);
    strict_1.default.ok(revived.getTime() > original.getTime());
    strict_1.default.ok(original.getTime() < NOW.getTime(), 'el viejo ya estaba vencido');
    strict_1.default.ok(revived.getTime() > NOW.getTime(), 'el nuevo queda a futuro');
});
(0, node_test_1.test)('nextStepFor respeta el umbral de inactividad de cada paso', () => {
    const cfg = config();
    strict_1.default.equal((0, config_1.nextStepFor)(cfg, 0, 0.5), null, 'todavía no llegó al paso 1');
    strict_1.default.equal((0, config_1.nextStepFor)(cfg, 0, 1)?.step, 1, 'el borde exacto es elegible');
    strict_1.default.equal((0, config_1.nextStepFor)(cfg, 1, 23), null, 'paso 1 hecho, paso 2 no vencido');
    strict_1.default.equal((0, config_1.nextStepFor)(cfg, 1, 24)?.step, 2);
    // Si se saltearon corridas, agarra el paso más avanzado que corresponde.
    strict_1.default.equal((0, config_1.nextStepFor)(cfg, 0, 100)?.step, 1, 'nunca saltea pasos');
    strict_1.default.equal((0, config_1.nextStepFor)(cfg, 2, 100)?.step, 3);
    strict_1.default.equal((0, config_1.nextStepFor)(cfg, 3, 1000), null, 'secuencia agotada');
});
// ── Métricas ─────────────────────────────────────────────────────────────────
const row = (over) => ({
    status: 'pending',
    currency_code: 'ars',
    sales_channel_id: 'sc_main',
    contactable: true,
    count: 1,
    value: 0,
    ...over,
});
(0, node_test_1.test)('sin filas, todo en cero y sin dividir por cero en la tasa', () => {
    const m = (0, lib_1.shapeMetrics)([]);
    strict_1.default.equal(m.total, 0);
    strict_1.default.equal(m.contactable, 0);
    strict_1.default.equal(m.uncontactable, 0);
    strict_1.default.equal(m.recovery_rate, 0);
    strict_1.default.deepEqual(m.by_status, {});
    strict_1.default.deepEqual(m.recoverable_value_by_currency, {});
});
(0, node_test_1.test)('separa contactables de sin contacto', () => {
    const m = (0, lib_1.shapeMetrics)([
        row({ contactable: true, count: 310 }),
        row({ contactable: false, count: 930 }),
    ]);
    strict_1.default.equal(m.total, 1240);
    strict_1.default.equal(m.contactable, 310);
    strict_1.default.equal(m.uncontactable, 930);
});
(0, node_test_1.test)('la tasa de recuperación se calcula sobre contactables, no sobre el total', () => {
    // Incluir carritos que nunca se pudieron notificar mide la captura de contacto,
    // no la efectividad de la secuencia.
    const m = (0, lib_1.shapeMetrics)([
        row({ status: 'pending', contactable: false, count: 900 }),
        row({ status: 'notified', contactable: true, count: 80 }),
        row({ status: 'recovered', contactable: true, count: 20 }),
    ]);
    strict_1.default.equal(m.contactable, 100);
    strict_1.default.equal(m.recovery_rate, 0.2);
});
(0, node_test_1.test)('los montos no mezclan monedas', () => {
    const m = (0, lib_1.shapeMetrics)([
        row({ status: 'pending', currency_code: 'ars', value: 15000 }),
        row({ status: 'notified', currency_code: 'ars', value: 5000 }),
        row({ status: 'pending', currency_code: 'clp', value: 90000 }),
        row({ status: 'recovered', currency_code: 'ars', value: 7000 }),
    ]);
    strict_1.default.deepEqual(m.recoverable_value_by_currency, { ars: 20000, clp: 90000 });
    strict_1.default.deepEqual(m.recovered_value_by_currency, { ars: 7000 });
});
(0, node_test_1.test)('solo pending y notified cuentan como valor recuperable', () => {
    const m = (0, lib_1.shapeMetrics)([
        row({ status: 'recovered', value: 500 }),
        row({ status: 'cancelled', value: 300 }),
    ]);
    strict_1.default.deepEqual(m.recoverable_value_by_currency, {});
    strict_1.default.deepEqual(m.recovered_value_by_currency, { ars: 500 });
});
(0, node_test_1.test)('agrupa por canal de venta y junta los huérfanos bajo unassigned', () => {
    const m = (0, lib_1.shapeMetrics)([
        row({ sales_channel_id: 'sc_main', count: 5 }),
        row({ sales_channel_id: 'sc_demo', count: 3 }),
        row({ sales_channel_id: null, count: 2 }),
    ]);
    strict_1.default.deepEqual(m.by_sales_channel, { sc_main: 5, sc_demo: 3, unassigned: 2 });
});
(0, node_test_1.test)('normaliza la moneda a minúsculas y agrupa la ausente como unknown', () => {
    const m = (0, lib_1.shapeMetrics)([
        row({ currency_code: 'ARS', value: 100 }),
        row({ currency_code: 'ars', value: 50 }),
        row({ currency_code: null, value: 25 }),
    ]);
    strict_1.default.deepEqual(m.recoverable_value_by_currency, { ars: 150, unknown: 25 });
});
(0, node_test_1.test)('tolera los strings que devuelve pg para COUNT y SUM', () => {
    // pg devuelve COUNT como bigint (string) y SUM(numeric) como string.
    const m = (0, lib_1.shapeMetrics)([
        { ...row({}), count: '4', value: '1200.50' },
    ]);
    strict_1.default.equal(m.total, 4);
    strict_1.default.deepEqual(m.recoverable_value_by_currency, { ars: 1200.5 });
});
(0, node_test_1.test)('un status desconocido no rompe ni desaparece del total', () => {
    const m = (0, lib_1.shapeMetrics)([row({ status: 'algo_nuevo', count: 3 })]);
    strict_1.default.equal(m.total, 3);
    strict_1.default.equal(m.by_status.algo_nuevo, 3);
    strict_1.default.equal(m.recovery_rate, 0);
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGliLnRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy9hYmFuZG9uZWQtY2FydC9saWIudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLHlDQUFpQztBQUNqQyxnRUFBd0M7QUFDeEMsK0JBT2U7QUFDZixxQ0FBeUY7QUFFekY7Ozs7O0dBS0c7QUFFSCxNQUFNLE9BQU8sR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLElBQUksQ0FBQztBQUMvQixNQUFNLEdBQUcsR0FBRyxJQUFJLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxDQUFDO0FBRWpELDBFQUEwRTtBQUMxRSxNQUFNLE1BQU0sR0FBRyxHQUF3QixFQUFFLENBQUMsSUFBQSwrQkFBc0IsR0FBRSxDQUFDO0FBRW5FLE1BQU0sUUFBUSxHQUFHLENBQUMsQ0FBUyxFQUFFLEVBQUUsQ0FBQyxJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsT0FBTyxFQUFFLEdBQUcsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxDQUFDO0FBRXRFLGdGQUFnRjtBQUVoRixJQUFBLGdCQUFJLEVBQUMsb0RBQW9ELEVBQUUsR0FBRyxFQUFFO0lBQzlELE1BQU0sQ0FBQyxHQUFHLElBQUEscUJBQWUsRUFBQyxHQUFHLEVBQUUsTUFBTSxFQUFFLENBQUMsQ0FBQztJQUV6QyxnQkFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFdBQVcsRUFBRSxFQUFFLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDO0lBQ3BFLGdCQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxhQUFhLENBQUMsV0FBVyxFQUFFLEVBQUUsUUFBUSxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDO0FBQy9FLENBQUMsQ0FBQyxDQUFDO0FBRUgsSUFBQSxnQkFBSSxFQUFDLDhFQUE4RSxFQUFFLEdB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