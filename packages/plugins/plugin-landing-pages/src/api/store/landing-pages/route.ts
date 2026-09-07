import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { LANDING_PAGE_MODULE } from '../../../modules/landing-page';
import type LandingPageModuleService from '../../../modules/landing-page/service';
import { toPublicLandingPage } from './helpers';

/**
 * GET /store/landing-pages — public list of PUBLISHED landing pages.
 * Query: limit, offset, locale. Never returns drafts/archived.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const service: LandingPageModuleService = req.scope.resolve(
      LANDING_PAGE_MODULE,
    );
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const offset = req.query.offset ? Number(req.query.offset) : 0;
    const locale =
      typeof req.query.locale === 'string' ? req.query.locale : undefined;

    const filters: Record<string, unknown> = { status: 'published' };
    if (locale) {
      filters.locale = locale;
    }

    const [pages, count] = await service.listAndCountLandingPages(filters, {
      skip: offset,
      take: limit,
      order: { published_at: 'DESC' },
    });

    return res.status(200).json({
      landing_pages: (pages as Record<string, any>[]).map(toPublicLandingPage),
      count,
      limit,
      offset,
    });
  } catch (error) {
    console.error('[Store LandingPages] Error listing landing pages:', error);
    return res.status(200).json({ landing_pages: [], count: 0 });
  }
}
