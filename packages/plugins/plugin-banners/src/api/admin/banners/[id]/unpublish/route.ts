import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { unpublishBannerWorkflow } from '../../../../../workflows/unpublish-banner';

/**
 * POST /admin/banners/:id/unpublish — set status back to 'draft' (via workflow)
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const { result } = await unpublishBannerWorkflow(req.scope).run({
      input: {
        id: req.params.id as string,
        user_id: (req as any).auth_context?.actor_id,
      },
    });
    return res.status(200).json({ banner: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error unpublishing banner';
    console.error('[Admin Banners] Error unpublishing banner:', message);
    return res.status(400).json({ message });
  }
}
