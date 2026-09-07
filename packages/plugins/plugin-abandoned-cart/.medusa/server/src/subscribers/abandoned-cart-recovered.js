"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.default = handleAbandonedCartRecovered;
const utils_1 = require("@medusajs/framework/utils");
const abandoned_cart_1 = require("../modules/abandoned-cart");
const CART_LINK_RETRIES = 5;
const CART_LINK_DELAY_MS = 500;
/**
 * Cuando una orden se crea, si su carrito estaba en seguimiento lo marca como
 * `recovered` para cortar la secuencia de recordatorios. Fire-and-forget: nunca
 * propaga al event bus.
 */
async function handleAbandonedCartRecovered({ event, container, }) {
    const orderId = event.data.id;
    if (!orderId)
        return;
    const logger = container.resolve(utils_1.ContainerRegistrationKeys.LOGGER);
    const query = container.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const service = container.resolve(abandoned_cart_1.ABANDONED_CART_MODULE);
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const loadOrder = async () => {
        const { data } = (await query.graph({
            entity: 'order',
            fields: ['id', 'cart_id'],
            filters: { id: orderId },
        }));
        return data[0];
    };
    try {
        // El link order → cart NO está commiteado cuando se emite `order.placed`: se
        // crea en un paso posterior de completeCartWorkflow. Sin este reintento
        // acotado el subscriber funciona en desarrollo y reporta CERO recuperados en
        // producción. Mismo patrón que `order-company-tag.ts` y `order-billing-snapshot.ts`.
        let order = await loadOrder();
        for (let attempt = 0; attempt < CART_LINK_RETRIES && !order?.cart_id; attempt++) {
            await sleep(CART_LINK_DELAY_MS);
            order = await loadOrder();
        }
        const cartId = order?.cart_id;
        if (!cartId) {
            // No es inocuo: el tracking queda abierto y la tasa de recuperación
            // subestimada. La fase de reconciliación del cron lo recoge después.
            logger.warn(`[AbandonedCart] la orden ${orderId} no resolvió cart_id tras ` +
                `${CART_LINK_RETRIES} intentos; queda para la reconciliación del cron.`);
            return;
        }
        const recovered = await service.markRecoveredByCartId(cartId, orderId);
        if (recovered) {
            logger.info(`[AbandonedCart] carrito ${cartId} recuperado por orden ${orderId}.`);
        }
    }
    catch (e) {
        logger.warn(`[AbandonedCart] no se pudo marcar recuperado para la orden ${orderId}: ${e.message}`);
    }
}
exports.config = {
    event: 'order.placed',
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWJhbmRvbmVkLWNhcnQtcmVjb3ZlcmVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3N1YnNjcmliZXJzL2FiYW5kb25lZC1jYXJ0LXJlY292ZXJlZC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFnQkEsK0NBc0RDO0FBckVELHFEQUFzRTtBQUV0RSw4REFBa0U7QUFLbEUsTUFBTSxpQkFBaUIsR0FBRyxDQUFDLENBQUM7QUFDNUIsTUFBTSxrQkFBa0IsR0FBRyxHQUFHLENBQUM7QUFFL0I7Ozs7R0FJRztBQUNZLEtBQUssVUFBVSw0QkFBNEIsQ0FBQyxFQUN6RCxLQUFLLEVBQ0wsU0FBUyxHQUNzQjtJQUMvQixNQUFNLE9BQU8sR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztJQUM5QixJQUFJLENBQUMsT0FBTztRQUFFLE9BQU87SUFFckIsTUFBTSxNQUFNLEdBQUcsU0FBUyxDQUFDLE9BQU8sQ0FBUyxpQ0FBeUIsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUMzRSxNQUFNLEtBQUssR0FBRyxTQUFTLENBQUMsT0FBTyxDQUU1QixpQ0FBeUIsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUNwQyxNQUFNLE9BQU8sR0FBRyxTQUFTLENBQUMsT0FBTyxDQUE2QixzQ0FBcUIsQ0FBQyxDQUFDO0lBRXJGLE1BQU0sS0FBSyxHQUFHLENBQUMsRUFBVSxFQUFFLEVBQUUsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsVUFBVSxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ3BFLE1BQU0sU0FBUyxHQUFHLEtBQUssSUFBcUMsRUFBRTtRQUM1RCxNQUFNLEVBQUUsSUFBSSxFQUFFLEdBQUcsQ0FBQyxNQUFNLEtBQUssQ0FBQyxLQUFLLENBQUM7WUFDbEMsTUFBTSxFQUFFLE9BQU87WUFDZixNQUFNLEVBQUUsQ0FBQyxJQUFJLEVBQUUsU0FBUyxDQUFDO1lBQ3pCLE9BQU8sRUFBRSxFQUFFLEVBQUUsRUFBRSxPQUFPLEVBQUU7U0FDekIsQ0FBQyxDQUEyQixDQUFDO1FBQzlCLE9BQU8sSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ2pCLENBQUMsQ0FBQztJQUVGLElBQUksQ0FBQztRQUNILDZFQUE2RTtRQUM3RSx3RUFBd0U7UUFDeEUsNkVBQTZFO1FBQzdFLHFGQUFxRjtRQUNyRixJQUFJLEtBQUssR0FBRyxNQUFNLFNBQVMsRUFBRSxDQUFDO1FBQzlCLEtBQUssSUFBSSxPQUFPLEdBQUcsQ0FBQyxFQUFFLE9BQU8sR0FBRyxpQkFBaUIsSUFBSSxDQUFDLEtBQUssRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFFLEVBQUUsQ0FBQztZQUNoRixNQUFNLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO1lBQ2hDLEtBQUssR0FBRyxNQUFNLFNBQVMsRUFBRSxDQUFDO1FBQzVCLENBQUM7UUFFRCxNQUFNLE1BQU0sR0FBRyxLQUFLLEVBQUUsT0FBTyxDQUFDO1FBQzlCLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUNaLG9FQUFvRTtZQUNwRSxxRUFBcUU7WUFDckUsTUFBTSxDQUFDLElBQUksQ0FDVCw0QkFBNEIsT0FBTyw0QkFBNEI7Z0JBQzdELEdBQUcsaUJBQWlCLG1EQUFtRCxDQUMxRSxDQUFDO1lBQ0YsT0FBTztRQUNULENBQUM7UUFFRCxNQUFNLFNBQVMsR0FBRyxNQUFNLE9BQU8sQ0FBQyxxQkFBcUIsQ0FBQyxNQUFNLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDdkUsSUFBSSxTQUFTLEVBQUUsQ0FBQztZQUNkLE1BQU0sQ0FBQyxJQUFJLENBQUMsMkJBQTJCLE1BQU0seUJBQXlCLE9BQU8sR0FBRyxDQUFDLENBQUM7UUFDcEYsQ0FBQztJQUNILENBQUM7SUFBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1FBQ1gsTUFBTSxDQUFDLElBQUksQ0FDVCw4REFBOEQsT0FBTyxLQUFNLENBQVcsQ0FBQyxPQUFPLEVBQUUsQ0FDakcsQ0FBQztJQUNKLENBQUM7QUFDSCxDQUFDO0FBRVksUUFBQSxNQUFNLEdBQXFCO0lBQ3RDLEtBQUssRUFBRSxjQUFjO0NBQ3RCLENBQUMifQ==