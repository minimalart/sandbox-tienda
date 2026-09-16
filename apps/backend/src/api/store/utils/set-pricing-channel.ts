import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';

/**
 * setPricingChannel — store middleware that injects `sales_channel_id` into
 * `req.pricingContext` so Medusa's pricing engine can match
 * `price_list_rule.attribute = 'sales_channel_id'` rules.
 *
 * Must run AFTER Medusa's core `setPricingContext` middleware, which sets
 * `req.pricingContext` with region_id / currency_code.
 *
 * Channel resolution order (priority high → low):
 *
 *   1. Explicit request signal — `req.filterableFields.sales_channel_id` or
 *      `req.query.sales_channel_id`. Es la señal fiable: el storefront sabe en
 *      qué canal está y lo manda (Mercatto ya lo hace en
 *      `channel-products.ts:394,446`). Cualquier publishable key linkeada a
 *      varios canales pierde precisión sin este signal.
 *   2. Cart-scoped requests — el `sales_channel_id` guardado en el cart mismo,
 *      leído por id. Es lo que preserva cart parity con el listing (R4): el
 *      cart nace con el canal del site y se conserva en el line-item recompute.
 *   3. Publishable key — SOLO si tiene un único canal. Con múltiples canales
 *      no adivinamos: mejor fallback a base price que pintar un precio ajeno.
 *
 * Fail-open: cualquier error o resolución imposible pasa sin augmentar
 * `pricingContext`. La base price actúa como fallback, nunca un 5xx.
 *
 * Related ticket: EDUCABOT-9
 */
export function setPricingChannel(): (
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) => Promise<void> {
  return async (req, _res, next) => {
    try {
      // Medusa's core middlewares hang `pricingContext`, `publishable_key_context`,
      // and `filterableFields` off `req` at runtime but they are not part of the
      // `MedusaRequest` type surface. We narrow with a structural type to avoid
      // leaking `any` here.
      const reqAny = req as unknown as {
        pricingContext?: Record<string, unknown>;
        publishable_key_context?: { sales_channel_ids?: string[] };
        filterableFields?: { sales_channel_id?: string | string[] };
        query?: { sales_channel_id?: string | string[] };
        params?: Record<string, string>;
        scope: MedusaRequest['scope'];
      };

      // Bail out if setPricingContext hasn't populated pricingContext yet — the
      // pricing engine won't compute prices in that case anyway.
      if (!reqAny.pricingContext) {
        return next();
      }

      let salesChannelId: string | null = null;

      // --- Path 1: explicit signal (query / filterableFields) -----------------
      // Prioridad máxima: cuando el storefront dice "estoy navegando canal X",
      // es lo que hay que usar para pricing, sin importar qué channels le
      // pertenezcan a la publishable key. Medusa ya expone la clave por dos
      // canales: `filterableFields` (después de su validador de query) y
      // `query.sales_channel_id` (crudo del URL). Aceptamos ambas.
      const explicitChannel =
        pickFirstString(reqAny.filterableFields?.sales_channel_id) ??
        pickFirstString(reqAny.query?.sales_channel_id);
      if (explicitChannel) {
        salesChannelId = explicitChannel;
      }

      // --- Path 2: resolve from cart (cart line-item endpoints) ---------------
      if (!salesChannelId && reqAny.params?.id) {
        const cartId = reqAny.params.id;
        if (cartId.startsWith('cart_')) {
          const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
          const { data: carts } = await query.graph({
            entity: 'cart',
            filters: { id: cartId },
            fields: ['id', 'sales_channel_id'],
          });
          const cart = carts?.[0] as { id: string; sales_channel_id?: string } | undefined;
          if (cart?.sales_channel_id) {
            salesChannelId = cart.sales_channel_id;
          }
        }
      }

      // --- Path 3: publishable key with a SINGLE channel ----------------------
      // Con una key linkeada a un único canal no hay ambigüedad. Con múltiples
      // canales tampoco intentamos elegir: sin señal explícita (Path 1) no
      // sabemos cuál es el "activo" para el customer, y adivinar es peor que
      // no inyectar (deja base price como fallback, mecánicamente idéntico a
      // como funcionaba antes del middleware — R2 preservado).
      if (!salesChannelId) {
        const channelIds = reqAny.publishable_key_context?.sales_channel_ids;
        if (Array.isArray(channelIds) && channelIds.length === 1) {
          salesChannelId = channelIds[0]!;
        }
      }

      if (salesChannelId) {
        reqAny.pricingContext.sales_channel_id = salesChannelId;
      }
    } catch {
      // Fail-open: any unexpected error must not break pricing for the request.
    }

    return next();
  };
}

/** Devuelve el primer string presente (o null) desde `string | string[]`. */
function pickFirstString(value: string | string[] | undefined): string | null {
  if (typeof value === 'string' && value.length > 0) return value;
  if (Array.isArray(value)) {
    const first = value.find((v) => typeof v === 'string' && v.length > 0);
    return first ?? null;
  }
  return null;
}
