import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ConfiguratorSchema, PaginationSchema } from '../../../../validation';
import {
  adminChannels,
  assertChannel,
  assertUniqueSlug,
  channelFilter,
  parse,
  serviceOf,
  validateCatalog,
} from '../../../shared';
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const page = parse(PaginationSchema, req.query);
  const channels = await adminChannels(req);
  if (page.sales_channel_id) assertChannel(page.sales_channel_id, channels, false);
  const [configurators, count] = await serviceOf(req).listAndCountSpaceConfigurators(
    {
      ...channelFilter(channels),
      ...(page.sales_channel_id ? { sales_channel_id: page.sales_channel_id } : {}),
      ...(page.q ? { title: { $ilike: `%${page.q}%` } } : {}),
    },
    { take: page.limit, skip: page.offset, order: { updated_at: 'DESC' } }
  );
  res.json({ configurators, count, offset: page.offset, limit: page.limit });
}
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const channels = await adminChannels(req);
  const input = parse(ConfiguratorSchema, req.body);
  if (!input.sales_channel_id && channels?.length) input.sales_channel_id = channels[0]!;
  assertChannel(input.sales_channel_id, channels, false);
  await assertUniqueSlug(req, input.slug);
  await validateCatalog(req, input.config, input.sales_channel_id, input.status === 'published');
  const configurator = await serviceOf(req).createSpaceConfigurators(input as any);
  res.status(201).json({ configurator });
}
