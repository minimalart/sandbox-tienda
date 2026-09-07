import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { siteFromRequest } from '../../../../../lib/multistore/request';
import { assertRowInSite } from '../../../../../lib/multistore/scope';
import { RECURRING_ORDER_MODULE } from '../../../../../modules/recurring-order';
import type RecurringOrderModuleService from '../../../../../modules/recurring-order/service';
import { SUBSCRIPTION_CANCELLATION_REASON_SITE_SCOPE } from '../../../../../modules/recurring-order/site-scope';
import {
  ReasonBody,
  allowedCancellationChannels,
  assertAllowedChannel,
} from '../route';

async function owned(req: MedusaRequest): Promise<{ service: RecurringOrderModuleService; reason: any }> {
  const service = req.scope.resolve<RecurringOrderModuleService>(RECURRING_ORDER_MODULE);
  const reason: any = await service.retrieveSubscriptionCancellationReason(req.params.reason_id as string);
  const resolution = await siteFromRequest(req);
  assertRowInSite(reason, resolution, SUBSCRIPTION_CANCELLATION_REASON_SITE_SCOPE);
  assertAllowedChannel(reason.sales_channel_id ?? null, await allowedCancellationChannels(req));
  return { service, reason };
}

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const parsed = ReasonBody.partial().safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Datos inválidos' });
    return;
  }
  const { service, reason } = await owned(req);
  const channelId = parsed.data.sales_channel_id === undefined
    ? reason.sales_channel_id
    : parsed.data.sales_channel_id ?? null;
  assertAllowedChannel(channelId, await allowedCancellationChannels(req));
  const [updated] = await service.updateSubscriptionCancellationReasons([{
    id: reason.id,
    ...parsed.data,
    sales_channel_id: channelId,
  }]);
  res.status(200).json({ cancellation_reason: updated });
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const { service, reason } = await owned(req);
  await service.softDeleteSubscriptionCancellationReasons([reason.id]);
  res.sendStatus(204);
}
