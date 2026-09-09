import { CheckoutError } from './assignments';
const processable = new Set([
  'pending',
  'requires_more',
  'authorized',
  'captured',
  'pending_authorization',
]);
/** This checkout authorizes one provider for the remaining balance; credits are already deducted by Medusa. */
export function assertPaymentMatchesCart(cart: any) {
  const total = Number(cart.total);
  if (cart.total == null || !Number.isFinite(total) || total < 0)
    throw new CheckoutError('PAYMENT_STALE', 'El importe de la compra no es válido.', 'payment');
  if (total === 0) return;
  const collection = cart.payment_collection;
  const sessions =
    collection?.payment_sessions?.filter((s: any) => processable.has(s.status)) ?? [];
  if (
    sessions.length !== 1 ||
    collection?.amount == null ||
    Number(collection.amount) !== total ||
    collection.currency_code !== cart.currency_code ||
    sessions[0].amount == null ||
    Number(sessions[0].amount) !== total ||
    sessions[0].currency_code !== cart.currency_code
  )
    throw new CheckoutError(
      'PAYMENT_STALE',
      'El importe cambió o hay varias sesiones de pago. Volvé a seleccionar el pago.',
      'payment'
    );
}
