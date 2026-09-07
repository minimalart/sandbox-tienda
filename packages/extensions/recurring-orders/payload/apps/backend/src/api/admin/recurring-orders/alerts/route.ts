import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { siteChannelFilter, siteFromRequest } from '../../../../lib/multistore';
import { RECURRING_ORDER_MODULE } from '../../../../modules/recurring-order';
import type RecurringOrderModuleService from '../../../../modules/recurring-order/service';

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<RecurringOrderModuleService>(RECURRING_ORDER_MODULE);
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const filters: Record<string, unknown> = siteChannelFilter(
    await siteFromRequest(req),
    req.query.sales_channel_id as string | undefined,
  );
  if (req.query.status) filters.status = String(req.query.status).split(',');
  if (req.query.type) filters.type = String(req.query.type).split(',');
  const [alerts, count] = await service.listAndCountSubscriptionAlerts(filters, {
    take: limit,
    skip: offset,
    order: { detected_at: 'DESC' },
  });
  res.status(200).json({ alerts, count, limit, offset });
}
