import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import type { SpaceQuote } from '../../../../../types';
import { QuoteUpdateSchema } from '../../../../../validation';
import { adminChannels, assertChannel, missing, parse, serviceOf } from '../../../../shared';

async function quoteById(req: MedusaRequest): Promise<SpaceQuote> {
  const rows = await serviceOf(req).listSpaceQuotes({ id: req.params.id! }, { take: 1 });
  const quote = rows[0] as unknown as SpaceQuote | undefined;
  if (!quote) return missing();
  assertChannel(quote.sales_channel_id, await adminChannels(req), false);
  return quote;
}
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  res.json({ quote: await quoteById(req) });
}
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const current = await quoteById(req);
  const input = parse(QuoteUpdateSchema, req.body);
  const quote = await serviceOf(req).updateSpaceQuotes({ id: current.id, ...input } as any);
  res.json({ quote });
}
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const current = await quoteById(req);
  await serviceOf(req).softDeleteSpaceQuotes(current.id);
  res.json({ id: current.id, deleted: true });
}
