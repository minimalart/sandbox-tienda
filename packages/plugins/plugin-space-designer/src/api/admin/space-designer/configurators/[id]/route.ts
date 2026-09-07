import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ConfiguratorSchema } from '../../../../../validation';
import {
  adminChannels,
  assertChannel,
  assertUniqueSlug,
  configuratorById,
  invalid,
  parse,
  serviceOf,
  validateCatalog,
} from '../../../../shared';
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  res.json({ configurator: await configuratorById(req, req.params.id!) });
}
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const current = await configuratorById(req, req.params.id!);
  assertChannel(current.sales_channel_id, await adminChannels(req), false);
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body))
    invalid('El cuerpo debe ser un objeto.');
  const input = parse(ConfiguratorSchema, { ...current, ...(req.body as Record<string, unknown>) });
  assertChannel(input.sales_channel_id, await adminChannels(req), false);
  await assertUniqueSlug(req, input.slug, current.id);
  await validateCatalog(req, input.config, input.sales_channel_id, input.status === 'published');
  const configurator = await serviceOf(req).updateSpaceConfigurators({
    id: current.id,
    ...input,
  } as any);
  res.json({ configurator });
}
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const current = await configuratorById(req, req.params.id!);
  assertChannel(current.sales_channel_id, await adminChannels(req), false);
  await serviceOf(req).softDeleteSpaceConfigurators(current.id);
  res.json({ id: current.id, deleted: true });
}
