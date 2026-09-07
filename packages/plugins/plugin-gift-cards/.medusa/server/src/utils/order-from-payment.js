"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveOrderIdFromPayment = resolveOrderIdFromPayment;
const utils_1 = require("@medusajs/framework/utils");
/**
 * Resuelve el order_id a partir del payload `{ id: payment_id }` de
 * `payment.captured` (el evento de Medusa v2 no trae la orden): payment →
 * payment_collection_id → link `order_payment_collection` → order_id. Mismo
 * camino de 2 saltos que usa el core y que ya usa
 * src/subscribers/erp-payment-captured.ts.
 *
 * Devuelve undefined si el pago no existe, no tiene payment_collection o la
 * colección todavía no está linkeada a una orden (captura que llega antes de
 * completar el cart): esa carrera la cubre la pata `order.placed` del caller.
 */
async function resolveOrderIdFromPayment(container, paymentId) {
    const query = container.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const { data: payments } = (await query.graph({
        entity: 'payment',
        fields: ['id', 'payment_collection_id'],
        filters: { id: paymentId },
    }));
    const paymentCollectionId = payments[0]?.payment_collection_id;
    if (!paymentCollectionId)
        return undefined;
    const { data: links } = (await query.graph({
        entity: 'order_payment_collection',
        fields: ['order_id'],
        filters: { payment_collection_id: paymentCollectionId },
    }));
    return links[0]?.order_id ?? undefined;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3JkZXItZnJvbS1wYXltZW50LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3V0aWxzL29yZGVyLWZyb20tcGF5bWVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQWNBLDhEQW9CQztBQWpDRCxxREFBc0U7QUFFdEU7Ozs7Ozs7Ozs7R0FVRztBQUNJLEtBQUssVUFBVSx5QkFBeUIsQ0FDN0MsU0FBMEIsRUFDMUIsU0FBaUI7SUFFakIsTUFBTSxLQUFLLEdBQUcsU0FBUyxDQUFDLE9BQU8sQ0FBQyxpQ0FBeUIsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUVqRSxNQUFNLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxHQUFHLENBQUMsTUFBTSxLQUFLLENBQUMsS0FBSyxDQUFDO1FBQzVDLE1BQU0sRUFBRSxTQUFTO1FBQ2pCLE1BQU0sRUFBRSxDQUFDLElBQUksRUFBRSx1QkFBdUIsQ0FBQztRQUN2QyxPQUFPLEVBQUUsRUFBRSxFQUFFLEVBQUUsU0FBUyxFQUFFO0tBQzNCLENBQUMsQ0FBOEQsQ0FBQztJQUNqRSxNQUFNLG1CQUFtQixHQUFHLFFBQVEsQ0FBQyxDQUFDLENBQUMsRUFBRSxxQkFBcUIsQ0FBQztJQUMvRCxJQUFJLENBQUMsbUJBQW1CO1FBQUUsT0FBTyxTQUFTLENBQUM7SUFFM0MsTUFBTSxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsR0FBRyxDQUFDLE1BQU0sS0FBSyxDQUFDLEtBQUssQ0FBQztRQUN6QyxNQUFNLEVBQUUsMEJBQTBCO1FBQ2xDLE1BQU0sRUFBRSxDQUFDLFVBQVUsQ0FBQztRQUNwQixPQUFPLEVBQUUsRUFBRSxxQkFBcUIsRUFBRSxtQkFBbUIsRUFBRTtLQUN4RCxDQUFDLENBQWlELENBQUM7SUFDcEQsT0FBTyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsUUFBUSxJQUFJLFNBQVMsQ0FBQztBQUN6QyxDQUFDIn0=