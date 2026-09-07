import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { filterEligibleProducts } from '../../../modules/recurring-order/eligibility';
import { resolveProductDiscounts } from '../../../modules/recurring-order/offers';
import { isRecurringEnabledForChannel } from '../../../modules/recurring-order/toggle';
import {
  channelsFromPublishableKey,
  siteFromPublishableKey,
} from '../../../lib/multistore/publishable-key';

/**
 * GET /store/recurring-eligibility?sales_channel_id=&product_ids=a,b,c
 *
 * Qué productos pueden suscribirse en un canal. PÚBLICO a propósito (vive
 * fuera de /store/recurring-orders/* para no caer en su authenticate): la PDP
 * decide si muestra "Suscribirse" también para visitantes anónimos. Devuelve
 * `enabled` (toggle del canal), el subconjunto elegible de los ids pedidos y
 * los descuentos de suscripción efectivos por producto (marketing; el
 * descuento real lo aplica el carrito de renovación).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  await siteFromPublishableKey(req);
  const requestedChannelId = (req.query.sales_channel_id as string | undefined) || null;
  const allowedChannels = channelsFromPublishableKey(req);
  if (requestedChannelId && allowedChannels.length && !allowedChannels.includes(requestedChannelId)) {
    res.status(200).json({ enabled: false, eligible_product_ids: [], discounts: {} });
    return;
  }
  const salesChannelId = requestedChannelId ?? allowedChannels[0] ?? null;
  const raw = (req.query.product_ids as string | undefined) ?? '';
  const productIds = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 100);

  const enabled = await isRecurringEnabledForChannel(req.scope, salesChannelId);
  if (!enabled || !productIds.length) {
    res.status(200).json({ enabled, eligible_product_ids: [], discounts: {} });
    return;
  }

  const eligible = await filterEligibleProducts(req.scope, salesChannelId, productIds);
  const eligibleIds = productIds.filter((id) => eligible.has(id));
  const discountsMap = await resolveProductDiscounts(req.scope, salesChannelId, eligibleIds);
  res.status(200).json({
    enabled,
    eligible_product_ids: eligibleIds,
    discounts: Object.fromEntries(discountsMap),
  });
}
