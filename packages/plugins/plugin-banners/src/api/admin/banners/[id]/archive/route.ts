import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { archiveBannerWorkflow } from '../../../../../workflows/archive-banner';

/**
 * POST /admin/banners/:id/archive — set status to 'archived' (via workflow)
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const { result } = await archiveBannerWorkflow(req.scope).run({
      input: {
        id: req.params.id as string,
        user_id: (req as any).auth_context?.actor_id,
      },
    });
    return res.status(200).json({ banner: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error archiving banner';
    console.error('[Admin Banners] Error archiving banner:', message);
    return res.status(400).json({ message });
  }
}
