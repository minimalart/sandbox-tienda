import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { PaginationSchema } from '../../../../validation';
import { adminChannels, channelFilter, parse, serviceOf } from '../../../shared';
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const page = parse(PaginationSchema, req.query);
  const [designs, count] = await serviceOf(req).listAndCountSpaceDesigns(
    {
      ...channelFilter(await adminChannels(req), false),
      ...(page.q ? { name: { $ilike: `%${page.q}%` } } : {}),
    },
    { skip: page.offset, take: page.limit, order: { updated_at: 'DESC' } }
  );
  res.json({ designs, count, offset: page.offset, limit: page.limit });
}
