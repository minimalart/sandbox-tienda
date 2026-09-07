import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { MedusaError } from '@medusajs/framework/utils';
import { z } from 'zod';
import { siteFromRequest } from '../../../../lib/multistore/request';
import { siteChannelFilter } from '../../../../lib/multistore/scope';
import { RECURRING_ORDER_MODULE } from '../../../../modules/recurring-order';
import type RecurringOrderModuleService from '../../../../modules/recurring-order/service';

export const ReasonBody = z.object({
  sales_channel_id: z.string().nullish(),
  code: z.string().min(2).max(60).regex(/^[a-z0-9_]+$/),
  label: z.string().min(2).max(160),
  enabled: z.boolean().default(true),
  sort_order: z.number().int().min(0).max(10000).default(0),
});

export async function allowedCancellationChannels(req: MedusaRequest): Promise<string[] | null> {
  const filter = siteChannelFilter(await siteFromRequest(req), undefined);
  const value = filter.sales_channel_id;
  if (Array.isArray(value)) return value.filter((id): id is string => typeof id === 'string');
  if (typeof value === 'string') return [value];
  return null;
}

export function assertAllowedChannel(channelId: string | null, allowed: string[] | null): void {
  if (channelId && allowed && !allowed.includes(channelId)) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, 'No encontrado.');
  }
}

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<RecurringOrderModuleService>(RECURRING_ORDER_MODULE);
  const allowed = await allowedCancellationChannels(req);
  const rows: any[] = await service.listSubscriptionCancellationReasons(
    {},
    { take: 500, order: { sort_order: 'ASC' } },
  );
  res.status(200).json({
    cancellation_reasons: rows.filter((reason) =>
      reason.sales_channel_id == null || allowed == null || allowed.includes(reason.sales_channel_id),
    ),
  });
}

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const parsed = ReasonBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Datos inválidos' });
    return;
  }
  const allowed = await allowedCancellationChannels(req);
  const channelId = parsed.data.sales_channel_id === undefined && allowed?.length
    ? allowed[0] ?? null
    : parsed.data.sales_channel_id ?? null;
  assertAllowedChannel(channelId, allowed);
  const service = req.scope.resolve<RecurringOrderModuleService>(RECURRING_ORDER_MODULE);
  const [reason] = await service.createSubscriptionCancellationReasons([{
    ...parsed.data,
    sales_channel_id: channelId,
  }]);
  res.status(201).json({ cancellation_reason: reason });
}
