import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { Modules } from '@medusajs/framework/utils';
import { readPreview, type PreviewCache } from '../../../../lib/home-preview';

/** Opaque 256-bit capability, short TTL, never discoverable through a listing. */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  const cache = req.scope.resolve(Modules.CACHE) as unknown as PreviewCache;
  const preview = await readPreview(cache, req.params.token as string);
  if (!preview) return res.status(404).json({ message: 'Preview expired or unavailable' });
  return res.json({ preview });
}
