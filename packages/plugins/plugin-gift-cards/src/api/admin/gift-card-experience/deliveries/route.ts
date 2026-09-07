import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { siteFromRequest } from '../../../../lib/multistore/request';
import { siteFilter } from '../../../../lib/multistore/scope';
import { GIFT_CARD_DELIVERY_SITE_SCOPE } from '../../../../modules/gift-card-experience/site-scope';
import { GIFT_CARD_EXPERIENCE_MODULE } from '../../../../modules/gift-card-experience';
import type GiftCardExperienceModuleService from '../../../../modules/gift-card-experience/service';

const safeDelivery = (delivery: Record<string, unknown>) => {
  const { token_hash: _hash, token_encrypted: _token, ...safe } = delivery;
  return safe;
};

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<GiftCardExperienceModuleService>(GIFT_CARD_EXPERIENCE_MODULE);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const filters: Record<string, unknown> = {};
  // La entrega hereda la tienda de su orden. Al WHERE: el listado pagina.
  Object.assign(
    filters,
    await siteFilter(req.scope, await siteFromRequest(req), GIFT_CARD_DELIVERY_SITE_SCOPE),
  );
  if (typeof req.query.delivery_status === 'string') filters.delivery_status = req.query.delivery_status;
  if (typeof req.query.issuance_status === 'string') filters.issuance_status = req.query.issuance_status;
  if (typeof req.query.order_id === 'string') filters.order_id = req.query.order_id;
  const [deliveries, count] = await service.listAndCountGiftCardDeliveries(filters, {
    skip: offset, take: limit, order: { created_at: 'DESC' },
  });
  res.json({ deliveries: deliveries.map((row) => safeDelivery(row as unknown as Record<string, unknown>)), count, limit, offset });
}
