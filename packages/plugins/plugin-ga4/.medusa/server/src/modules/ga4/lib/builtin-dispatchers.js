"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BUILTIN_BUILDERS = void 0;
const utils_1 = require("@medusajs/framework/utils");
const format_ga_items_1 = require("./format-ga-items");
function getQuery(container) {
    return container.resolve(utils_1.ContainerRegistrationKeys.QUERY);
}
function clientIdFrom(entity) {
    const id = entity?.metadata?.ga_client_id;
    return typeof id === 'string' && id ? id : null;
}
// order.placed → purchase
async function buildPurchase(container, data) {
    const query = getQuery(container);
    const { data: [order], } = await query.graph({
        entity: 'order',
        fields: ['*', 'items.*', 'sales_channel_id'],
        filters: { id: data.id },
    });
    if (!order)
        return null;
    const clientId = clientIdFrom(order);
    if (!clientId)
        return null;
    return {
        clientId,
        userId: order.customer_id ?? undefined,
        params: {
            transaction_id: order.id,
            value: order.total,
            affiliation: order.sales_channel_id,
            tax: order.tax_total,
            shipping: order.shipping_total,
            currency: order.currency_code,
            items: (0, format_ga_items_1.formatGACartItems)(order.items, order),
        },
    };
}
// payment.refunded → refund
// El payload trae SOLO el payment id. Resolvemos el order recorriendo edges ya
// probados en el repo: payment → payment_collection → cart → order. El monto
// refundado no viene en el evento: sumamos payment.refunds[].amount (refund
// acumulado) y caemos a order.total si no hay parcial resoluble.
async function buildRefund(container, data) {
    const query = getQuery(container);
    const { data: [payment], } = await query.graph({
        entity: 'payment',
        fields: ['id', 'refunds.amount', 'payment_collection.id'],
        filters: { id: data.id },
        pagination: { take: 1 },
    });
    const collectionId = payment?.payment_collection?.id;
    if (!collectionId)
        return null;
    const { data: [collection], } = await query.graph({
        entity: 'payment_collection',
        fields: ['cart.order.id'],
        filters: { id: collectionId },
        pagination: { take: 1 },
    });
    const orderId = collection?.cart?.order?.id;
    if (!orderId)
        return null;
    const { data: [order], } = await query.graph({
        entity: 'order',
        fields: ['*', 'items.*', 'items.variant.*'],
        filters: { id: orderId },
        pagination: { take: 1 },
    });
    if (!order)
        return null;
    const clientId = clientIdFrom(order);
    if (!clientId)
        return null;
    const refundedAmount = Array.isArray(payment?.refunds)
        ? payment.refunds.reduce((acc, r) => acc + (r?.amount ?? 0), 0)
        : 0;
    return {
        clientId,
        userId: order.customer_id ?? undefined,
        params: {
            transaction_id: order.id,
            value: refundedAmount > 0 ? refundedAmount : order.total,
            currency: order.currency_code,
            items: (0, format_ga_items_1.formatGACartItems)(order.items, order),
        },
    };
}
async function fetchCart(container, id) {
    const query = getQuery(container);
    const { data: [cart], } = await query.graph({
        entity: 'cart',
        fields: ['*'],
        filters: { id },
        pagination: { take: 1 },
    });
    return cart;
}
// cart.updated (line_items added) → add_to_cart
async function buildAddToCart(container, data) {
    const items = data.changes?.line_items?.value;
    if (!items)
        return null;
    const cart = await fetchCart(container, data.id);
    if (!cart)
        return null;
    const clientId = clientIdFrom(cart);
    if (!clientId)
        return null;
    const value = items.reduce((acc, it) => acc + (it.unit_price ?? 0) * (it.quantity ?? 0), 0);
    return {
        clientId,
        userId: cart.customer_id ?? undefined,
        params: {
            currency: cart.currency_code?.toUpperCase(),
            value,
            items: (0, format_ga_items_1.formatGACartItems)(items, cart),
        },
    };
}
// cart.updated (line_items deleted) → remove_from_cart
async function buildRemoveFromCart(container, data) {
    const items = data.changes?.line_items?.value;
    if (!items)
        return null;
    const cart = await fetchCart(container, data.id);
    if (!cart)
        return null;
    const clientId = clientIdFrom(cart);
    if (!clientId)
        return null;
    const value = items.reduce((acc, it) => acc + (it.unit_price ?? 0) * (it.quantity ?? 0), 0);
    return {
        clientId,
        userId: cart.customer_id ?? undefined,
        params: {
            currency: cart.currency_code?.toUpperCase(),
            value,
            items: (0, format_ga_items_1.formatGACartItems)(items, cart),
        },
    };
}
// cart.updated (shipping_address) → add_shipping_info
async function buildAddShippingInfo(container, data) {
    if (!data.changes?.shipping_address)
        return null;
    const cart = await fetchCart(container, data.id);
    if (!cart)
        return null;
    const clientId = clientIdFrom(cart);
    if (!clientId)
        return null;
    return {
        clientId,
        userId: cart.customer_id ?? undefined,
        params: {
            currency: cart.currency_code?.toUpperCase(),
            value: cart.item_total,
            items: (0, format_ga_items_1.formatGACartItems)(cart.items, cart),
        },
    };
}
// payment-session.created → add_payment_info
async function buildAddPaymentInfo(container, data) {
    const collectionId = data.payment_session?.payment_collection_id;
    if (!collectionId)
        return null;
    const query = getQuery(container);
    const { data: [paymentCollection], } = await query.graph({
        entity: 'payment_collection',
        fields: ['cart.id'],
        filters: { id: collectionId },
        pagination: { take: 1 },
    });
    if (!paymentCollection?.cart?.id)
        return null;
    const { data: [cart], } = await query.graph({
        entity: 'cart',
        fields: ['*', 'items.*', 'items.variant.*'],
        filters: { id: paymentCollection.cart.id },
        pagination: { take: 1 },
    });
    if (!cart)
        return null;
    const clientId = clientIdFrom(cart);
    if (!clientId)
        return null;
    return {
        clientId,
        userId: cart.customer_id ?? undefined,
        params: {
            currency: cart.currency_code?.toUpperCase(),
            value: cart.item_total,
            items: cart.items ? (0, format_ga_items_1.formatGACartItems)(cart.items, cart) : [],
        },
    };
}
exports.BUILTIN_BUILDERS = {
    purchase: buildPurchase,
    refund: buildRefund,
    add_to_cart: buildAddToCart,
    remove_from_cart: buildRemoveFromCart,
    add_shipping_info: buildAddShippingInfo,
    add_payment_info: buildAddPaymentInfo,
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVpbHRpbi1kaXNwYXRjaGVycy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL2dhNC9saWIvYnVpbHRpbi1kaXNwYXRjaGVycy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxxREFBc0U7QUFDdEUsdURBQXNEO0FBNEJ0RCxTQUFTLFFBQVEsQ0FBQyxTQUF3QjtJQUN4QyxPQUFPLFNBQVMsQ0FBQyxPQUFPLENBQUMsaUNBQXlCLENBQUMsS0FBSyxDQUFjLENBQUM7QUFDekUsQ0FBQztBQUVELFNBQVMsWUFBWSxDQUFDLE1BQXFEO0lBQ3pFLE1BQU0sRUFBRSxHQUFHLE1BQU0sRUFBRSxRQUFRLEVBQUUsWUFBWSxDQUFDO0lBQzFDLE9BQU8sT0FBTyxFQUFFLEtBQUssUUFBUSxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7QUFDbEQsQ0FBQztBQUVELDBCQUEwQjtBQUMxQixLQUFLLFVBQVUsYUFBYSxDQUMxQixTQUF3QixFQUN4QixJQUFvQjtJQUVwQixNQUFNLEtBQUssR0FBRyxRQUFRLENBQUMsU0FBUyxDQUFDLENBQUM7SUFDbEMsTUFBTSxFQUNKLElBQUksRUFBRSxDQUFDLEtBQUssQ0FBQyxHQUNkLEdBQUcsTUFBTSxLQUFLLENBQUMsS0FBSyxDQUFDO1FBQ3BCLE1BQU0sRUFBRSxPQUFPO1FBQ2YsTUFBTSxFQUFFLENBQUMsR0FBRyxFQUFFLFNBQVMsRUFBRSxrQkFBa0IsQ0FBQztRQUM1QyxPQUFPLEVBQUUsRUFBRSxFQUFFLEVBQUUsSUFBSSxDQUFDLEVBQUUsRUFBRTtLQUN6QixDQUFDLENBQUM7SUFDSCxJQUFJLENBQUMsS0FBSztRQUFFLE9BQU8sSUFBSSxDQUFDO0lBRXhCLE1BQU0sUUFBUSxHQUFHLFlBQVksQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUNyQyxJQUFJLENBQUMsUUFBUTtRQUFFLE9BQU8sSUFBSSxDQUFDO0lBRTNCLE9BQU87UUFDTCxRQUFRO1FBQ1IsTUFBTSxFQUFFLEtBQUssQ0FBQyxXQUFXLElBQUksU0FBUztRQUN0QyxNQUFNLEVBQUU7WUFDTixjQUFjLEVBQUUsS0FBSyxDQUFDLEVBQUU7WUFDeEIsS0FBSyxFQUFFLEtBQUssQ0FBQyxLQUFLO1lBQ2xCLFdBQVcsRUFBRSxLQUFLLENBQUMsZ0JBQWdCO1lBQ25DLEdBQUcsRUFBRSxLQUFLLENBQUMsU0FBUztZQUNwQixRQUFRLEVBQUUsS0FBSyxDQUFDLGNBQWM7WUFDOUIsUUFBUSxFQUFFLEtBQUssQ0FBQyxhQUFhO1lBQzdCLEtBQUssRUFBRSxJQUFBLG1DQUFpQixFQUFDLEtBQUssQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDO1NBQzdDO0tBQ0YsQ0FBQztBQUNKLENBQUM7QUFFRCw0QkFBNEI7QUFDNUIsK0VBQStFO0FBQy9FLDZFQUE2RTtBQUM3RSw0RUFBNEU7QUFDNUUsaUVBQWlFO0FBQ2pFLEtBQUssVUFBVSxXQUFXLENBQ3hCLFNBQXdCLEVBQ3hCLElBQW9CO0lBRXBCLE1BQU0sS0FBSyxHQUFHLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUVsQyxNQUFNLEVBQ0osSUFBSSxFQUFFLENBQUMsT0FBTyxDQUFDLEdBQ2hCLEdBQUcsTUFBTSxLQUFLLENBQUMsS0FBSyxDQUFDO1FBQ3BCLE1BQU0sRUFBRSxTQUFTO1FBQ2pCLE1BQU0sRUFBRSxDQUFDLElBQUksRUFBRSxnQkFBZ0IsRUFBRSx1QkFBdUIsQ0FBQztRQUN6RCxPQUFPLEVBQUUsRUFBRSxFQUFFLEVBQUUsSUFBSSxDQUFDLEVBQUUsRUFBRTtRQUN4QixVQUFVLEVBQUUsRUFBRSxJQUFJLEVBQUUsQ0FBQyxFQUFFO0tBQ3hCLENBQUMsQ0FBQztJQUNILE1BQU0sWUFBWSxHQUFHLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxFQUFFLENBQUM7SUFDckQsSUFBSSxDQUFDLFlBQVk7UUFBRSxPQUFPLElBQUksQ0FBQztJQUUvQixNQUFNLEVBQ0osSUFBSSxFQUFFLENBQUMsVUFBVSxDQUFDLEdBQ25CLEdBQUcsTUFBTSxLQUFLLENBQUMsS0FBSyxDQUFDO1FBQ3BCLE1BQU0sRUFBRSxvQkFBb0I7UUFDNUIsTUFBTSxFQUFFLENBQUMsZUFBZSxDQUFDO1FBQ3pCLE9BQU8sRUFBRSxFQUFFLEVBQUUsRUFBRSxZQUFZLEVBQUU7UUFDN0IsVUFBVSxFQUFFLEVBQUUsSUFBSSxFQUFFLENBQUMsRUFBRTtLQUN4QixDQUFDLENBQUM7SUFDSCxNQUFNLE9BQU8sR0FBRyxVQUFVLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxFQUFFLENBQUM7SUFDNUMsSUFBSSxDQUFDLE9BQU87UUFBRSxPQUFPLElBQUksQ0FBQztJQUUxQixNQUFNLEVBQ0osSUFBSSxFQUFFLENBQUMsS0FBSyxDQUFDLEdBQ2QsR0FBRyxNQUFNLEtBQUssQ0FBQyxLQUFLLENBQUM7UUFDcEIsTUFBTSxFQUFFLE9BQU87UUFDZixNQUFNLEVBQUUsQ0FBQyxHQUFHLEVBQUUsU0FBUyxFQUFFLGlCQUFpQixDQUFDO1FBQzNDLE9BQU8sRUFBRSxFQUFFLEVBQUUsRUFBRSxPQUFPLEVBQUU7UUFDeEIsVUFBVSxFQUFFLEVBQUUsSUFBSSxFQUFFLENBQUMsRUFBRTtLQUN4QixDQUFDLENBQUM7SUFDSCxJQUFJLENBQUMsS0FBSztRQUFFLE9BQU8sSUFBSSxDQUFDO0lBRXhCLE1BQU0sUUFBUSxHQUFHLFlBQVksQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUNyQyxJQUFJLENBQUMsUUFBUTtRQUFFLE9BQU8sSUFBSSxDQUFDO0lBRTNCLE1BQU0sY0FBYyxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQztRQUNwRCxDQUFDLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQ3BCLENBQUMsR0FBVyxFQUFFLENBQTZCLEVBQUUsRUFBRSxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUMsRUFBRSxNQUFNLElBQUksQ0FBQyxDQUFDLEVBQ3RFLENBQUMsQ0FDRjtRQUNILENBQUMsQ0FBQyxDQUFDLENBQUM7SUFFTixPQUFPO1FBQ0wsUUFBUTtRQUNSLE1BQU0sRUFBRSxLQUFLLENBQUMsV0FBVyxJQUFJLFNBQVM7UUFDdEMsTUFBTSxFQUFFO1lBQ04sY0FBYyxFQUFFLEtBQUssQ0FBQyxFQUFFO1lBQ3hCLEtBQUssRUFBRSxjQUFjLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxLQUFLO1lBQ3hELFFBQVEsRUFBRSxLQUFLLENBQUMsYUFBYTtZQUM3QixLQUFLLEVBQUUsSUFBQSxtQ0FBaUIsRUFBQyxLQUFLLENBQUMsS0FBSyxFQUFFLEtBQUssQ0FBQztTQUM3QztLQUNGLENBQUM7QUFDSixDQUFDO0FBRUQsS0FBSyxVQUFVLFNBQVMsQ0FBQyxTQUF3QixFQUFFLEVBQVU7SUFDM0QsTUFBTSxLQUFLLEdBQUcsUUFBUSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQ2xDLE1BQU0sRUFDSixJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsR0FDYixHQUFHLE1BQU0sS0FBSyxDQUFDLEtBQUssQ0FBQztRQUNwQixNQUFNLEVBQUUsTUFBTTtRQUNkLE1BQU0sRUFBRSxDQUFDLEdBQUcsQ0FBQztRQUNiLE9BQU8sRUFBRSxFQUFFLEVBQUUsRUFBRTtRQUNmLFVBQVUsRUFBRSxFQUFFLElBQUksRUFBRSxDQUFDLEVBQUU7S0FDeEIsQ0FBQyxDQUFDO0lBQ0gsT0FBTyxJQUFJLENBQUM7QUFDZCxDQUFDO0FBRUQsZ0RBQWdEO0FBQ2hELEtBQUssVUFBVSxjQUFjLENBQzNCLFNBQXdCLEVBQ3hCLElBQW1DO0lBRW5DLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxPQUFPLEVBQUUsVUFBVSxFQUFFLEtBQUssQ0FBQztJQUM5QyxJQUFJLENBQUMsS0FBSztRQUFFLE9BQU8sSUFBSSxDQUFDO0lBRXhCLE1BQU0sSUFBSSxHQUFHLE1BQU0sU0FBUyxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDakQsSUFBSSxDQUFDLElBQUk7UUFBRSxPQUFPLElBQUksQ0FBQztJQUN2QixNQUFNLFFBQVEsR0FBRyxZQUFZLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDcEMsSUFBSSxDQUFDLFFBQVE7UUFBRSxPQUFPLElBQUksQ0FBQztJQUUzQixNQUFNLEtBQUssR0FBRyxLQUFLLENBQUMsTUFBTSxDQUN4QixDQUFDLEdBQVcsRUFBRSxFQUFPLEVBQUUsRUFBRSxDQUFDLEdBQUcsR0FBRyxDQUFDLEVBQUUsQ0FBQyxVQUFVLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsUUFBUSxJQUFJLENBQUMsQ0FBQyxFQUN6RSxDQUFDLENBQ0YsQ0FBQztJQUVGLE9BQU87UUFDTCxRQUFRO1FBQ1IsTUFBTSxFQUFFLElBQUksQ0FBQyxXQUFXLElBQUksU0FBUztRQUNyQyxNQUFNLEVBQUU7WUFDTixRQUFRLEVBQUUsSUFBSSxDQUFDLGFBQWEsRUFBRSxXQUFXLEVBQUU7WUFDM0MsS0FBSztZQUNMLEtBQUssRUFBRSxJQUFBLG1DQUFpQixFQUFDLEtBQUssRUFBRSxJQUFJLENBQUM7U0FDdEM7S0FDRixDQUFDO0FBQ0osQ0FBQztBQUVELHVEQUF1RDtBQUN2RCxLQUFLLFVBQVUsbUJBQW1CLENBQ2hDLFNBQXdCLEVBQ3hCLElBQW1DO0lBRW5DLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxPQUFPLEVBQUUsVUFBVSxFQUFFLEtBQUssQ0FBQztJQUM5QyxJQUFJLENBQUMsS0FBSztRQUFFLE9BQU8sSUFBSSxDQUFDO0lBRXhCLE1BQU0sSUFBSSxHQUFHLE1BQU0sU0FBUyxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDakQsSUFBSSxDQUFDLElBQUk7UUFBRSxPQUFPLElBQUksQ0FBQztJQUN2QixNQUFNLFFBQVEsR0FBRyxZQUFZLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDcEMsSUFBSSxDQUFDLFFBQVE7UUFBRSxPQUFPLElBQUksQ0FBQztJQUUzQixNQUFNLEtBQUssR0FBRyxLQUFLLENBQUMsTUFBTSxDQUN4QixDQUFDLEdBQVcsRUFBRSxFQUFPLEVBQUUsRUFBRSxDQUFDLEdBQUcsR0FBRyxDQUFDLEVBQUUsQ0FBQyxVQUFVLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsUUFBUSxJQUFJLENBQUMsQ0FBQyxFQUN6RSxDQUFDLENBQ0YsQ0FBQztJQUVGLE9BQU87UUFDTCxRQUFRO1FBQ1IsTUFBTSxFQUFFLElBQUksQ0FBQyxXQUFXLElBQUksU0FBUztRQUNyQyxNQUFNLEVBQUU7WUFDTixRQUFRLEVBQUUsSUFBSSxDQUFDLGFBQWEsRUFBRSxXQUFXLEVBQUU7WUFDM0MsS0FBSztZQUNMLEtBQUssRUFBRSxJQUFBLG1DQUFpQixFQUFDLEtBQUssRUFBRSxJQUFJLENBQUM7U0FDdEM7S0FDRixDQUFDO0FBQ0osQ0FBQztBQUVELHNEQUFzRDtBQUN0RCxLQUFLLFVBQVUsb0JBQW9CLENBQ2pDLFNBQXdCLEVBQ3hCLElBQW1DO0lBRW5DLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLGdCQUFnQjtRQUFFLE9BQU8sSUFBSSxDQUFDO0lBRWpELE1BQU0sSUFBSSxHQUFHLE1BQU0sU0FBUyxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDakQsSUFBSSxDQUFDLElBQUk7UUFBRSxPQUFPLElBQUksQ0FBQztJQUN2QixNQUFNLFFBQVEsR0FBRyxZQUFZLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDcEMsSUFBSSxDQUFDLFFBQVE7UUFBRSxPQUFPLElBQUksQ0FBQztJQUUzQixPQUFPO1FBQ0wsUUFBUTtRQUNSLE1BQU0sRUFBRSxJQUFJLENBQUMsV0FBVyxJQUFJLFNBQVM7UUFDckMsTUFBTSxFQUFFO1lBQ04sUUFBUSxFQUFFLElBQUksQ0FBQyxhQUFhLEVBQUUsV0FBVyxFQUFFO1lBQzNDLEtBQUssRUFBRSxJQUFJLENBQUMsVUFBVTtZQUN0QixLQUFLLEVBQUUsSUFBQSxtQ0FBaUIsRUFBQyxJQUFJLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQztTQUMzQztLQUNGLENBQUM7QUFDSixDQUFDO0FBRUQsNkNBQTZDO0FBQzdDLEtBQUssVUFBVSxtQkFBbUIsQ0FDaEMsU0FBd0IsRUFDeEIsSUFBMEU7SUFFMUUsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLGVBQWUsRUFBRSxxQkFBcUIsQ0FBQztJQUNqRSxJQUFJLENBQUMsWUFBWTtRQUFFLE9BQU8sSUFBSSxDQUFDO0lBRS9CLE1BQU0sS0FBSyxHQUFHLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUNsQyxNQUFNLEVBQ0osSUFBSSxFQUFFLENBQUMsaUJBQWlCLENBQUMsR0FDMUIsR0FBRyxNQUFNLEtBQUssQ0FBQyxLQUFLLENBQUM7UUFDcEIsTUFBTSxFQUFFLG9CQUFvQjtRQUM1QixNQUFNLEVBQUUsQ0FBQyxTQUFTLENBQUM7UUFDbkIsT0FBTyxFQUFFLEVBQUUsRUFBRSxFQUFFLFlBQVksRUFBRTtRQUM3QixVQUFVLEVBQUUsRUFBRSxJQUFJLEVBQUUsQ0FBQyxFQUFFO0tBQ3hCLENBQUMsQ0FBQztJQUNILElBQUksQ0FBQyxpQkFBaUIsRUFBRSxJQUFJLEVBQUUsRUFBRTtRQUFFLE9BQU8sSUFBSSxDQUFDO0lBRTlDLE1BQU0sRUFDSixJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsR0FDYixHQUFHLE1BQU0sS0FBSyxDQUFDLEtBQUssQ0FBQztRQUNwQixNQUFNLEVBQUUsTUFBTTtRQUNkLE1BQU0sRUFBRSxDQUFDLEdBQUcsRUFBRSxTQUFTLEVBQUUsaUJBQWlCLENBQUM7UUFDM0MsT0FBTyxFQUFFLEVBQUUsRUFBRSxFQUFFLGlCQUFpQixDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUU7UUFDMUMsVUFBVSxFQUFFLEVBQUUsSUFBSSxFQUFFLENBQUMsRUFBRTtLQUN4QixDQUFDLENBQUM7SUFDSCxJQUFJLENBQUMsSUFBSTtRQUFFLE9BQU8sSUFBSSxDQUFDO0lBRXZCLE1BQU0sUUFBUSxHQUFHLFlBQVksQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNwQyxJQUFJLENBQUMsUUFBUTtRQUFFLE9BQU8sSUFBSSxDQUFDO0lBRTNCLE9BQU87UUFDTCxRQUFRO1FBQ1IsTUFBTSxFQUFFLElBQUksQ0FBQyxXQUFXLElBQUksU0FBUztRQUNyQyxNQUFNLEVBQUU7WUFDTixRQUFRLEVBQUUsSUFBSSxDQUFDLGFBQWEsRUFBRSxXQUFXLEVBQUU7WUFDM0MsS0FBSyxFQUFFLElBQUksQ0FBQyxVQUFVO1lBQ3RCLEtBQUssRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFBLG1DQUFpQixFQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUU7U0FDN0Q7S0FDRixDQUFDO0FBQ0osQ0FBQztBQUVZLFFBQUEsZ0JBQWdCLEdBR3pCO0lBQ0YsUUFBUSxFQUFFLGFBQWE7SUFDdkIsTUFBTSxFQUFFLFdBQVc7SUFDbkIsV0FBVyxFQUFFLGNBQWM7SUFDM0IsZ0JBQWdCLEVBQUUsbUJBQW1CO0lBQ3JDLGlCQUFpQixFQUFFLG9CQUFvQjtJQUN2QyxnQkFBZ0IsRUFBRSxtQkFBbUI7Q0FDdEMsQ0FBQyJ9