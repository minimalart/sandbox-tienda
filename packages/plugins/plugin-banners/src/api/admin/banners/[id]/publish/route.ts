import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { publishBannerWorkflow } from '../../../../../workflows/publish-banner';

/**
 * POST /admin/banners/:id/publish — set status to 'published' (via workflow)
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const { result } = await publishBannerWorkflow(req.scope).run({
      input: {
        id: req.params.id as string,
        user_id: (req as any).auth_context?.actor_id,
      },
    });
    return res.status(200).json({ banner: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error publishing banner';
    console.error('[Admin Banners] Error publishing banner:', message);
    return res.status(400).json({ message });
  }
}
