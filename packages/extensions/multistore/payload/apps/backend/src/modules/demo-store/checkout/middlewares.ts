import { authenticate, type MiddlewareRoute } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { checkoutCart, prepareCheckoutPayment, validateCheckoutCompletion, invalidateCheckoutPayment, assertCartAccess, sessionFor, releaseCheckoutCompletion, beginCartMutation, endCartMutation } from './runtime';
import { checkoutErrorResponse } from './http';

/**
 * cart_id a partir del payment_collection_id, por el link cart <-> payment.
 *
 * El nombre de la entidad en el grafo es el snake_case `cart_payment_collection`.
 * NO sirve `LINKS.CartPaymentCollection`: esa constante es el nombre de la CLASE
 * del modelo (`CartCartPaymentPaymentCollectionLink`, ver `composeLinkName`), no
 * una entidad consultable. Con el nombre mal, `query.graph` deja el request SIN
 * respuesta —el socket muere y el gateway contesta 504— en vez de tirar un error
 * que el handler pueda mapear. Mismo camino de 2 saltos que ya usa
 * `src/utils/order-from-payment.ts` con el nombre correcto.
 *
 * Devuelve null si no se puede resolver, y el guard sigue de largo. Falla ABIERTO
 * a propósito: sin carrito no hay nada que validar (la tienda no usa el checkout
 * de demo-store), y este middleware está montado en la ruta de pago de TODAS las
 * tiendas — un error acá no puede volver a cortarle el checkout a un tenant que
 * no usa la feature. El 2026-09-09 tumbó el de desdeelsur entero, que tenía
 * MercadoPago como único medio habilitado.
 */
export const cartIdFromPaymentCollection = async (scope: any, paymentCollectionId: string): Promise<string | null> => {
  try {
    const { data } = await scope.resolve(ContainerRegistrationKeys.QUERY).graph({ entity: 'cart_payment_collection', fields: ['cart_id'], filters: { payment_collection_id: paymentCollectionId } });
    return data[0]?.cart_id ?? null;
  } catch (error) {
    scope.resolve(ContainerRegistrationKeys.LOGGER).warn(`checkout: no se pudo resolver el carrito de ${paymentCollectionId}; se deja pasar el pago sin validar el checkout. ${(error as Error).message}`);
    return null;
  }
};
const guardPayment = async (req: any, res: any, next: any) => {
  try {
    let cartId = req.body?.cart_id;
    if (!cartId && req.params.id) cartId = await cartIdFromPaymentCollection(req.scope, req.params.id);
    if (cartId) {
      const cart = await checkoutCart(req.scope, cartId);
      const existing = await sessionFor(req.scope, cartId);
      if (existing) await assertCartAccess(req, cart, existing);
      // Direct/express entries must have persisted recipients before creating a provider session.
      await prepareCheckoutPayment(req.scope, cart);
      if (req.body?.paymentSessionId) {
        if (!cart.payment_collection?.payment_sessions?.some((s: any) => s.id === req.body.paymentSessionId)) return res.status(400).json({ code: 'PAYMENT_SESSION_MISMATCH', message: 'La sesión de pago no pertenece al carrito.' });
        await validateCheckoutCompletion(req.scope, cart);
        res.once('finish', () => { if (res.statusCode >= 400) void releaseCheckoutCompletion(req.scope, cartId).catch(() => {}); });
      }
    }
    next();
  } catch (error) { checkoutErrorResponse(res, error); }
};
export const checkoutMiddlewares: MiddlewareRoute[] = [
  { matcher: /^\/store\/(?:b2b\/)?carts\/[^/]+(?:\/.*)?$/, method: ['POST', 'DELETE'], middlewares: [authenticate('customer', ['session', 'bearer'], { allowUnauthenticated: true }), async (req: any, res: any, next: any) => {
    if (/\/checkout$/.test(req.path)) return next();
    const match = req.path.match(/^\/store\/(?:b2b\/)?carts\/([^/]+)/);
    if (!match) return next();
    try {
      const cart = await checkoutCart(req.scope, match[1]);
      const existing = await sessionFor(req.scope, cart.id);
      if (existing) await assertCartAccess(req, cart, existing);
      if (/\/complete$/.test(req.path)) return next();
      const token = await beginCartMutation(req.scope, cart.id);
      try { await invalidateCheckoutPayment(req.scope, cart); }
      catch (error) { await endCartMutation(req.scope, cart.id, token); throw error; }
      res.once('finish', () => { void endCartMutation(req.scope, cart.id, token).catch(() => {}); });
      next();
    }
    catch (error) { checkoutErrorResponse(res, error); }
  }] },
  { matcher: '/store/carts/:id/checkout', method: ['POST'], middlewares: [authenticate('customer', ['session', 'bearer'], { allowUnauthenticated: true })] },
  { matcher: '/store/payment-collections/:id/payment-sessions', method: ['POST'], middlewares: [authenticate('customer', ['session', 'bearer'], { allowUnauthenticated: true }), guardPayment] },
  { matcher: '/store/mercadopago/payment', method: ['POST'], middlewares: [authenticate('customer', ['session', 'bearer'], { allowUnauthenticated: true }), guardPayment] },
];
