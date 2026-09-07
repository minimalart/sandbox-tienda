import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { RECURRING_ORDER_MODULE } from '../../../modules/recurring-order';
import type RecurringOrderModuleService from '../../../modules/recurring-order/service';
import {
  channelsFromPublishableKey,
  siteFromPublishableKey,
} from '../../../lib/multistore/publishable-key';

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<RecurringOrderModuleService>(RECURRING_ORDER_MODULE);
  await siteFromPublishableKey(req);
  const requestedChannelId = String(req.query.sales_channel_id ?? '');
  const allowedChannels = channelsFromPublishableKey(req);
  const channelId = requestedChannelId && (!allowedChannels.length || allowedChannels.includes(requestedChannelId))
    ? requestedChannelId
    : allowedChannels[0] ?? '';
  const rows: any[] = await service.listSubscriptionCancellationReasons(
    { enabled: true },
    { take: 200, order: { sort_order: 'ASC' } },
  );
  const effective = new Map<string, any>();
  for (const reason of rows.filter((row) => row.sales_channel_id == null)) effective.set(reason.code, reason);
  if (channelId) {
    for (const reason of rows.filter((row) => row.sales_channel_id === channelId)) effective.set(reason.code, reason);
  }
  res.status(200).json({
    cancellation_reasons: [...effective.values()].sort((a, b) => a.sort_order - b.sort_order),
  });
}
