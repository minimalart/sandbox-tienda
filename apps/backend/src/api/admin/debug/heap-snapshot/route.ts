import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import type { Logger } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { captureAndUpload } from '../../../../lib/heap-snapshot';

/**
 * POST /admin/debug/heap-snapshot — capture a V8 heap snapshot and upload it to
 * Spaces on demand. Admin auth is applied to /admin/* by Medusa; on top of that
 * we require a DEBUG_HEAP_TOKEN, because triggering a multi-second stop-the-world
 * pause + dumping secret-bearing memory should NOT be one click for any admin.
 *
 * Feature is OFF by default: with DEBUG_HEAP_TOKEN unset the route 404s (invisible).
 * Temporary diagnostic — remove once the OOM leak is found.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const expected = process.env.DEBUG_HEAP_TOKEN;
  if (!expected) {
    res.status(404).json({ message: 'Not found' });
    return;
  }

  const headerToken = req.headers['x-debug-heap-token'];
  const bodyToken = (req.body as { token?: string } | undefined)?.token;
  const provided = (Array.isArray(headerToken) ? headerToken[0] : headerToken) || bodyToken;
  if (provided !== expected) {
    res.status(404).json({ message: 'Not found' });
    return;
  }

  if (!process.env.S3_BUCKET) {
    res.status(400).json({ message: 'S3_BUCKET not configured — cannot upload snapshot' });
    return;
  }

  const logger = req.scope.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  try {
    const { key, size, url } = await captureAndUpload(logger);
    // `url` is a time-limited presigned link — download it directly, no Spaces
    // folder access needed.
    res.status(200).json({ key, sizeBytes: size, url });
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
}
