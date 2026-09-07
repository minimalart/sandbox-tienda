import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { publishLandingPageWorkflow } from '../../../../../workflows/publish-landing-page';

/** POST /admin/landing-pages/:id/publish */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const { result } = await publishLandingPageWorkflow(req.scope).run({
      input: { id: req.params.id as string, publish: true },
    });
    return res.status(200).json({ landing_page: result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Error publishing landing page';
    return res.status(400).json({ message });
  }
}
