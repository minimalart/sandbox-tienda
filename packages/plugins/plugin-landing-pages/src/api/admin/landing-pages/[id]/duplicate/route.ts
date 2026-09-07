import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { LANDING_PAGE_MODULE } from '../../../../../modules/landing-page';
import type LandingPageModuleService from '../../../../../modules/landing-page/service';
import type { CreateLandingPageInput } from '../../../../../modules/landing-page/types';
import { createLandingPageWorkflow } from '../../../../../workflows/create-landing-page';

/** POST /admin/landing-pages/:id/duplicate — clone as a fresh draft. */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const service: LandingPageModuleService = req.scope.resolve(
    LANDING_PAGE_MODULE,
  );
  try {
    const original = (await service.retrieveLandingPage(
      (req.params.id as string),
    )) as Record<string, any>;

    const { result } = await createLandingPageWorkflow(req.scope).run({
      input: {
        title: `Copy of ${original.title}`,
        status: 'draft',
        description: original.description ?? null,
        seo: original.seo ?? null,
        puck_data: original.puck_data ?? null,
        template: original.template ?? null,
        locale: original.locale ?? null,
        sales_channel_id: original.sales_channel_id ?? null,
        metadata: original.metadata ?? null,
      } as unknown as CreateLandingPageInput,
    });

    return res.status(201).json({ landing_page: result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Error duplicating landing page';
    return res.status(400).json({ message });
  }
}
