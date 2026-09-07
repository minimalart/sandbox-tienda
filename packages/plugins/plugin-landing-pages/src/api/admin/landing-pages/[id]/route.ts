import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { siteFromRequest } from '../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../lib/multistore/scope';
import { LANDING_PAGE_SITE_SCOPE } from '../../../../modules/landing-page/site-scope';
import { LANDING_PAGE_MODULE } from '../../../../modules/landing-page';
import type LandingPageModuleService from '../../../../modules/landing-page/service';
import type { UpdateLandingPageInput } from '../../../../modules/landing-page/types';
import { updateLandingPageWorkflow } from '../../../../workflows/update-landing-page';
import { PostAdminUpdateLandingPage } from '../validators';

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  // Todos los handlers: el listado filtra, pero el id se adivina desde ahí.
  await assertIdInSite(req.scope, await siteFromRequest(req), LANDING_PAGE_SITE_SCOPE, req.params.id as string);

  const service: LandingPageModuleService = req.scope.resolve(
    LANDING_PAGE_MODULE,
  );
  try {
    const landing_page = await service.retrieveLandingPage((req.params.id as string));
    return res.status(200).json({ landing_page });
  } catch {
    return res.status(404).json({ message: 'Landing page not found' });
  }
}

/** POST /admin/landing-pages/:id — update (partial). */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  // Todos los handlers: el listado filtra, pero el id se adivina desde ahí.
  await assertIdInSite(req.scope, await siteFromRequest(req), LANDING_PAGE_SITE_SCOPE, req.params.id as string);

  try {
    const validated = PostAdminUpdateLandingPage.parse(req.body);
    const userId = (req as { auth_context?: { actor_id?: string } })
      .auth_context?.actor_id;

    const { result } = await updateLandingPageWorkflow(req.scope).run({
      input: {
        id: (req.params.id as string),
        ...validated,
        updated_by: userId,
      } as unknown as UpdateLandingPageInput & { id: string },
    });

    return res.status(200).json({ landing_page: result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Error updating landing page';
    console.error('[Admin LandingPages] Error updating landing page:', message);
    return res.status(400).json({ message });
  }
}

/** DELETE /admin/landing-pages/:id — soft-delete. */
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  // Todos los handlers: el listado filtra, pero el id se adivina desde ahí.
  await assertIdInSite(req.scope, await siteFromRequest(req), LANDING_PAGE_SITE_SCOPE, req.params.id as string);

  const service: LandingPageModuleService = req.scope.resolve(
    LANDING_PAGE_MODULE,
  );
  try {
    await (service as any).softDeleteLandingPages((req.params.id as string));
    return res
      .status(200)
      .json({ id: (req.params.id as string), object: 'landing_page', deleted: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Error deleting landing page';
    console.error('[Admin LandingPages] Error deleting landing page:', message);
    return res.status(400).json({ message });
  }
}
