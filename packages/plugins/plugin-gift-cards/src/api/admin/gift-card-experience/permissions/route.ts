import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { resolveGiftCardAdminPermissions } from '../permissions';

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');
  res.json(await resolveGiftCardAdminPermissions(req));
}
