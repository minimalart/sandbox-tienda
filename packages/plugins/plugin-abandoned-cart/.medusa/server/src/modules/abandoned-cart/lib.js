"use strict";
/**
 * Helpers puros del módulo de carritos abandonados (sin dependencias de runtime),
 * compartibles entre job, workflow y API.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectionWindow = detectionWindow;
exports.isWithinDetectionWindow = isWithinDetectionWindow;
exports.isContactable = isContactable;
exports.nextEligibleAfter = nextEligibleAfter;
exports.shapeMetrics = shapeMetrics;
exports.formatMoney = formatMoney;
exports.buildRecoveryUrl = buildRecoveryUrl;
exports.fullName = fullName;
const config_1 = require("./config");
const HOUR_MS = 60 * 60 * 1000;
function detectionWindow(now, config) {
    return {
        idleBefore: new Date(now.getTime() - (0, config_1.minIdleHours)(config) * HOUR_MS),
        oldestAllowed: new Date(now.getTime() - config.maxAgeHours * HOUR_MS),
    };
}
/**
 * Chequeo redundante con el filtro SQL, a propósito: cubre el borde de reloj
 * entre el cálculo de la ventana y la query, y deja el invariante explícito.
 */
function isWithinDetectionWindow(lastActivity, window) {
    if (!lastActivity)
        return false;
    const at = new Date(lastActivity);
    if (Number.isNaN(at.getTime()))
        return false;
    return at <= window.idleBefore && at >= window.oldestAllowed;
}
/**
 * Un carrito es *contactable* si tenemos por dónde escribirle. NO es condición
 * para trackearlo: se trackea todo carrito abandonado (para medir el abandono
 * real) y el contacto solo decide si se puede notificar. `cart.email` recién
 * existe después del paso de dirección del checkout, así que exigirlo en la
 * detección amputa la mayor parte del funnel.
 */
function isContactable(record) {
    return Boolean(record.email || record.phone);
}
/**
 * Cuándo vuelve a ser elegible un tracking, dado el último paso enviado y la
 * última actividad del carrito. `null` = no quedan pasos.
 *
 * Los offsets de los pasos son horas de inactividad ACUMULADAS desde la última
 * actividad, así que si el carrito revive hay que recalcular desde la actividad
 * nueva: dejar el valor viejo lo deja en el pasado y dispara un recordatorio
 * sobre un carrito que el cliente está usando en este momento.
 */
function nextEligibleAfter(lastActivity, lastStepSent, config) {
    const upcoming = config.steps
        .filter((s) => s.step > lastStepSent)
        .sort((a, b) => a.step - b.step)[0];
    return upcoming
        ? new Date(lastActivity.getTime() + upcoming.hoursAfterIdle * HOUR_MS)
        : null;
}
const OPEN_STATUSES = new Set(['pending', 'notified']);
/** Clave para agrupar montos cuando la fila no tiene moneda. */
const UNKNOWN_CURRENCY = 'unknown';
/** Clave para agrupar filas sin canal de venta (o de antes de que se guardara). */
const UNASSIGNED_CHANNEL = 'unassigned';
/**
 * Da forma a las métricas a partir de las filas agregadas. Pura y sin DB para que
 * sea testeable: la agregación en sí vive en el service.
 */
function shapeMetrics(rows) {
    const metrics = {
        total: 0,
        contactable: 0,
        uncontactable: 0,
        by_status: {},
        by_sales_channel: {},
        recoverable_value_by_currency: {},
        recovered_value_by_currency: {},
        recovery_rate: 0,
    };
    for (const row of rows) {
        const count = Number(row.count) || 0;
        const value = Number(row.value) || 0;
        const currency = (row.currency_code || UNKNOWN_CURRENCY).toLowerCase();
        const channel = row.sales_channel_id || UNASSIGNED_CHANNEL;
        metrics.total += count;
        if (row.contactable)
            metrics.contactable += count;
        else
            metrics.uncontactable += count;
        metrics.by_status[row.status] = (metrics.by_status[row.status] ?? 0) + count;
        metrics.by_sales_channel[channel] =
            (metrics.by_sales_channel[channel] ?? 0) + count;
        if (OPEN_STATUSES.has(row.status)) {
            metrics.recoverable_value_by_currency[currency] =
                (metrics.recoverable_value_by_currency[currency] ?? 0) + value;
        }
        else if (row.status === 'recovered') {
            metrics.recovered_value_by_currency[currency] =
                (metrics.recovered_value_by_currency[currency] ?? 0) + value;
        }
    }
    const recovered = metrics.by_status.recovered ?? 0;
    metrics.recovery_rate =
        metrics.contactable > 0 ? recovered / metrics.contactable : 0;
    return metrics;
}
/** Formatea un monto en la unidad mayor de la moneda (es-AR, 2 decimales). */
function formatMoney(amount) {
    const value = Number(amount) || 0;
    return new Intl.NumberFormat('es-AR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
}
/**
 * Arma el link de recuperación del carrito. Apunta a una ruta del storefront que
 * restaura el carrito por id y redirige al checkout (dependencia del storefront,
 * ver plan). Si no hay STOREFRONT_URL configurada, devuelve un path relativo.
 */
function buildRecoveryUrl(cartId, countryCode) {
    const base = (process.env.STOREFRONT_URL ||
        process.env.NEXT_PUBLIC_BASE_URL ||
        '').replace(/\/$/, '');
    const cc = (countryCode || process.env.STOREFRONT_DEFAULT_COUNTRY || 'cl')
        .toLowerCase()
        .trim();
    const path = `/${cc}/cart/recover?cart_id=${encodeURIComponent(cartId)}`;
    return base ? `${base}${path}` : path;
}
function fullName(first, last) {
    return [first, last].filter(Boolean).join(' ').trim();
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGliLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL21vZHVsZXMvYWJhbmRvbmVkLWNhcnQvbGliLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7O0dBR0c7O0FBb0JILDBDQVFDO0FBTUQsMERBUUM7QUFTRCxzQ0FLQztBQVdELDhDQVdDO0FBMkNELG9DQXVDQztBQUdELGtDQU1DO0FBT0QsNENBY0M7QUFFRCw0QkFLQztBQWxNRCxxQ0FBd0M7QUFFeEMsTUFBTSxPQUFPLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxJQUFJLENBQUM7QUFlL0IsU0FBZ0IsZUFBZSxDQUM3QixHQUFTLEVBQ1QsTUFBMkI7SUFFM0IsT0FBTztRQUNMLFVBQVUsRUFBRSxJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsT0FBTyxFQUFFLEdBQUcsSUFBQSxxQkFBWSxFQUFDLE1BQU0sQ0FBQyxHQUFHLE9BQU8sQ0FBQztRQUNwRSxhQUFhLEVBQUUsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLE9BQU8sRUFBRSxHQUFHLE1BQU0sQ0FBQyxXQUFXLEdBQUcsT0FBTyxDQUFDO0tBQ3RFLENBQUM7QUFDSixDQUFDO0FBRUQ7OztHQUdHO0FBQ0gsU0FBZ0IsdUJBQXVCLENBQ3JDLFlBQThDLEVBQzlDLE1BQXVCO0lBRXZCLElBQUksQ0FBQyxZQUFZO1FBQUUsT0FBTyxLQUFLLENBQUM7SUFDaEMsTUFBTSxFQUFFLEdBQUcsSUFBSSxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUM7SUFDbEMsSUFBSSxNQUFNLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUFFLE9BQU8sS0FBSyxDQUFDO0lBQzdDLE9BQU8sRUFBRSxJQUFJLE1BQU0sQ0FBQyxVQUFVLElBQUksRUFBRSxJQUFJLE1BQU0sQ0FBQyxhQUFhLENBQUM7QUFDL0QsQ0FBQztBQUVEOzs7Ozs7R0FNRztBQUNILFNBQWdCLGFBQWEsQ0FBQyxNQUc3QjtJ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