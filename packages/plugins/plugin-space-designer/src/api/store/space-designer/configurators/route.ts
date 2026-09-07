import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { PaginationSchema } from '../../../../validation';
import { channelFilter, parse, serviceOf, storeChannels } from '../../../shared';
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const page = parse(PaginationSchema, req.query);
  const [configurators, count] = await serviceOf(req).listAndCountSpaceConfigurators(
    {
      status: 'published',
      ...channelFilter(storeChannels(req, true)),
      ...(page.q ? { title: { $ilike: `%${page.q}%` } } : {}),
    },
    { skip: page.offset, take: page.limit, order: { title: 'ASC' } }
  );
  res.setHeader('Cache-Control', 'private, no-store');
  res.json({ configurators, count, offset: page.offset, limit: page.limit });
}
