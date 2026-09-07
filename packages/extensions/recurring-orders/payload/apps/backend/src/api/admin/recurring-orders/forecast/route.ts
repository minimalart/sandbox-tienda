import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { siteChannelFilter, siteFromRequest } from '../../../../lib/multistore';
import { buildSubscriptionForecast } from '../../../../modules/recurring-order/forecast';

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const channelFilter = siteChannelFilter(
    await siteFromRequest(req),
    req.query.sales_channel_id as string | undefined,
  );
  const rows = await buildSubscriptionForecast(req.scope);
  const allowed = channelFilter.sales_channel_id as string | string[] | undefined;
  const forecast = !allowed
    ? rows
    : rows.filter((row) =>
        Array.isArray(allowed)
          ? allowed.includes(row.sales_channel_id)
          : row.sales_channel_id === allowed,
      );
  res.status(200).json({
    forecast,
    generated_at: new Date().toISOString(),
    windows: [14, 30],
  });
}
