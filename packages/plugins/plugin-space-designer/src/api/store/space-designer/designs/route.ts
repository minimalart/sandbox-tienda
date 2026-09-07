import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { DesignSchema, PaginationSchema } from '../../../../validation';
import {
  channelFilter,
  configuratorById,
  customerOf,
  missing,
  parse,
  serviceOf,
  storeChannels,
  validateSelection,
} from '../../../shared';
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const customer = customerOf(req);
  if (!customer) return missing();
  const page = parse(PaginationSchema, req.query);
  const [designs, count] = await serviceOf(req).listAndCountSpaceDesigns(
    { customer_id: customer, ...channelFilter(storeChannels(req), false) },
    { skip: page.offset, take: page.limit, order: { updated_at: 'DESC' } }
  );
  res.setHeader('Cache-Control', 'private, no-store');
  res.json({ designs, count, offset: page.offset, limit: page.limit });
}
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const customer = customerOf(req);
  if (!customer) return missing();
  const input = parse(DesignSchema, req.body);
  const configurator = await configuratorById(req, input.configurator_id, true);
  validateSelection(configurator.config, input.snapshot, input.template_id);
  const design = await serviceOf(req).createSpaceDesigns({
    configurator_id: configurator.id,
    customer_id: customer,
    sales_channel_id: configurator.sales_channel_id ?? storeChannels(req)[0],
    name: input.name,
    template_id: input.template_id ?? null,
    snapshot: input.snapshot,
    configuration_snapshot: configurator.config,
  } as any);
  res.status(201).json({ design });
}
