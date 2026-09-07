import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { LANDING_PAGE_MODULE } from '../../../../modules/landing-page';
import type LandingPageModuleService from '../../../../modules/landing-page/service';
import { toPublicLandingPage } from '../helpers';

/**
 * GET /store/landing-pages/:slug — public, returns a single PUBLISHED landing
 * page by slug. Optional `?locale=` filter. 404 when not found/published.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const service: LandingPageModuleService = req.scope.resolve(
      LANDING_PAGE_MODULE,
    );
    const locale =
      typeof req.query.locale === 'string' ? req.query.locale : undefined;

    const filters: Record<string, unknown> = {
      status: 'published',
      slug: req.params.slug,
    };
    if (locale) {
      filters.locale = locale;
    }

    const [page] = await service.listLandingPages(filters, { take: 1 });

    if (!page) {
      return res.status(404).json({ message: 'Landing page not found' });
    }

    return res
      .status(200)
      .json({ landing_page: toPublicLandingPage(page as Record<string, any>) });
  } catch (error) {
    console.error('[Store LandingPages] Error fetching landing page:', error);
    return res.status(404).json({ message: 'Landing page not found' });
  }
}
