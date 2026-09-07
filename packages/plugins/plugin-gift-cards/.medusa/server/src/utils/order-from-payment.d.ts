import type { MedusaContainer } from '@medusajs/framework/types';
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
export declare function resolveOrderIdFromPayment(container: MedusaContainer, paymentId: string): Promise<string | undefined>;
