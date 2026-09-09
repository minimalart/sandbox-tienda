import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';

/**
 * GET /store/orders/by-cart?cart_id=<id> — public, returns { order_id: string | null }.
 *
 * Es el endpoint que sostiene TODO el retorno de MercadoPago. En Checkout Pro la
 * orden la crea el webhook, no el browser: `/checkout/success` y
 * `/checkout/pending` NO llaman a `placeOrder` a propósito (si lo hicieran,
 * cerrar la pestaña mataría la orden). Hacen polling acá cada 2 s, 30 veces, y
 * recién cuando aparece el `order_id` mandan al comprador a
 * `/order/{id}/confirmed`.
 *
 * NUNCA EXISTIÓ. El storefront quedó escrito contra este contrato y del lado del
 * backend no había nada, así que Medusa lo matcheaba contra su ruta nativa
 * `GET /store/orders/:id` con `id = "by-cart"`, cuyo validator de query rechaza
 * cualquier campo que no conoce:
 *
 *   GET /store/orders/by-cart?cart_id=cart_x
 *   → 400 {"type":"invalid_data","message":"Invalid request: Unrecognized fields: 'cart_id'"}
 *
 * El proxy del storefront se comía ese error en un `catch {}` y devolvía
 * `order_id: null`, así que el polling agotaba sus 30 intentos SIEMPRE y a los
 * 60 s exactos aparecía "Tu pago fue aprobado pero la confirmación está
 * tardando" — en cada compra, con el webhook funcionando perfecto. Medido sobre
 * la orden #20 de desdeelsur: orden creada en `17:32:06.168`, pago capturado en
 * `17:32:07.207`. El webhook cerró todo en 1,1 s y el comprador igual se comió
 * el minuto de spinner y el cartel de alarma.
 *
 * ESTA RUTA TIENE QUE SER `static`, Y NO ES UN DETALLE DE ESTILO. El middleware
 * nativo se registra como `app.get('/store/orders/:id', validator)`
 * (`framework/src/http/router.ts`), que en Express matchea `/store/orders/by-cart`
 * igual. Lo que evita que nos rechace es que `RoutesSorter` ordena middlewares y
 * rutas en la misma pasada con prioridad `[global, wildcard, regex, static,
 * params]`: `by-cart` cae en `static`, `:id` en `params`, así que este handler se
 * registra ANTES y responde antes de que el validator corra. Si algún día esto
 * se mueve a un segmento dinámico, o el orden del sorter cambia, vuelve el 400.
 *
 * `cart.order.id` es el mismo camino que ya usa `resolveCartState` en el webhook
 * (`api/mercado-pago/route.ts`), o sea que está probado en producción.
 *
 * Sin auth a propósito: el comprador todavía puede ser invitado cuando vuelve de
 * MercadoPago. No expone nada nuevo — el `cart_id` es un ULID que sólo conoce
 * quien hizo la compra, y en 2.18 `GET /store/orders/:id` ya es público.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const cartId = req.query?.cart_id as string | undefined;

  if (!cartId) {
    res.status(400).json({ message: 'cart_id is required', order_id: null });
    return;
  }

  const query = req.scope.resolve('query');

  const { data: carts } = await query.graph({
    entity: 'cart',
    fields: ['id', 'order.id'],
    filters: { id: cartId },
  });

  const cart = carts?.[0] as { order?: { id?: string } | null } | undefined;

  // Un carrito inexistente y un carrito que todavía no es orden responden lo
  // mismo a propósito: el storefront sólo sabe seguir puliendo, y un 404 acá lo
  // haría abandonar el polling por un carrito que el webhook está a punto de
  // completar.
  res.json({ order_id: cart?.order?.id ?? null });
}
