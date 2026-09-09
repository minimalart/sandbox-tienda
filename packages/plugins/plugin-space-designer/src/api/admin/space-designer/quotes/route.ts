import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { QuoteListSchema } from '../../../../validation';
import { adminChannels, assertChannel, channelFilter, parse, serviceOf } from '../../../shared';
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const page = parse(QuoteListSchema, req.query);
  const channels = await adminChannels(req);
  if (page.sales_channel_id) assertChannel(page.sales_channel_id, channels, false);
  // Both the channel scope and the free-text search need `$or`; a single object
  // literal would silently keep only the last one, so they go under `$and`.
  const scopes: Record<string, unknown>[] = [channelFilter(channels)].filter(
    (scope) => Object.keys(scope).length
  );
  if (page.q)
    scopes.push({
      $or: [{ name: { $ilike: `%${page.q}%` } }, { email: { $ilike: `%${page.q}%` } }],
    });
  const [quotes, count] = await serviceOf(req).listAndCountSpaceQuotes(
    {
      ...(scopes.length ? { $and: scopes } : {}),
      ...(page.sales_channel_id ? { sales_channel_id: page.sales_channel_id } : {}),
      ...(page.status ? { status: page.status } : {}),
    },
    { take: page.limit, skip: page.offset, order: { created_at: 'DESC' } }
  );
  res.json({ quotes, count, offset: page.offset, limit: page.limit });
}
