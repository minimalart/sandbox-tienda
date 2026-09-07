"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.default = scanAbandonedCartsJob;
const utils_1 = require("@medusajs/framework/utils");
const abandoned_cart_1 = require("../modules/abandoned-cart");
const lib_1 = require("../modules/abandoned-cart/lib");
const notify_abandoned_cart_1 = require("../workflows/notify-abandoned-cart");
/** Normaliza `cart.order`, que según el link puede llegar como objeto o array. */
function orderIdOf(cart) {
    const ref = Array.isArray(cart.order) ? cart.order[0] : cart.order;
    return ref?.id ?? null;
}
const CART_FIELDS = [
    'id',
    'email',
    'completed_at',
    'updated_at',
    'total',
    'currency_code',
    'sales_channel_id',
    'customer_id',
    'items.id',
    'customer.phone',
    'shipping_address.phone',
];
/**
 * Barrido periódico de carritos abandonados. Tres fases:
 *  1) DETECTAR: carritos `completed_at IS NULL` con items cuya última actividad
 *     cae DENTRO de la ventana (inactivos ≥ primer paso, no más viejos que
 *     `maxAgeHours`), y hace upsert del tracking. Se trackea tengan contacto o no:
 *     el contacto decide si se puede notificar, no si se mide.
 *  2) RECONCILIAR: cierra como `recovered` el tracking cuyo carrito ya se completó
 *     (red de seguridad para las órdenes cuyo evento se perdió).
 *  3) NOTIFICAR: dispara el workflow para cada tracking vencido (`next_eligible_at`).
 * Fire-and-forget: nunca propaga; cada error se loguea y sigue.
 */
async function scanAbandonedCartsJob(container) {
    const logger = container.resolve(utils_1.ContainerRegistrationKeys.LOGGER);
    const service = container.resolve(abandoned_cart_1.ABANDONED_CART_MODULE);
    const query = container.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const config = service.getConfig();
    if (!config.enabled) {
        logger.info('[AbandonedCart] cron: deshabilitado (ABANDONED_CART_ENABLED=false).');
        return;
    }
    const now = new Date();
    const window = (0, lib_1.detectionWindow)(now, config);
    // ── Fase 1: detección ──────────────────────────────────────────────────────
    let detected = 0;
    let scanned = 0;
    let truncated = false;
    try {
        // La ventana se filtra en SQL, no en memoria. Filtrar después de paginar era
        // el bug original: con `order: updated_at ASC` y sin filtro, las primeras
        // páginas son los carritos abiertos más viejos de la tienda, todos fuera de
        // la ventana, y la corrida entera se consumía descartándolos.
        for (let page = 0; page < config.maxPages; page++) {
            const { data } = (await query.graph({
                entity: 'cart',
                fields: CART_FIELDS,
                filters: {
                    completed_at: null,
                    updated_at: { $gte: window.oldestAllowed, $lte: window.idleBefore },
                },
                pagination: {
                    take: config.batchSize,
                    skip: page * config.batchSize,
                    // Dentro de la ventana, los más viejos primero: son los que están más
                    // cerca de que se les cierre la ventana de recuperación.
                    order: { updated_at: 'ASC' },
                },
            }));
            scanned += data.length;
            for (const cart of data) {
                const updatedAt = cart.updated_at ? new Date(cart.updated_at) : null;
                // Redundante con el filtro SQL, cubre el borde de reloj entre el cálculo
                // de la ventana y la query.
                if (!updatedAt || !(0, lib_1.isWithinDetectionWindow)(updatedAt, window))
                    continue;
                if (!cart.items || cart.items.length === 0)
                    continue;
                try {
                    await service.upsertFromSnapshot({
                        cart_id: cart.id,
                        email: cart.email ?? null,
                        phone: cart.customer?.phone ?? cart.shipping_address?.phone ?? null,
                        customer_id: cart.customer_id ?? null,
                        sales_channel_id: cart.sales_channel_id ?? null,
                        cart_total: cart.total ?? null,
                        currency_code: cart.currency_code ?? null,
                        last_activity_at: updatedAt,
                    }, config);
                    detected++;
                }
                catch (e) {
                    logger.warn(`[AbandonedCart] upsert de ${cart.id} falló: ${e.message}`);
                }
            }
            if (data.length < config.batchSize)
                break;
            // Última página permitida y todavía venía llena: quedó ventana sin recorrer.
            if (page === config.maxPages - 1)
                truncated = true;
        }
    }
    catch (e) {
        logger.warn(`[AbandonedCart] detección falló: ${e.message}`);
    }
    // ── Fase 2: reconciliación de carritos ya convertidos ───────────────────────
    // El subscriber de `order.placed` reintenta el link order→cart, pero un reinicio
    // del proceso puede perder el evento. Sin esta pasada, esas filas quedan
    // `notified` para siempre y la tasa de recuperación queda subestimada.
    let reconciled = 0;
    try {
        reconciled = await reconcileCompletedCarts(service, query, config.batchSize, logger);
    }
    catch (e) {
        logger.warn(`[AbandonedCart] reconciliación falló: ${e.message}`);
    }
    // ── Fase 3: notificación de pasos vencidos ──────────────────────────────────
    let notified = 0;
    let failed = 0;
    try {
        const due = await service.listDue(now, config.batchSize);
        for (const record of due) {
            try {
                const { result } = await (0, notify_abandoned_cart_1.notifyAbandonedCartWorkflow)(container).run({
                    input: { abandonedCartId: record.id },
                });
                if (!result.skipped)
                    notified++;
            }
            catch (e) {
                failed++;
                logger.warn(`[AbandonedCart] notificación de ${record.id} falló: ${e.message}`);
            }
        }
    }
    catch (e) {
        logger.warn(`[AbandonedCart] barrido de vencidos falló: ${e.message}`);
    }
    // Se loguea SIEMPRE, incluso 0/0/0. El silencio cuando no había detecciones fue
    // la razón por la que la detección rota pasó meses sin que nadie la viera.
    logger.info(`[AbandonedCart] cron: ${scanned} carritos en ventana, ${detected} trackeados, ` +
        `${reconciled} reconciliados, ${notified} notificados, ${failed} con error. ` +
        `Ventana: ${window.oldestAllowed.toISOString()} → ${window.idleBefore.toISOString()}.`);
    if (truncated) {
        logger.warn(`[AbandonedCart] tope de ${config.maxPages} páginas alcanzado: quedaron ` +
            `carritos en ventana sin revisar. Subí ABANDONED_CART_MAX_PAGES o ` +
            `ABANDONED_CART_BATCH_SIZE, o acortá ABANDONED_CART_MAX_AGE_HOURS.`);
    }
}
/**
 * Marca `recovered` el tracking abierto cuyo carrito ya tiene `completed_at`.
 * Resuelve la orden por el link cart→order para no perder la atribución de valor.
 */
async function reconcileCompletedCarts(service, query, batchSize, logger) {
    // Actividad más reciente primero: una conversión pasa poco después de la última
    // actividad del carrito, así que ahí es donde está lo que hay que reconciliar.
    // Ordenar al revés haría que la red de seguridad revise siempre las filas más
    // viejas — el mismo patrón de inanición que rompía la detección.
    const open = await service.listAbandonedCarts({ status: ['pending', 'notified'] }, { take: batchSize, order: { last_activity_at: 'DESC' } });
    if (!open.length)
        return 0;
    const { data } = (await query.graph({
        entity: 'cart',
        fields: ['id', 'completed_at', 'order.id'],
        filters: { id: open.map((r) => r.cart_id) },
    }));
    const completed = new Map(data.filter((c) => c.completed_at).map((c) => [c.id, orderIdOf(c)]));
    let reconciled = 0;
    for (const record of open) {
        if (!completed.has(record.cart_id))
            continue;
        const orderId = completed.get(record.cart_id) ?? null;
        if (await service.markRecoveredByCartId(record.cart_id, orderId)) {
            reconciled++;
            if (!orderId) {
                logger.warn(`[AbandonedCart] carrito ${record.cart_id} completado sin orden resoluble: ` +
                    'se marca recuperado sin atribución de valor.');
            }
        }
    }
    return reconciled;
}
exports.config = {
    name: 'scan-abandoned-carts',
    schedule: process.env.ABANDONED_CART_SCAN_CRON || '*/15 * * * *',
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2Nhbi1hYmFuZG9uZWQtY2FydHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvam9icy9zY2FuLWFiYW5kb25lZC1jYXJ0cy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUE4REEsd0NBaUlDO0FBOUxELHFEQUFzRTtBQUN0RSw4REFBa0U7QUFFbEUsdURBQXlGO0FBQ3pGLDhFQUFpRjtBQTBCakYsa0ZBQWtGO0FBQ2xGLFNBQVMsU0FBUyxDQUFDLElBQWtCO0lBQ25DLE1BQU0sR0FBRyxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDO0lBQ25FLE9BQU8sR0FBRyxFQUFFLEVBQUUsSUFBSSxJQUFJLENBQUM7QUFDekIsQ0FBQztBQUVELE1BQU0sV0FBVyxHQUFHO0lBQ2xCLElBQUk7SUFDSixPQUFPO0lBQ1AsY0FBYztJQUNkLFlBQVk7SUFDWixPQUFPO0lBQ1AsZUFBZTtJQUNmLGtCQUFrQjtJQUNsQixhQUFhO0lBQ2IsVUFBVTtJQUNWLGdCQUFnQjtJQUNoQix3QkFBd0I7Q0FDekIsQ0FBQztBQUVGOzs7Ozs7Ozs7O0dBVUc7QUFDWSxLQUFLLFVBQVUscUJBQXFCLENBQ2pELFNBQTBCO0lBRTFCLE1BQU0sTUFBTSxHQUFHLFNBQVMsQ0FBQyxPQUFPLENBQVMsaUNBQXlCLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDM0UsTUFBTSxPQUFPLEdBQUcsU0FBUyxDQUFDLE9BQU8sQ0FBNkIsc0NBQXFCLENBQUMsQ0FBQztJQUNyRixNQUFNLEtBQUssR0FBRyxTQUFTLENBQUMsT0FBTyxDQUFlLGlDQUF5QixDQUFDLEtBQUssQ0FBQyxDQUFDO0lBRS9FLE1BQU0sTUFBTSxHQUFHLE9BQU8sQ0FBQyxTQUFTLEVBQUUsQ0FBQztJQUNuQyxJQUFJ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